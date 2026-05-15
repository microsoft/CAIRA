/// <summary>
/// Conversation store — in-memory CRUD for conversation records.
///
/// Separated from the agent orchestration so that:
///   - Conversation management is testable in isolation (no Azure SDK needed)
///   - The workflow runner focuses purely on agent execution
///   - A developer reading the sample can understand state management
///     without wading through SDK/workflow call logic
///
/// The store is the single owner of conversation state. It knows nothing
/// about agents, workflows, or SSE — it only manages records and messages.
///
/// Thread safety: uses ConcurrentDictionary for the conversation map.
/// Individual ConversationRecord mutations (adding messages, updating
/// timestamps) are not locked — acceptable for a teaching sample where
/// concurrent writes to the same conversation are unlikely.
/// </summary>

using System.Collections.Concurrent;
using Microsoft.Agents.AI.Workflows;

namespace CairaAgent;

// ---------------------------------------------------------------------------
// Internal record — mutable fields for conversation chaining
// ---------------------------------------------------------------------------

/// <summary>
/// Internal mutable record for a single conversation.
///
/// Holds CheckpointInfo for multi-turn state management. The checkpoint
/// is captured from SuperStepCompletedEvent after each workflow execution
/// and used to resume the workflow on subsequent messages.
/// </summary>
public sealed class ConversationRecord
{
    public required string Id { get; init; }
    public Dictionary<string, object>? Metadata { get; init; }
    public required string CreatedAt { get; init; }
    public string UpdatedAt { get; set; }
    public string? ActiveSpecialistTool { get; set; }

    /// <summary>
    /// The last workflow checkpoint for multi-turn conversation chaining.
    /// Created after the first message — null until then.
    ///
    /// The CheckpointManager stores the actual state; this is just the
    /// reference (CheckpointId + SessionId) needed to resume.
    /// </summary>
    public CheckpointInfo? LastCheckpoint { get; set; }

    /// <summary>
    /// Accumulated messages (user + assistant) for this conversation.
    /// Returned by GET /conversations/{id} and used for history display.
    /// </summary>
    public List<Message> Messages { get; } = [];

    public ConversationRecord() => UpdatedAt = string.Empty;
}

// ---------------------------------------------------------------------------
// Conversation store
// ---------------------------------------------------------------------------

public class ConversationStore
{
    private readonly ConcurrentDictionary<string, ConversationRecord> _conversations = new();

    // ---- ID generation ----

    /// <summary>
    /// Generate a conversation ID with a "conv_" prefix.
    /// Format: conv_{unixMs}_{random6hex} — human-readable and unique.
    /// </summary>
    private static string NewConversationId()
        => $"conv_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N")[..6]}";

    /// <summary>
    /// Generate a message ID with a "msg_" prefix and a role suffix.
    /// </summary>
    public static string NewMessageId(string role)
        => $"msg_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{role}";

    // ---- CRUD ----

    /// <summary>
    /// Create a new conversation. Returns the public Conversation DTO.
    /// </summary>
    public virtual Conversation Create(Dictionary<string, object>? metadata = null)
    {
        var id = NewConversationId();
        var now = DateTimeOffset.UtcNow.ToString("o");

        var record = new ConversationRecord
        {
            Id = id,
            Metadata = metadata,
            CreatedAt = now,
            UpdatedAt = now,
        };

        _conversations[id] = record;
        return new Conversation(id, now, now, metadata);
    }

    /// <summary>
    /// List conversations with pagination, sorted by updatedAt descending.
    /// </summary>
    public virtual ConversationList List(int offset = 0, int limit = 20)
    {
        var all = _conversations.Values
            .OrderByDescending(r => r.UpdatedAt)
            .ToList();

        var page = all.Skip(offset).Take(limit).ToList();

        return new ConversationList(
            page.Select(r => new Conversation(r.Id, r.CreatedAt, r.UpdatedAt, r.Metadata)).ToList(),
            offset,
            limit,
            all.Count);
    }

    /// <summary>
    /// Get a single conversation with its full message history.
    /// Returns null if not found.
    /// </summary>
    public virtual ConversationDetail? Get(string conversationId)
    {
        if (!_conversations.TryGetValue(conversationId, out var record))
            return null;

        return new ConversationDetail(
            record.Id, record.CreatedAt, record.UpdatedAt,
            [.. record.Messages], record.Metadata);
    }

    /// <summary>
    /// Get the internal mutable record for a conversation.
    /// Used by WorkflowRunner to access the CheckpointInfo and add messages.
    /// Returns null if not found.
    /// </summary>
    public virtual ConversationRecord? GetRecord(string conversationId)
    {
        return _conversations.TryGetValue(conversationId, out var record) ? record : null;
    }

    /// <summary>
    /// Add a message to a conversation's history and update the timestamp.
    /// </summary>
    public void AddMessage(ConversationRecord record, Message message)
    {
        record.Messages.Add(message);
        record.UpdatedAt = DateTimeOffset.UtcNow.ToString("o");
    }
}
