/// <summary>
/// ASP.NET Core Minimal API route definitions for the fictional sales/account-team sample API.
///
/// Maps business endpoints to agent container operations:
///   POST /api/activities/discovery              -> create conv, return syntheticMessage
///   POST /api/activities/planning            -> create conv, return syntheticMessage
///   POST /api/activities/staffing                -> create conv, return syntheticMessage
///   GET  /api/activities/conversations          -> GET  /conversations (enriched)
///   GET  /api/activities/conversations/:id      -> GET  /conversations/:id (enriched)
///   POST /api/activities/conversations/:id/messages -> POST /conversations/:id/messages (SSE parsed)
///   GET  /api/activities/stats               -> computed from conversations
///   GET  /health                         -> checks agent /health
///   GET  /health/deep                    -> auth-required check of agent business endpoint
/// </summary>

using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace CairaApi;

public static class Routes
{
    // ---------- In-memory conversation state ----------

    internal static readonly ConcurrentDictionary<string, ActivityConversationRecord> ActivityConversationStore = new();

    // ---------- Synthetic first messages ----------

    private static readonly Dictionary<string, string> SyntheticMessages = new()
    {
        ["discovery"] = "I am qualifying a new customer opportunity. Lead a short discovery conversation, ask targeted questions, and conclude with a concise qualification summary.",
        ["planning"] = "I need an account plan for an active customer. Guide me through priorities, risks, and next steps, then conclude with a concise planning summary.",
        ["staffing"] = "I need to staff an account team for a customer engagement. Interview me for the needed context and conclude with a clear staffing recommendation.",
    };

    // ---------- Route registration ----------

    public static void MapRoutes(this WebApplication app)
    {
        // ---- Health ----
        app.MapGet("/health", async (AgentHttpClient agentClient) =>
        {
            var start = DateTimeOffset.UtcNow;
            var result = await agentClient.CheckHealthAsync();
            var latencyMs = (int)(DateTimeOffset.UtcNow - start).TotalMilliseconds;

            var agentStatus = result.Ok ? "healthy" : "unhealthy";
            var overallStatus = result.Ok ? "healthy" : "degraded";

            var health = new HealthResponse(overallStatus,
                [new DependencyHealth("agent-container", agentStatus, latencyMs)]);

            return overallStatus == "healthy"
                ? Results.Ok(health)
                : Results.Json(health, statusCode: 503);
        });

        app.MapGet("/health/deep", async (AgentHttpClient agentClient) =>
        {
            var start = DateTimeOffset.UtcNow;
            var result = await agentClient.ListConversationsAsync(0, 1);
            var latencyMs = (int)(DateTimeOffset.UtcNow - start).TotalMilliseconds;

            var agentStatus = result.Ok ? "healthy" : "unhealthy";
            var overallStatus = result.Ok ? "healthy" : "degraded";

            var health = new HealthResponse(overallStatus,
                [new DependencyHealth("agent-container-auth", agentStatus, latencyMs)]);

            return overallStatus == "healthy"
                ? Results.Ok(health)
                : Results.Json(health, statusCode: 503);
        });

        app.MapGet("/identity", async (IAccessTokenProvider tokenProvider, ILogger<AgentHttpClient> logger) =>
        {
            try
            {
                var token = await tokenProvider.GetAccessTokenAsync("https://management.azure.com/.default");
                var claims = DecodeJwtPayload(token);

                return Results.Ok(new IdentityResponse(
                    Authenticated: true,
                    Identity: new IdentityInfo(
                        TenantId: GetClaimString(claims, "tid"),
                        ObjectId: GetClaimString(claims, "oid"),
                        DisplayName: GetClaimString(claims, "name") ?? GetClaimString(claims, "appid"),
                        Type: InferIdentityType(claims))));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to get identity");
                return Results.Ok(new IdentityResponse(
                    Authenticated: false,
                    Reason: $"Credential error: {ex.Message}"));
            }
        });

        // ---- Business operations: start conversation ----
        app.MapPost("/api/activities/discovery", (AgentHttpClient agentClient) =>
            HandleStartActivityConversation("discovery", agentClient));

        app.MapPost("/api/activities/planning", (AgentHttpClient agentClient) =>
            HandleStartActivityConversation("planning", agentClient));

        app.MapPost("/api/activities/staffing", (AgentHttpClient agentClient) =>
            HandleStartActivityConversation("staffing", agentClient));

        // ---- GET /api/activities/conversations ----
        app.MapGet("/api/activities/conversations", async (AgentHttpClient agentClient, int? offset, int? limit) =>
        {
            var result = await agentClient.ListConversationsAsync(offset, limit);
            if (!result.Ok || result.Data == null)
            {
                var status = AgentHttpClient.MapAgentStatus(result.Status);
                return Results.Json(
                    result.Error ?? new ErrorResponse("agent_error", "Failed to list conversations"),
                    statusCode: status);
            }

            var conversations = result.Data.Items
                .Select(c => ConversationToActivityConversation(c, ActivityConversationStore.GetValueOrDefault(c.Id)))
                .ToList();

            return Results.Ok(new ActivityConversationList(conversations, result.Data.Offset, result.Data.Limit, result.Data.Total));
        });

        // ---- GET /api/activities/conversations/{conversationId} ----
        app.MapGet("/api/activities/conversations/{conversationId}", async (string conversationId, AgentHttpClient agentClient) =>
        {
            var result = await agentClient.GetConversationAsync(conversationId);
            if (!result.Ok || result.Data == null)
            {
                var status = AgentHttpClient.MapAgentStatus(result.Status);
                return Results.Json(
                    result.Error ?? new ErrorResponse("agent_error", "Failed to get activity conversation"),
                    statusCode: status);
            }

            var detail = ConversationDetailToActivityConversationDetail(result.Data, ActivityConversationStore.GetValueOrDefault(conversationId));
            return Results.Ok(detail);
        });

        // ---- POST /api/activities/conversations/{conversationId}/messages ----
        app.MapPost("/api/activities/conversations/{conversationId}/messages", async (
            string conversationId,
            HttpContext httpContext,
            AgentHttpClient agentClient,
            ILogger<AgentHttpClient> logger) =>
        {
            var traceId = Guid.NewGuid().ToString();
            var acceptHeader = httpContext.Request.Headers.Accept.ToString();
            var wantsStream = acceptHeader.Contains("text/event-stream");

            // Read body
            MessageRequest? body;
            try
            {
                body = await httpContext.Request.ReadFromJsonAsync<MessageRequest>();
            }
            catch
            {
                body = null;
            }

            if (body == null || string.IsNullOrEmpty(body.Message))
            {
                return Results.Json(new ErrorResponse("bad_request", "Missing required field: message"), statusCode: 400);
            }

            logger.LogInformation("message request (traceId={TraceId}, mode={Mode})",
                traceId, wantsStream ? "stream" : "json");

            if (wantsStream)
            {
                // SSE streaming with outcome capture
                return Results.Stream(async stream =>
                {
                    try
                    {
                        using var response = await agentClient.SendMessageStreamAsync(conversationId, body.Message, traceId);

                        if (!response.IsSuccessStatusCode)
                        {
                            var status = AgentHttpClient.MapAgentStatus((int)response.StatusCode);
                            var errorJson = JsonSerializer.Serialize(new ErrorResponse("agent_error", $"Agent returned status {(int)response.StatusCode}"));
                            await stream.WriteAsync(Encoding.UTF8.GetBytes($"event: error\ndata: {errorJson}\n\n"));
                            return;
                        }

                        using var agentStream = await response.Content.ReadAsStreamAsync();
                        var outcome = await PipeSSEAndCaptureActivityOutcome(agentStream, stream);

                        if (outcome != null)
                        {
                            if (ActivityConversationStore.TryGetValue(conversationId, out var record))
                            {
                                record.Status = "resolved";
                                record.Outcome = outcome;
                            }
                        }

                        logger.LogInformation("message SSE complete (traceId={TraceId}, resolved={Resolved})",
                            traceId, outcome != null);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "message SSE failed — connection error (traceId={TraceId})",
                            traceId);
                        var errorJson = JsonSerializer.Serialize(new ErrorResponse("agent_unreachable", "Failed to connect to agent container for streaming"));
                        await stream.WriteAsync(Encoding.UTF8.GetBytes($"event: error\ndata: {errorJson}\n\n"));
                    }
                }, contentType: "text/event-stream");
            }
            else
            {
                // JSON response
                var result = await agentClient.SendMessageAsync(conversationId, body.Message, traceId);
                if (!result.Ok || result.Data == null)
                {
                    var status = AgentHttpClient.MapAgentStatus(result.Status);
                    return Results.Json(
                        result.Error ?? new ErrorResponse("agent_error", "Failed to send message"),
                        statusCode: status);
                }

                if (result.Data.Resolution != null)
                {
                    if (ActivityConversationStore.TryGetValue(conversationId, out var record))
                    {
                        record.Status = "resolved";
                        record.Outcome = new ActivityOutcome(result.Data.Resolution.Tool, result.Data.Resolution.Result);
                    }
                }

                var message = AgentMessageToActivityMessage(result.Data);
                return Results.Ok(message);
            }
        });

        // ---- GET /api/activities/stats ----
        app.MapGet("/api/activities/stats", async (AgentHttpClient agentClient) =>
        {
            var result = await agentClient.ListConversationsAsync(0, 100);
            if (!result.Ok || result.Data == null)
            {
                var status = AgentHttpClient.MapAgentStatus(result.Status);
                return Results.Json(
                    result.Error ?? new ErrorResponse("agent_error", "Failed to get conversation stats"),
                    statusCode: status);
            }

            var counts = new Dictionary<string, int[]>
            {
                ["discovery"] = [0, 0, 0],  // total, active, resolved
                ["planning"] = [0, 0, 0],
                ["staffing"] = [0, 0, 0],
            };

            var totalConversations = 0;
            var activeConversations = 0;
            var resolvedConversations = 0;

            foreach (var conv in result.Data.Items)
            {
                var record = ActivityConversationStore.GetValueOrDefault(conv.Id);
                var mode = record?.Mode ?? ExtractModeFromMetadata(conv.Metadata);
                var advStatus = record?.Status ?? "active";

                totalConversations++;
                if (!counts.TryGetValue(mode, out var modeArr))
                {
                    modeArr = [0, 0, 0];
                    counts[mode] = modeArr;
                }

                modeArr[0]++;
                if (advStatus == "resolved")
                {
                    resolvedConversations++;
                    modeArr[2]++;
                }
                else
                {
                    activeConversations++;
                    modeArr[1]++;
                }
            }

            var byMode = counts.ToDictionary(
                kv => kv.Key,
                kv => new ModeStats(kv.Value[0], kv.Value[1], kv.Value[2]));

            return Results.Ok(new ActivityStats(totalConversations, activeConversations, resolvedConversations, byMode));
        });
    }

    // ---------- Helpers ----------

    private static async Task<IResult> HandleStartActivityConversation(string mode, AgentHttpClient agentClient)
    {
        var traceId = Guid.NewGuid().ToString();
        var syntheticMessage = SyntheticMessages[mode];
        var metadata = new Dictionary<string, object> { ["mode"] = mode };

        // Only create the conversation — do NOT send the first message.
        // The frontend will send syntheticMessage via the streaming message endpoint.
        var createResult = await agentClient.CreateConversationAsync(metadata, traceId);
        if (!createResult.Ok || createResult.Data == null)
        {
            var status = AgentHttpClient.MapAgentStatus(createResult.Status);
            return Results.Json(
                createResult.Error ?? new ErrorResponse("agent_error", "Failed to start activity conversation"),
                statusCode: status);
        }

        var data = createResult.Data;
        var record = new ActivityConversationRecord { Mode = mode };
        ActivityConversationStore[data.Id] = record;

        var response = new ActivityConversationStarted(
            data.Id, mode, record.Status,
            syntheticMessage,
            data.CreatedAt);

        return Results.Json(response, statusCode: 201);
    }

    private static ActivityConversation ConversationToActivityConversation(
        AgentConversation conv, ActivityConversationRecord? record)
    {
        var mode = record?.Mode ?? ExtractModeFromMetadata(conv.Metadata);
        var status = record?.Status ?? "active";
        return new ActivityConversation(conv.Id, mode, status, record?.Outcome,
            conv.CreatedAt, conv.UpdatedAt, 0);
    }

    private static ActivityConversationDetail ConversationDetailToActivityConversationDetail(
        AgentConversationDetail detail, ActivityConversationRecord? record)
    {
        var mode = record?.Mode ?? ExtractModeFromMetadata(detail.Metadata);
        var status = record?.Status ?? "active";
        return new ActivityConversationDetail(detail.Id, mode, status, record?.Outcome,
            detail.CreatedAt, detail.UpdatedAt, detail.Messages.Count,
            detail.Messages.Select(AgentMessageToActivityMessage).ToList());
    }

    private static ActivityMessage AgentMessageToActivityMessage(AgentMessage msg)
    {
        ActivityOutcome? resolution = msg.Resolution != null
            ? new ActivityOutcome(msg.Resolution.Tool, msg.Resolution.Result)
            : null;
        return new ActivityMessage(msg.Id, msg.Role, msg.Content, msg.CreatedAt, msg.Usage, resolution);
    }

    private static string ExtractModeFromMetadata(Dictionary<string, object>? metadata)
    {
        if (metadata != null && metadata.TryGetValue("mode", out var modeObj))
        {
            var mode = modeObj?.ToString();
            if (mode is "discovery" or "planning" or "staffing") return mode;
        }
        return "discovery"; // fallback
    }

    /// <summary>
    /// Pipe SSE stream from agent to client while capturing activity.resolved events.
    /// </summary>
    private static async Task<ActivityOutcome?> PipeSSEAndCaptureActivityOutcome(
        Stream agentStream, Stream clientStream)
    {
        ActivityOutcome? captured = null;
        var buffer = new byte[8192];
        var textBuffer = new StringBuilder();
        string? eventType = null;

        int bytesRead;
        while ((bytesRead = await agentStream.ReadAsync(buffer)) > 0)
        {
            // Write raw bytes to client immediately
            await clientStream.WriteAsync(buffer.AsMemory(0, bytesRead));
            await clientStream.FlushAsync();

            // Parse for activity.resolved events
            var chunk = Encoding.UTF8.GetString(buffer, 0, bytesRead);
            textBuffer.Append(chunk);

            // Process complete lines
            var text = textBuffer.ToString();
            var lines = text.Split('\n');
            // Keep the last partial line in the buffer
            textBuffer.Clear();
            textBuffer.Append(lines[^1]);

            for (var i = 0; i < lines.Length - 1; i++)
            {
                var line = lines[i];
                if (line.StartsWith("event: "))
                {
                    eventType = line[7..].Trim();
                }
                else if (line.StartsWith("data: ") && eventType == "activity.resolved")
                {
                    try
                    {
                        var data = JsonSerializer.Deserialize<ActivityOutcome>(line[6..]);
                        if (data != null) captured = data;
                    }
                    catch (JsonException)
                    {
                        // Malformed JSON — skip
                    }
                    eventType = null;
                }
                else if (line.Length == 0)
                {
                    eventType = null;
                }
            }
        }

        return captured;
    }

    private static JsonObject DecodeJwtPayload(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            return [];
        }

        var payload = parts[1].Replace('-', '+').Replace('_', '/');
        payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');

        try
        {
            return JsonNode.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload))) as JsonObject ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
        catch (FormatException)
        {
            return [];
        }
    }

    private static string? GetClaimString(JsonObject claims, string name) =>
        claims.TryGetPropertyValue(name, out var value) ? value?.GetValue<string>() : null;

    private static string InferIdentityType(JsonObject claims)
    {
        if (claims.ContainsKey("xms_mirid"))
        {
            return "managedIdentity";
        }

        if (claims.ContainsKey("appid") && !claims.ContainsKey("name"))
        {
            return "servicePrincipal";
        }

        return claims.ContainsKey("name") ? "user" : "unknown";
    }
}
