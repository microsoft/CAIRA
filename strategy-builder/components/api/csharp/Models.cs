/// <summary>
/// Types matching contracts/backend-api.openapi.yaml and contracts/agent-api.openapi.yaml.
/// </summary>

using System.Text.Json.Serialization;

namespace CairaApi;

// ---------- Agent API types (received from agent container) ----------

public sealed record AgentConversation(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("updatedAt")] string UpdatedAt,
    [property: JsonPropertyName("metadata")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    Dictionary<string, object>? Metadata = null);

public sealed record AgentConversationList(
    [property: JsonPropertyName("items")] List<AgentConversation> Items,
    [property: JsonPropertyName("offset")] int Offset,
    [property: JsonPropertyName("limit")] int Limit,
    [property: JsonPropertyName("total")] int Total);

public sealed record AgentConversationDetail(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("updatedAt")] string UpdatedAt,
    [property: JsonPropertyName("messages")] List<AgentMessage> Messages,
    [property: JsonPropertyName("metadata")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    Dictionary<string, object>? Metadata = null);

public sealed record AgentMessage(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("content")] string Content,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("usage")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    TokenUsage? Usage = null,
    [property: JsonPropertyName("resolution")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    AgentResolution? Resolution = null);

public sealed record AgentResolution(
    [property: JsonPropertyName("tool")] string Tool,
    [property: JsonPropertyName("result")] Dictionary<string, object> Result);

public sealed record TokenUsage(
    [property: JsonPropertyName("promptTokens")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    int? PromptTokens = null,
    [property: JsonPropertyName("completionTokens")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    int? CompletionTokens = null);

public sealed record AgentHealthResponse(
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("checks")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    List<AgentHealthCheck>? Checks = null);

public sealed record AgentHealthCheck(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("latencyMs")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    int? LatencyMs = null);

// ---------- Business API types (returned to frontend) ----------

public sealed record ActivityConversation(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("mode")] string Mode,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("outcome")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    ActivityOutcome? Outcome,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("lastMessageAt")] string LastMessageAt,
    [property: JsonPropertyName("messageCount")] int MessageCount);

public sealed record ActivityConversationStarted(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("mode")] string Mode,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("syntheticMessage")] string SyntheticMessage,
    [property: JsonPropertyName("createdAt")] string CreatedAt);

public sealed record ActivityConversationDetail(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("mode")] string Mode,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("outcome")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    ActivityOutcome? Outcome,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("lastMessageAt")] string LastMessageAt,
    [property: JsonPropertyName("messageCount")] int MessageCount,
    [property: JsonPropertyName("messages")] List<ActivityMessage> Messages);

public sealed record ActivityConversationList(
    [property: JsonPropertyName("conversations")] List<ActivityConversation> ActivityConversations,
    [property: JsonPropertyName("offset")] int Offset,
    [property: JsonPropertyName("limit")] int Limit,
    [property: JsonPropertyName("total")] int Total);

public sealed record ActivityOutcome(
    [property: JsonPropertyName("tool")] string Tool,
    [property: JsonPropertyName("result")] Dictionary<string, object> Result);

public sealed record ActivityMessage(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("content")] string Content,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("usage")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    TokenUsage? Usage = null,
    [property: JsonPropertyName("resolution")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    ActivityOutcome? Resolution = null);

public sealed record ModeStats(
    [property: JsonPropertyName("total")] int Total,
    [property: JsonPropertyName("active")] int Active,
    [property: JsonPropertyName("resolved")] int Resolved);

public sealed record ActivityStats(
    [property: JsonPropertyName("totalConversations")] int TotalConversations,
    [property: JsonPropertyName("activeConversations")] int ActiveConversations,
    [property: JsonPropertyName("resolvedConversations")] int ResolvedConversations,
    [property: JsonPropertyName("byMode")] Dictionary<string, ModeStats> ByMode);

public sealed record HealthResponse(
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("dependencies")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    List<DependencyHealth>? Dependencies = null);

public sealed record DependencyHealth(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("latencyMs")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    int? LatencyMs = null);

public sealed record IdentityResponse(
    [property: JsonPropertyName("authenticated")] bool Authenticated,
    [property: JsonPropertyName("identity")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    IdentityInfo? Identity = null,
    [property: JsonPropertyName("reason")][property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    string? Reason = null);

public sealed record IdentityInfo(
    [property: JsonPropertyName("tenantId")] string? TenantId,
    [property: JsonPropertyName("objectId")] string? ObjectId,
    [property: JsonPropertyName("displayName")] string? DisplayName,
    [property: JsonPropertyName("type")] string Type);

public sealed record ErrorResponse(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("message")] string Message);

// ---------- Request body types ----------

public sealed record MessageRequest(
    [property: JsonPropertyName("message")] string? Message);

// ---------- Internal state ----------

internal sealed class ActivityConversationRecord
{
    public required string Mode { get; init; }
    public string Status { get; set; } = "active";
    public ActivityOutcome? Outcome { get; set; }
}
