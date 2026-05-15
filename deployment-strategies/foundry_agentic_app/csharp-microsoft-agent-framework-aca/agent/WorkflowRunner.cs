/// <summary>
/// Workflow runner — executes the MAF workflow and maps events to SSE.
///
/// This is where agent execution happens. The runner:
///   1. Accepts a user message and conversation ID
///   2. Opens or resumes a workflow via InProcessExecution
///   3. Sends the user message and a TurnToken to trigger agent execution
///   4. Maps WorkflowEvent → SSE events for the HTTP response
///   5. Captures resolution from FunctionCallContent in update events
///   6. Stores CheckpointInfo from SuperStepCompletedEvent for multi-turn
///
/// Architecture:
///
///   HTTP POST /conversations/{id}/messages
///         |
///         v
///   WorkflowRunner.SendMessageStreamAsync()
///         |
///         v
///   ┌──────────────────────────────────────────────────┐
///   │  InProcessExecution.OffThread                     │
///   │  ├─ First turn: OpenStreamingAsync(workflow)      │
///   │  └─ Next turns: ResumeStreamingAsync(checkpoint)  │
///   │         |                                         │
///   │  TrySendMessageAsync(userMessage)                 │
///   │  TrySendMessageAsync(new TurnToken(emitEvents))   │
///   │         |                                         │
///   │  WatchStreamAsync() → IAsyncEnumerable&lt;WorkflowEvent&gt;
///   │  ├─ AgentResponseUpdateEvent (text)  → message.delta
///   │  ├─ AgentResponseUpdateEvent (tool)  → resolution capture
///   │  └─ SuperStepCompletedEvent          → checkpoint storage
///   └──────────────────────────────────────────────────┘
///
/// Multi-turn: The CheckpointManager preserves the full executor state
/// (including the agent's conversation history) between messages. On
/// subsequent turns, ResumeStreamingAsync restores the checkpoint and
/// the conversation continues with full context.
///
/// Resolution detection: We scan AgentResponseUpdateEvent.Update.Contents
/// for FunctionCallContent where the function name starts with "resolve_".
/// The Arguments dictionary contains the structured resolution data.
/// </summary>

using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;
using System.Diagnostics;
using System.Text;

namespace CairaAgent;

public class WorkflowRunner
{
    private readonly AgentSetupResult _setup;
    private readonly ConversationStore _store;
    private readonly ILogger _logger;
    private readonly ActivitySource _activitySource;

    public WorkflowRunner(AgentSetupResult setup, ConversationStore store, ILogger<WorkflowRunner> logger, ActivitySource activitySource)
    {
        _setup = setup;
        _store = store;
        _logger = logger;
        _activitySource = activitySource;
    }

    // ---------------------------------------------------------------------------
    // Streaming — SSE response
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Execute the workflow for a streaming SSE response.
    ///
    /// The flow:
    ///   1. Record the user message
    ///   2. Open or resume the workflow (first turn vs subsequent)
    ///   3. Send the user message via TrySendMessageAsync
    ///   4. Send a TurnToken to trigger the agent to respond
    ///   5. Watch the event stream and map to SSE events
    ///   6. Capture resolution from FunctionCallContent in update events
    ///   7. Store the checkpoint from SuperStepCompletedEvent for next turn
    ///   8. Emit message.complete and activity.resolved at the end
    /// </summary>
    public virtual async Task SendMessageStreamAsync(
        string conversationId, string content, Func<string, Task> onChunk)
    {
        using var activity = _activitySource.StartActivity("agent.send_message_stream");
        activity?.SetTag("conversation.id", conversationId);

        var record = _store.GetRecord(conversationId);
        if (record == null)
        {
            await onChunk(SseFormatter.Format("error",
                new SseErrorEvent("not_found", "Conversation not found")));
            return;
        }

        _logger.LogInformation("sendMessageStream started");

        // Record user message
        var userMsg = new Message(
            ConversationStore.NewMessageId("user"),
            "user", content, DateTimeOffset.UtcNow.ToString("o"));
        _store.AddMessage(record, userMsg);

        var fullContent = new StringBuilder();
        TokenUsage? usage = null;
        CapturedResolution? resolution = null;
        var specialistTool = ResolveSpecialistTool(record.Metadata);
        record.ActiveSpecialistTool = specialistTool;

        try
        {
            // Open or resume the workflow based on whether we have a checkpoint
            var execution = InProcessExecution.OffThread
                .WithCheckpointing(_setup.CheckpointManager);

            var workflow = ResolveWorkflow(record.Metadata);

            StreamingRun run;
            if (record.LastCheckpoint != null)
            {
                // Subsequent turn — resume from the last checkpoint.
                // This restores the full conversation history.
                run = await execution.ResumeStreamingAsync(
                    workflow, record.LastCheckpoint, CancellationToken.None);
            }
            else
            {
                // First turn — open a fresh workflow execution.
                run = await execution.OpenStreamingAsync(
                    workflow, cancellationToken: CancellationToken.None);
            }

            await using (run)
            {
                await onChunk(SseFormatter.Format("tool.called", new SseToolCalledEvent(specialistTool)));
                // Send the user message to the workflow
                await run.TrySendMessageAsync(content);

                // Send a TurnToken to trigger the agent to generate a response.
                // emitEvents: true ensures AgentResponseUpdateEvent is emitted
                // for each streaming delta.
                await run.TrySendMessageAsync(new TurnToken(emitEvents: true));

                // Watch the event stream and map to SSE
                await foreach (var evt in run.WatchStreamAsync())
                {
                    if (evt is AgentResponseUpdateEvent updateEvt)
                    {
                        // Text deltas → message.delta SSE
                        var delta = updateEvt.Update?.Text;
                        if (delta is { Length: > 0 })
                        {
                            fullContent.Append(delta);
                            await onChunk(SseFormatter.Format("message.delta",
                                new SseDeltaEvent(delta)));
                        }

                        // Resolution detection — scan for FunctionCallContent
                        // with a "resolve_" prefix. The Arguments dictionary
                        // contains the structured resolution data.
                        if (updateEvt.Update?.Contents != null)
                        {
                            foreach (var c in updateEvt.Update.Contents)
                            {
                                if (c is FunctionCallContent fcc
                                    && fcc.Name?.StartsWith(AgentSetup.ResolutionToolPrefix) == true)
                                {
                                    resolution = ExtractResolution(fcc);
                                    _logger.LogDebug(
                                        "Resolution detected from {ToolName} in workflow event",
                                        fcc.Name);
                                }
                            }
                        }

                        // Usage tracking — arrives in Contents as UsageContent
                        var usageContent = updateEvt.Update?.Contents
                            ?.OfType<UsageContent>().FirstOrDefault();
                        if (usageContent?.Details is { } u)
                        {
                            var inputTokens = (int)(u.InputTokenCount ?? 0);
                            var outputTokens = (int)(u.OutputTokenCount ?? 0);
                            usage = new TokenUsage(
                                (usage?.PromptTokens ?? 0) + inputTokens,
                                (usage?.CompletionTokens ?? 0) + outputTokens);
                        }
                    }
                    else if (evt is SuperStepCompletedEvent ssc)
                    {
                        // Store the checkpoint for the next turn.
                        // The checkpoint captures the full executor state
                        // including the agent's conversation history.
                        var checkpoint = ssc.CompletionInfo?.Checkpoint;
                        if (checkpoint != null)
                        {
                            record.LastCheckpoint = checkpoint;
                            _logger.LogDebug("Checkpoint stored for conversation");
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "sendMessageStream error");
            await onChunk(SseFormatter.Format("error",
                new SseErrorEvent("agent_error", ex.Message)));
            return;
        }

        await onChunk(SseFormatter.Format("tool.done", new SseToolDoneEvent(specialistTool)));

        // Emit message.complete SSE event
        var messageId = ConversationStore.NewMessageId("asst");
        var completedContent = fullContent.ToString();
        await onChunk(SseFormatter.Format("message.complete",
            new SseCompleteEvent(messageId, completedContent, usage)));

        // Emit activity.resolved if resolution was captured
        ActivityResolution? activityResolution = null;
        if (resolution != null)
        {
            activityResolution = new ActivityResolution(resolution.Tool, resolution.Result);
            await onChunk(SseFormatter.Format("activity.resolved",
                new SseResolvedEvent(resolution.Tool, resolution.Result)));
        }

        // Record assistant message
        var assistantMsg = new Message(
            messageId, "assistant", completedContent,
            DateTimeOffset.UtcNow.ToString("o"), usage, activityResolution);
        _store.AddMessage(record, assistantMsg);

        _logger.LogInformation(
            "sendMessageStream completed (responseLength={Length}, hasResolution={HasResolution})",
            fullContent.Length, resolution != null);
    }

    // ---------------------------------------------------------------------------
    // Non-streaming — JSON response
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Execute the workflow for a single JSON response (non-streaming).
    ///
    /// Uses the same workflow execution pattern but collects all updates
    /// into a single response instead of streaming them.
    /// </summary>
    public virtual async Task<Message?> SendMessageAsync(
        string conversationId, string content)
    {
        using var activity = _activitySource.StartActivity("agent.send_message");
        activity?.SetTag("conversation.id", conversationId);

        var record = _store.GetRecord(conversationId);
        if (record == null) return null;

        _logger.LogInformation("sendMessage started (contentLength={Length})", content.Length);

        // Record user message
        var userMsg = new Message(
            ConversationStore.NewMessageId("user"),
            "user", content, DateTimeOffset.UtcNow.ToString("o"));
        _store.AddMessage(record, userMsg);

        var fullContent = new StringBuilder();
        TokenUsage? usage = null;
        CapturedResolution? resolution = null;
        var workflow = ResolveWorkflow(record.Metadata);

        try
        {
            var execution = InProcessExecution.OffThread
                .WithCheckpointing(_setup.CheckpointManager);

            StreamingRun run;
            if (record.LastCheckpoint != null)
            {
                run = await execution.ResumeStreamingAsync(
                    workflow, record.LastCheckpoint, CancellationToken.None);
            }
            else
            {
                run = await execution.OpenStreamingAsync(
                    workflow, cancellationToken: CancellationToken.None);
            }

            await using (run)
            {
                await run.TrySendMessageAsync(content);
                await run.TrySendMessageAsync(new TurnToken(emitEvents: true));

                await foreach (var evt in run.WatchStreamAsync())
                {
                    if (evt is AgentResponseUpdateEvent updateEvt)
                    {
                        var delta = updateEvt.Update?.Text;
                        if (delta is { Length: > 0 })
                            fullContent.Append(delta);

                        // Resolution detection
                        if (updateEvt.Update?.Contents != null)
                        {
                            foreach (var c in updateEvt.Update.Contents)
                            {
                                if (c is FunctionCallContent fcc
                                    && fcc.Name?.StartsWith(AgentSetup.ResolutionToolPrefix) == true)
                                {
                                    resolution = ExtractResolution(fcc);
                                }
                            }
                        }

                        // Usage tracking
                        var usageContent = updateEvt.Update?.Contents
                            ?.OfType<UsageContent>().FirstOrDefault();
                        if (usageContent?.Details is { } u)
                        {
                            var inputTokens = (int)(u.InputTokenCount ?? 0);
                            var outputTokens = (int)(u.OutputTokenCount ?? 0);
                            usage = new TokenUsage(
                                (usage?.PromptTokens ?? 0) + inputTokens,
                                (usage?.CompletionTokens ?? 0) + outputTokens);
                        }
                    }
                    else if (evt is SuperStepCompletedEvent ssc)
                    {
                        var checkpoint = ssc.CompletionInfo?.Checkpoint;
                        if (checkpoint != null)
                            record.LastCheckpoint = checkpoint;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "sendMessage error");
            throw;
        }

        // Build resolution
        ActivityResolution? activityResolution = resolution != null
            ? new ActivityResolution(resolution.Tool, resolution.Result)
            : null;

        var assistantMsg = new Message(
            ConversationStore.NewMessageId("asst"),
            "assistant", fullContent.ToString(),
            DateTimeOffset.UtcNow.ToString("o"), usage, activityResolution);
        _store.AddMessage(record, assistantMsg);

        _logger.LogInformation(
            "sendMessage completed (responseLength={Length}, hasResolution={HasResolution})",
            fullContent.Length, resolution != null);

        return assistantMsg;
    }

    // ---------------------------------------------------------------------------
    // Health check
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Check if the agent is ready to handle requests.
    /// </summary>
    public virtual HealthResponse CheckHealth()
    {
        // The workflow is created at startup — if it exists, we're healthy.
        return _setup.WorkflowsByMode.Count > 0
            ? new HealthResponse("healthy",
                [new HealthCheck("azure-openai", "healthy", 0)])
            : new HealthResponse("degraded",
                [new HealthCheck("azure-openai", "unhealthy")]);
    }

    private Workflow ResolveWorkflow(Dictionary<string, object>? metadata)
    {
        var mode = metadata != null && metadata.TryGetValue("mode", out var modeValue)
            ? modeValue?.ToString()
            : null;

        if (mode != null && _setup.WorkflowsByMode.TryGetValue(mode, out var workflow))
        {
            return workflow;
        }

        return _setup.WorkflowsByMode["discovery"];
    }

    private static string ResolveSpecialistTool(Dictionary<string, object>? metadata)
    {
        var mode = metadata != null && metadata.TryGetValue("mode", out var modeValue)
            ? modeValue?.ToString()
            : null;

        return mode switch
        {
            "planning" => "planning_specialist",
            "staffing" => "staffing_specialist",
            _ => "discovery_specialist"
        };
    }

    // ---------------------------------------------------------------------------
    // Resolution extraction
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Extract resolution data from a FunctionCallContent.
    ///
    /// The FunctionCallContent.Arguments is an IDictionary&lt;string, object?&gt;
    /// with the tool's parameter values. We convert to Dictionary&lt;string, object&gt;
    /// for the ActivityResolution model.
    /// </summary>
    private static CapturedResolution? ExtractResolution(FunctionCallContent fcc)
    {
        if (fcc.Name == null) return null;

        var result = new Dictionary<string, object>();
        if (fcc.Arguments != null)
        {
            foreach (var kvp in fcc.Arguments)
            {
                if (kvp.Value != null)
                    result[kvp.Key] = kvp.Value;
            }
        }

        return new CapturedResolution { Tool = fcc.Name, Result = result };
    }
}

// ---------------------------------------------------------------------------
// Captured resolution — simple data holder
// ---------------------------------------------------------------------------

/// <summary>
/// Captured resolution from a resolution tool call detected in workflow events.
/// The resolution is detected by scanning AgentResponseUpdateEvent.Update.Contents
/// for FunctionCallContent with a "resolve_" prefix.
/// </summary>
public sealed class CapturedResolution
{
    public required string Tool { get; init; }
    public required Dictionary<string, object> Result { get; init; }
}
