/// <summary>
/// Tests for AgentHttpClient — retry logic, circuit breaker, status mapping, health check.
///
/// Mirrors the TypeScript agent-client.test.ts patterns:
///   - Status mapping (MapAgentStatus)
///   - Retry with exponential backoff on 429/502/503
///   - Circuit breaker opens after threshold failures, rejects requests
///   - Health check success and failure paths
///   - Conversation CRUD pass-through
///
/// Uses a custom MockHttpMessageHandler to simulate agent responses without
/// hitting any real HTTP endpoints.
/// </summary>

using System.Net;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace CairaApi.Tests;

/// <summary>
/// A programmable HttpMessageHandler for testing.
/// Queue up responses; they are returned in FIFO order.
/// </summary>
internal sealed class MockHttpHandler : HttpMessageHandler
{
    private readonly Queue<HttpResponseMessage> _responses = new();
    private readonly List<HttpRequestMessage> _requests = new();

    public IReadOnlyList<HttpRequestMessage> Requests => _requests;
    public int CallCount => _requests.Count;

    public void Enqueue(HttpResponseMessage response) => _responses.Enqueue(response);

    public void Enqueue(HttpStatusCode status, object? body = null)
    {
        var msg = new HttpResponseMessage(status);
        if (body != null)
        {
            msg.Content = new StringContent(
                JsonSerializer.Serialize(body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }),
                Encoding.UTF8, "application/json");
        }
        _responses.Enqueue(msg);
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        _requests.Add(request);
        if (_responses.Count == 0)
            throw new InvalidOperationException($"No queued responses for request #{_requests.Count}: {request.Method} {request.RequestUri}");
        return Task.FromResult(_responses.Dequeue());
    }
}

public class AgentHttpClientTests
{
    private static ApiConfig CreateConfig(bool skipAuth = true, string? agentTokenScope = null) => new()
    {
        AgentServiceUrl = "http://localhost:3000",
        SkipAuth = skipAuth,
        AgentTokenScope = agentTokenScope,
    };

    private sealed class FakeAccessTokenProvider(Func<CancellationToken, Task<string>> getToken)
        : IAccessTokenProvider
    {
        public Task<string> GetAccessTokenAsync(string scope, CancellationToken cancellationToken = default)
            => getToken(cancellationToken);
    }

    private static (AgentHttpClient client, MockHttpHandler handler) CreateClient(
        ApiConfig? config = null,
        Func<CancellationToken, Task<string>>? getTokenOverride = null)
    {
        var handler = new MockHttpHandler();
        var http = new HttpClient(handler);
        var effectiveConfig = config ?? CreateConfig();
        var logger = Mock.Of<ILogger<AgentHttpClient>>();
        var accessTokenProvider = new FakeAccessTokenProvider(getTokenOverride ?? (_ => Task.FromResult("unused-token")));
        var client = new AgentHttpClient(http, effectiveConfig, logger, accessTokenProvider, new ActivitySource("CairaApi.Tests"));
        return (client, handler);
    }

    // ========================================================================
    // MapAgentStatus
    // ========================================================================

    [Theory]
    [InlineData(400, 400)]
    [InlineData(401, 502)]
    [InlineData(404, 404)]
    [InlineData(429, 429)]
    [InlineData(500, 502)]
    [InlineData(502, 502)]
    [InlineData(503, 503)]
    [InlineData(504, 502)]
    [InlineData(200, 200)]
    [InlineData(201, 201)]
    public void MapAgentStatus_MapsCorrectly(int input, int expected)
    {
        Assert.Equal(expected, AgentHttpClient.MapAgentStatus(input));
    }

    // ========================================================================
    // Health check
    // ========================================================================

    [Fact]
    public async Task CheckHealth_ReturnsHealthyOnSuccess()
    {
        var (client, handler) = CreateClient();
        handler.Enqueue(HttpStatusCode.OK,
            new { status = "healthy", checks = new[] { new { name = "azure-openai", status = "healthy" } } });

        var result = await client.CheckHealthAsync();

        Assert.True(result.Ok);
        Assert.Equal(200, result.Status);
        Assert.NotNull(result.Data);
        Assert.Equal("healthy", result.Data!.Status);
    }

    [Fact]
    public async Task CheckHealth_Returns503WhenAgentUnreachable()
    {
        var (client, handler) = CreateClient();
        // Simulate connection failure by enqueuing nothing — handler will throw
        // Actually, let's use a handler that throws
        var throwHandler = new ThrowingHttpHandler();
        var http = new HttpClient(throwHandler);
        var errClient = new AgentHttpClient(http, CreateConfig(), Mock.Of<ILogger<AgentHttpClient>>(), null, new ActivitySource("CairaApi.Tests"));

        var result = await errClient.CheckHealthAsync();

        Assert.False(result.Ok);
        Assert.Equal(503, result.Status);
        Assert.NotNull(result.Error);
        Assert.Equal("agent_unreachable", result.Error!.Code);
    }

    [Fact]
    public async Task CheckHealth_FailsWhenAuthEnabledWithoutScope()
    {
        var (client, handler) = CreateClient(CreateConfig(skipAuth: false));

        var result = await client.CheckHealthAsync();

        Assert.False(result.Ok);
        Assert.Equal(503, result.Status);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task CheckHealth_SendsProvidedBearerWhenTokenProviderConfigured()
    {
        var (client, handler) = CreateClient(
            CreateConfig(skipAuth: false, agentTokenScope: "api://scope/.default"),
            _ => Task.FromResult("test-token-123"));
        handler.Enqueue(HttpStatusCode.OK, new { status = "healthy" });

        var result = await client.CheckHealthAsync();

        Assert.True(result.Ok);
        var auth = handler.Requests[0].Headers.Authorization;
        Assert.NotNull(auth);
        Assert.Equal("Bearer", auth!.Scheme);
        Assert.Equal("test-token-123", auth.Parameter);
    }

    [Fact]
    public async Task CheckHealth_FailsWhenTokenProviderFails()
    {
        var (client, handler) = CreateClient(
            CreateConfig(skipAuth: false, agentTokenScope: "api://scope/.default"),
            _ => Task.FromException<string>(new InvalidOperationException("token failure")));

        var result = await client.CheckHealthAsync();

        Assert.False(result.Ok);
        Assert.Equal(503, result.Status);
        Assert.Empty(handler.Requests);
    }

    // ========================================================================
    // Conversation CRUD
    // ========================================================================

    [Fact]
    public async Task CreateConversation_ReturnsConversationOnSuccess()
    {
        var (client, handler) = CreateClient();
        handler.Enqueue(HttpStatusCode.Created, new
        {
            id = "conv_123",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
        });

        var result = await client.CreateConversationAsync();

        Assert.True(result.Ok);
        Assert.Equal(201, result.Status);
        Assert.NotNull(result.Data);
        Assert.Equal("conv_123", result.Data!.Id);
    }

    [Fact]
    public async Task ListConversations_PassesQueryParams()
    {
        var (client, handler) = CreateClient();
        handler.Enqueue(HttpStatusCode.OK, new
        {
            items = Array.Empty<object>(),
            offset = 5,
            limit = 10,
            total = 0,
        });

        var result = await client.ListConversationsAsync(offset: 5, limit: 10);

        Assert.True(result.Ok);
        var request = handler.Requests[0];
        Assert.Contains("offset=5", request.RequestUri!.ToString());
        Assert.Contains("limit=10", request.RequestUri!.ToString());
    }

    [Fact]
    public async Task GetConversation_Returns404WhenNotFound()
    {
        var (client, handler) = CreateClient();
        handler.Enqueue(HttpStatusCode.NotFound, new { code = "not_found", message = "Not found" });

        var result = await client.GetConversationAsync("conv_missing");

        Assert.False(result.Ok);
        Assert.Equal(404, result.Status);
    }

    [Fact]
    public async Task SendMessage_ReturnsMessageOnSuccess()
    {
        var (client, handler) = CreateClient();
        handler.Enqueue(HttpStatusCode.OK, new
        {
            id = "msg_1",
            role = "assistant",
            content = "Hello!",
            createdAt = "2026-01-01T00:00:00Z",
        });

        var result = await client.SendMessageAsync("conv_123", "Hello");

        Assert.True(result.Ok);
        Assert.NotNull(result.Data);
        Assert.Equal("msg_1", result.Data!.Id);
        Assert.Equal("assistant", result.Data.Role);
    }

    // ========================================================================
    // Retry behaviour
    // ========================================================================

    [Fact]
    public async Task Retry_RetriesOn503ThenSucceeds()
    {
        var (client, handler) = CreateClient();

        // First attempt: 503
        handler.Enqueue(HttpStatusCode.ServiceUnavailable, new { code = "unavailable", message = "Retry later" });
        // Second attempt: 200
        handler.Enqueue(HttpStatusCode.OK, new
        {
            id = "conv_1",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
        });

        var result = await client.CreateConversationAsync();

        Assert.True(result.Ok);
        Assert.Equal(2, handler.CallCount); // initial + 1 retry
    }

    [Fact]
    public async Task Retry_RetriesOn429ThenSucceeds()
    {
        var (client, handler) = CreateClient();

        handler.Enqueue(HttpStatusCode.TooManyRequests, new { code = "rate_limited", message = "Slow down" });
        handler.Enqueue(HttpStatusCode.OK, new
        {
            id = "conv_1",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
        });

        var result = await client.CreateConversationAsync();

        Assert.True(result.Ok);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task Retry_DoesNotRetryOn400()
    {
        var (client, handler) = CreateClient();
        handler.Enqueue(HttpStatusCode.BadRequest, new { code = "bad_request", message = "Invalid" });

        var result = await client.CreateConversationAsync();

        Assert.False(result.Ok);
        Assert.Equal(400, result.Status);
        Assert.Equal(1, handler.CallCount); // no retry
    }

    [Fact]
    public async Task Retry_RetriesUpToMaxRetriesThenFails()
    {
        var (client, handler) = CreateClient();

        // 4 responses: initial + 3 retries = all 503
        for (var i = 0; i < 4; i++)
            handler.Enqueue(HttpStatusCode.ServiceUnavailable, new { code = "unavailable", message = "Down" });

        var result = await client.CreateConversationAsync();

        Assert.False(result.Ok);
        Assert.Equal(4, handler.CallCount); // 1 initial + 3 retries
    }

    [Fact]
    public async Task Retry_RetriesOnNetworkErrorThenSucceeds()
    {
        // Use a custom handler that fails once then succeeds
        var failOnceHandler = new FailOnceThenSucceedHandler(new
        {
            id = "conv_1",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
        });
        var http = new HttpClient(failOnceHandler);
        var client = new AgentHttpClient(http, CreateConfig(), Mock.Of<ILogger<AgentHttpClient>>(), null, new ActivitySource("CairaApi.Tests"));

        var result = await client.CreateConversationAsync();

        Assert.True(result.Ok);
        Assert.Equal(2, failOnceHandler.CallCount);
    }

    // ========================================================================
    // Circuit breaker
    // ========================================================================

    [Fact]
    public async Task CircuitBreaker_OpensAfterThresholdFailures()
    {
        var (client, handler) = CreateClient();

        // 5 failures with non-retryable errors (to avoid retry expanding call count)
        // Use 400 which doesn't retry but still records failure for 500+ check
        // Actually, looking at the code: RecordFailure() is called for statusCode >= 500
        // AND on catch (network error). Let's use network errors.

        // Actually, use a handler that always throws for the first 5, then returns 503 for the circuit test
        var alwaysFailHandler = new AlwaysFailHandler();
        var http = new HttpClient(alwaysFailHandler);
        var errClient = new AgentHttpClient(http, CreateConfig(), Mock.Of<ILogger<AgentHttpClient>>(), null, new ActivitySource("CairaApi.Tests"));

        // Make 5 requests that fail with network errors (each exhausts 4 attempts = 1+3 retries)
        // After 4 attempts * RecordFailure() each = failures accumulate quickly
        // FailureThreshold is 5, so after 5 RecordFailure() calls, circuit opens.
        // First request: 4 attempts = 4 failures → not yet open (threshold=5)
        await errClient.CreateConversationAsync();
        // Second request: 4 more failures → total 8, circuit opened at failure #5
        var result = await errClient.CreateConversationAsync();

        // At this point circuit should be open. Next request should be rejected immediately.
        var circuitResult = await errClient.CreateConversationAsync();

        Assert.False(circuitResult.Ok);
        Assert.Equal(503, circuitResult.Status);
        Assert.NotNull(circuitResult.Error);
        Assert.Equal("circuit_open", circuitResult.Error!.Code);
    }

    // ========================================================================
    // StartActivityConversation (compound operation)
    // ========================================================================

    [Fact]
    public async Task StartActivityConversation_CreatesConversationAndSendsMessage()
    {
        var (client, handler) = CreateClient();

        // First call: create conversation
        handler.Enqueue(HttpStatusCode.Created, new
        {
            id = "conv_adv_1",
            createdAt = "2026-01-01T00:00:00Z",
            updatedAt = "2026-01-01T00:00:00Z",
        });

        // Second call: send message
        handler.Enqueue(HttpStatusCode.OK, new
        {
            id = "msg_1",
            role = "assistant",
            content = "Hello there!",
            createdAt = "2026-01-01T00:00:00Z",
        });

        var result = await client.StartActivityConversationAsync("Test message",
            new Dictionary<string, object> { ["mode"] = "discovery" });

        Assert.True(result.Ok);
        Assert.Equal(201, result.Status);
        Assert.NotNull(result.Data);
        Assert.Equal("conv_adv_1", result.Data!.ConversationId);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task StartActivityConversation_ReturnsErrorWhenCreateFails()
    {
        var (client, handler) = CreateClient();

        // Create conversation fails with 500 (non-retryable mapped to 502)
        // Use 400 to avoid retries
        handler.Enqueue(HttpStatusCode.BadRequest, new { code = "bad_request", message = "Bad" });

        var result = await client.StartActivityConversationAsync("Test");

        Assert.False(result.Ok);
        Assert.Equal(1, handler.CallCount); // only the create attempt
    }

    // ========================================================================
    // SSE streaming
    // ========================================================================

    [Fact]
    public async Task SendMessageStream_ReturnsRawResponse()
    {
        var (client, handler) = CreateClient();
        var sseContent = "event: message.delta\ndata: {\"delta\":\"Hello\"}\n\nevent: message.complete\ndata: {\"id\":\"msg_1\"}\n\n";
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(sseContent, Encoding.UTF8, "text/event-stream"),
        };
        handler.Enqueue(response);

        var httpResponse = await client.SendMessageStreamAsync("conv_1", "Hello");

        Assert.True(httpResponse.IsSuccessStatusCode);
        var body = await httpResponse.Content.ReadAsStringAsync();
        Assert.Contains("message.delta", body);
        Assert.Contains("message.complete", body);
    }
}

// ========================================================================
// Helper handlers
// ========================================================================

/// <summary>Handler that always throws (simulates network unreachable).</summary>
internal sealed class ThrowingHttpHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        throw new HttpRequestException("Connection refused");
    }
}

/// <summary>Handler that always throws (for circuit breaker testing).</summary>
internal sealed class AlwaysFailHandler : HttpMessageHandler
{
    public int CallCount { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        CallCount++;
        throw new HttpRequestException("Simulated network failure");
    }
}

/// <summary>Handler that throws on the first call, then returns success.</summary>
internal sealed class FailOnceThenSucceedHandler : HttpMessageHandler
{
    private readonly object _successBody;
    public int CallCount { get; private set; }

    public FailOnceThenSucceedHandler(object successBody) => _successBody = successBody;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        CallCount++;
        if (CallCount == 1)
            throw new HttpRequestException("Simulated transient failure");

        var json = JsonSerializer.Serialize(_successBody, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Created)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        });
    }
}
