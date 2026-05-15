/// <summary>
/// HTTP client for the agent container.
///
/// Handles:
/// - Request forwarding to the agent container
/// - Retry with exponential backoff + jitter (3 retries, 200ms base, 2x multiplier, +/-25% jitter)
/// - Circuit breaker (5 failures, 30s cooldown)
/// - SSE streaming passthrough
/// </summary>

using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Diagnostics;

namespace CairaApi;

/// <summary>
/// Result from an agent request.
/// </summary>
public sealed class AgentResult<T>
{
    public bool Ok { get; init; }
    public int Status { get; init; }
    public T? Data { get; init; }
    public ErrorResponse? Error { get; init; }
}

public sealed class AgentHttpClient
{
    private readonly HttpClient _http;
    private readonly ApiConfig _config;
    private readonly ILogger _logger;

    // Retry config
    private const int MaxRetries = 3;
    private const int InitialDelayMs = 200;
    private const int MaxDelayMs = 5000;
    private const double BackoffMultiplier = 2.0;
    private const double JitterFactor = 0.25;

    // Circuit breaker config
    private const int FailureThreshold = 5;
    private const int CooldownMs = 30_000;
    private int _failures;
    private long _lastFailureTicks;
    private bool _circuitOpen;
    private readonly string? _tokenScope;
    private readonly IAccessTokenProvider _accessTokenProvider;
    private readonly ActivitySource _activitySource;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public AgentHttpClient(
        HttpClient http,
        ApiConfig config,
        ILogger<AgentHttpClient> logger,
        IAccessTokenProvider accessTokenProvider,
        ActivitySource activitySource)
    {
        _http = http;
        _http.BaseAddress = new Uri(config.AgentServiceUrl);
        _http.Timeout = TimeSpan.FromSeconds(120);
        _config = config;
        _logger = logger;
        _accessTokenProvider = accessTokenProvider;
        _tokenScope = config.AgentTokenScope;
        _activitySource = activitySource;
    }

    // ---------- Public API ----------

    public Task<AgentResult<AgentConversation>> CreateConversationAsync(
        Dictionary<string, object>? metadata = null, string? traceId = null)
    {
        var body = metadata != null ? new { metadata } : null;
        return RequestAsync<AgentConversation>(HttpMethod.Post, "/conversations", body, traceId);
    }

    public Task<AgentResult<AgentConversationList>> ListConversationsAsync(
        int? offset = null, int? limit = null)
    {
        var query = new StringBuilder("/conversations");
        var sep = '?';
        if (offset.HasValue) { query.Append(sep).Append("offset=").Append(offset.Value); sep = '&'; }
        if (limit.HasValue) { query.Append(sep).Append("limit=").Append(limit.Value); }
        return RequestAsync<AgentConversationList>(HttpMethod.Get, query.ToString());
    }

    public Task<AgentResult<AgentConversationDetail>> GetConversationAsync(string conversationId)
    {
        return RequestAsync<AgentConversationDetail>(HttpMethod.Get, $"/conversations/{conversationId}");
    }

    public Task<AgentResult<AgentMessage>> SendMessageAsync(
        string conversationId, string content, string? traceId = null)
    {
        return RequestAsync<AgentMessage>(
            HttpMethod.Post, $"/conversations/{Uri.EscapeDataString(conversationId)}/messages",
            new { content }, traceId);
    }

    /// <summary>
    /// Compound operation: create conversation + send first message.
    /// Used by business operation endpoints (discovery, planning, staffing).
    /// </summary>
    public async Task<AgentResult<StartActivityConversationResult>> StartActivityConversationAsync(
        string syntheticMessage, Dictionary<string, object>? metadata = null, string? traceId = null)
    {
        _logger.LogInformation("startActivityConversation begin (traceId={TraceId}, mode={Mode})",
            traceId, metadata?.GetValueOrDefault("mode"));

        var createResult = await CreateConversationAsync(metadata, traceId);
        if (!createResult.Ok || createResult.Data == null)
        {
            _logger.LogError("startActivityConversation failed — could not create conversation (traceId={TraceId}, error={Error})",
                traceId, createResult.Error?.Code);
            return new AgentResult<StartActivityConversationResult>
            {
                Ok = false,
                Status = createResult.Status,
                Error = createResult.Error,
            };
        }

        var conversationId = createResult.Data.Id;
        var createdAt = createResult.Data.CreatedAt;

        var msgResult = await SendMessageAsync(conversationId, syntheticMessage, traceId);
        if (!msgResult.Ok || msgResult.Data == null)
        {
            _logger.LogError("startActivityConversation failed — could not send opening message (traceId={TraceId}, error={Error})",
                traceId, msgResult.Error?.Code);
            return new AgentResult<StartActivityConversationResult>
            {
                Ok = false,
                Status = msgResult.Status,
                Error = msgResult.Error,
            };
        }

        _logger.LogInformation("startActivityConversation complete (traceId={TraceId}, contentLength={Len})",
            traceId, msgResult.Data.Content.Length);

        return new AgentResult<StartActivityConversationResult>
        {
            Ok = true,
            Status = 201,
            Data = new StartActivityConversationResult(conversationId, createdAt, msgResult.Data),
        };
    }

    /// <summary>
    /// Send a message and return the raw HttpResponseMessage for SSE streaming.
    /// Does NOT go through retry/circuit breaker — streaming connections
    /// are long-lived and should fail fast.
    /// </summary>
    public async Task<HttpResponseMessage> SendMessageStreamAsync(
        string conversationId, string content, string? traceId = null, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/conversations/{Uri.EscapeDataString(conversationId)}/messages")
        {
            Content = new StringContent(JsonSerializer.Serialize(new { content }), Encoding.UTF8, "application/json"),
        };
        using var activity = _activitySource.StartActivity("api.agent.stream");
        activity?.SetTag("conversation.id", conversationId);
        await ApplyAuthHeaderAsync(request, ct);
        request.Headers.Accept.ParseAdd("text/event-stream");
        if (traceId != null)
            request.Headers.TryAddWithoutValidation("x-trace-id", traceId);

        _logger.LogInformation("agent SSE stream request start (traceId={TraceId}, contentLength={Len})",
            traceId, content.Length);

        var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("agent SSE stream request failed (traceId={TraceId}, statusCode={Status})",
                traceId, (int)response.StatusCode);
        }
        else
        {
            _logger.LogInformation("agent SSE stream connected (traceId={TraceId}, statusCode={Status})",
                traceId, (int)response.StatusCode);
        }

        return response;
    }

    public async Task<AgentResult<AgentHealthResponse>> CheckHealthAsync()
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
            await ApplyAuthHeaderAsync(request, cts.Token);
            var response = await _http.SendAsync(request, cts.Token);
            var data = await response.Content.ReadFromJsonAsync<AgentHealthResponse>(JsonOptions, cts.Token);
            return new AgentResult<AgentHealthResponse>
            {
                Ok = response.IsSuccessStatusCode,
                Status = (int)response.StatusCode,
                Data = data,
            };
        }
        catch
        {
            return new AgentResult<AgentHealthResponse>
            {
                Ok = false,
                Status = 503,
                Error = new ErrorResponse("agent_unreachable", "Agent container health check failed"),
            };
        }
    }

    // ---------- Status mapping ----------

    public static int MapAgentStatus(int agentStatus) => agentStatus switch
    {
        400 => 400,
        401 => 502,
        404 => 404,
        429 => 429,
        503 => 503,
        >= 500 => 502,
        _ => agentStatus,
    };

    // ---------- Circuit breaker ----------

    private bool IsCircuitOpen()
    {
        if (!_circuitOpen) return false;
        var elapsed = (DateTimeOffset.UtcNow.Ticks - Interlocked.Read(ref _lastFailureTicks)) / TimeSpan.TicksPerMillisecond;
        return elapsed < CooldownMs;
    }

    private void RecordSuccess()
    {
        if (_circuitOpen)
        {
            _logger.LogInformation("Circuit breaker closed — request succeeded");
        }
        Interlocked.Exchange(ref _failures, 0);
        _circuitOpen = false;
    }

    private void RecordFailure()
    {
        var count = Interlocked.Increment(ref _failures);
        Interlocked.Exchange(ref _lastFailureTicks, DateTimeOffset.UtcNow.Ticks);
        if (count >= FailureThreshold)
        {
            if (!_circuitOpen)
            {
                _logger.LogWarning("Circuit breaker opened — failure threshold reached (failures={Failures}, threshold={Threshold})",
                    count, FailureThreshold);
            }
            _circuitOpen = true;
        }
    }

    // ---------- Retry helpers ----------

    private static bool IsRetryableStatus(int status) => status is 429 or 502 or 503;

    private static int ComputeDelay(int attempt)
    {
        var baseDelay = Math.Min(InitialDelayMs * Math.Pow(BackoffMultiplier, attempt), MaxDelayMs);
        var jitter = baseDelay * JitterFactor * (Random.Shared.NextDouble() * 2 - 1);
        return Math.Max(0, (int)(baseDelay + jitter));
    }

    private async Task ApplyAuthHeaderAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (_config.SkipAuth)
        {
            return;
        }

        var token = await AcquireBearerTokenAsync(ct);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private async Task<string> AcquireBearerTokenAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_tokenScope))
        {
            throw new InvalidOperationException(
                "AgentHttpClient requires AGENT_TOKEN_SCOPE when auth is enabled.");
        }

        return await _accessTokenProvider.GetAccessTokenAsync(_tokenScope, ct);
    }

    // ---------- Core request with retry + circuit breaker ----------

    private async Task<AgentResult<T>> RequestAsync<T>(
        HttpMethod method, string path, object? body = null, string? traceId = null)
    {
        if (IsCircuitOpen())
        {
            _logger.LogError("agent request rejected — circuit breaker open (traceId={TraceId}, method={Method})",
                traceId, method);
            return new AgentResult<T>
            {
                Ok = false,
                Status = 503,
                Error = new ErrorResponse("circuit_open", "Agent container circuit breaker is open. Too many recent failures."),
            };
        }

        AgentResult<T>? lastError = null;
        var start = DateTimeOffset.UtcNow;

        for (var attempt = 0; attempt <= MaxRetries; attempt++)
        {
            try
            {
                using var activity = _activitySource.StartActivity("api.agent.request");
                activity?.SetTag("http.method", method.Method);
                activity?.SetTag("http.route", path);
                using var request = new HttpRequestMessage(method, path);
                if (body != null)
                {
                    request.Content = new StringContent(
                        JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
                }
                await ApplyAuthHeaderAsync(request, CancellationToken.None);
                request.Headers.Accept.ParseAdd("application/json");
                if (traceId != null)
                    request.Headers.TryAddWithoutValidation("x-trace-id", traceId);

                if (attempt == 0)
                {
                    _logger.LogInformation("agent request start (traceId={TraceId}, method={Method})",
                        traceId, method);
                }

                using var response = await _http.SendAsync(request);
                var durationMs = (int)(DateTimeOffset.UtcNow - start).TotalMilliseconds;
                var statusCode = (int)response.StatusCode;

                if (response.IsSuccessStatusCode)
                {
                    RecordSuccess();
                    var data = await response.Content.ReadFromJsonAsync<T>(JsonOptions);
                    _logger.LogInformation("agent request complete (traceId={TraceId}, method={Method}, statusCode={Status}, durationMs={Duration})",
                        traceId, method, statusCode, durationMs);
                    return new AgentResult<T> { Ok = true, Status = statusCode, Data = data };
                }

                // Try to parse error body
                ErrorResponse? errorInfo = null;
                try
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(errorBody);
                    var root = doc.RootElement;
                    var code = root.TryGetProperty("error", out var errObj)
                        ? errObj.TryGetProperty("code", out var c) ? c.GetString() : null
                        : root.TryGetProperty("code", out var topCode) ? topCode.GetString() : null;
                    var message = root.TryGetProperty("error", out var errObj2)
                        ? errObj2.TryGetProperty("message", out var m) ? m.GetString() : null
                        : root.TryGetProperty("message", out var topMsg) ? topMsg.GetString() : null;
                    errorInfo = new ErrorResponse(
                        code ?? "agent_error",
                        message ?? $"Agent returned status {statusCode}");
                }
                catch
                {
                    errorInfo = new ErrorResponse("agent_error", $"Agent returned status {statusCode}");
                }

                // Retry on retryable statuses
                if (IsRetryableStatus(statusCode) && attempt < MaxRetries)
                {
                    _logger.LogWarning("agent request retrying (traceId={TraceId}, method={Method}, statusCode={Status}, attempt={Attempt})",
                        traceId, method, statusCode, attempt + 1);

                    if (statusCode == 429)
                    {
                        if (response.Headers.TryGetValues("Retry-After", out var retryValues))
                        {
                            var retryAfterStr = retryValues.FirstOrDefault();
                            if (retryAfterStr != null && int.TryParse(retryAfterStr, out var delaySec) && delaySec > 0)
                            {
                                await Task.Delay(delaySec * 1000);
                                lastError = new AgentResult<T> { Ok = false, Status = statusCode, Error = errorInfo };
                                continue;
                            }
                        }
                    }

                    await Task.Delay(ComputeDelay(attempt));
                    lastError = new AgentResult<T> { Ok = false, Status = statusCode, Error = errorInfo };
                    continue;
                }

                if (statusCode >= 500 || !response.IsSuccessStatusCode)
                {
                    RecordFailure();
                }

                _logger.LogError("agent request failed (traceId={TraceId}, method={Method}, statusCode={Status}, durationMs={Duration}, errorCode={Error})",
                    traceId, method, statusCode, durationMs, errorInfo?.Code);
                return new AgentResult<T> { Ok = false, Status = statusCode, Error = errorInfo };
            }
            catch (Exception ex)
            {
                RecordFailure();
                var message = ex.Message;
                var durationMs = (int)(DateTimeOffset.UtcNow - start).TotalMilliseconds;

                if (attempt < MaxRetries)
                {
                    _logger.LogWarning("agent request network error — retrying (traceId={TraceId}, method={Method}, attempt={Attempt}, error={Error})",
                        traceId, method, attempt + 1, message);
                    await Task.Delay(ComputeDelay(attempt));
                    lastError = new AgentResult<T>
                    {
                        Ok = false,
                        Status = 502,
                        Error = new ErrorResponse("agent_unreachable", message),
                    };
                    continue;
                }

                _logger.LogError("agent request failed — network error (traceId={TraceId}, method={Method}, durationMs={Duration}, error={Error})",
                    traceId, method, durationMs, message);
                return new AgentResult<T>
                {
                    Ok = false,
                    Status = 502,
                    Error = new ErrorResponse("agent_unreachable", message),
                };
            }
        }

        return lastError ?? new AgentResult<T>
        {
            Ok = false,
            Status = 502,
            Error = new ErrorResponse("agent_unreachable", "Request failed after retries"),
        };
    }
}

/// <summary>Result from the compound startActivityConversation operation.</summary>
public sealed record StartActivityConversationResult(
    string ConversationId,
    string CreatedAt,
    AgentMessage OpeningMessage);
