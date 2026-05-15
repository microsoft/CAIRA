/// <summary>
/// Agent setup — how to configure the Microsoft Agent Framework (MAF)
/// on Azure AI Foundry using MAF Workflows.
///
/// The pattern:
///   1. Create a ResponsesClient pointing at Azure OpenAI (or mock)
///   2. Create three discrete specialist agents
///   3. Attach local knowledge tools and resolution tools to each specialist
///   4. Build one workflow executor per specialist
///   5. Create a CheckpointManager for multi-turn conversation state
///
/// Architecture diagram (MAF Workflow with discrete specialists):
///
///     User message
///         |
///         v
///   ┌───────────────────────────────────────────────┐
///   │  MAF Workflow (InProcessExecution)             │
///   │                                               │
///   │  Specialist Executor selected by mode         │
///   │  ├─ lookup_*_knowledge  (local tool)          │
///   │  └─ resolve_*           (lambda tool)         │
///   └───────────────────────────────────────────────┘
///         │
///         v
///   WatchStreamAsync() → IAsyncEnumerable&lt;WorkflowEvent&gt;
///   ├─ AgentResponseUpdateEvent (text deltas → message.delta SSE)
///   ├─ AgentResponseUpdateEvent (FunctionCallContent → resolution detection)
///   └─ SuperStepCompletedEvent (checkpoint for multi-turn state)
///
/// The selected specialist is the conversational agent for the current mode.
///
/// Multi-turn chaining: The MAF CheckpointManager captures the full
/// executor state (including the agent's conversation history) after
/// each super-step. On subsequent messages, ResumeStreamingAsync
/// restores the checkpoint and the conversation continues seamlessly.
/// </summary>

#pragma warning disable OPENAI001 // ResponsesClient is experimental

using System.ComponentModel;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;
using OpenAI.Responses;

namespace CairaAgent;

// ---------------------------------------------------------------------------
// Agent setup result
// ---------------------------------------------------------------------------

/// <summary>
/// The result of agent setup — everything needed to run the workflow.
/// Returns the per-mode workflow map and checkpoint manager. The workflow engine
/// handles execution, streaming events, and state management.
/// </summary>
public sealed class AgentSetupResult
{
    /// <summary>
    /// Legacy default workflow reference kept for compatibility with callers
    /// that still expect a single workflow instance.
    /// </summary>
    public required Workflow? Workflow { get; init; }

    /// <summary>
    /// In-memory checkpoint manager — stores workflow state (including
    /// conversation history) between messages. Each conversation gets its
    /// own checkpoint chain via SuperStepCompletedEvent.CompletionInfo.Checkpoint.
    /// </summary>
    public required CheckpointManager CheckpointManager { get; init; }

    /// <summary>
    /// Workflow per activity mode.
    /// </summary>
    public required IReadOnlyDictionary<string, Workflow> WorkflowsByMode { get; init; }
}

// ---------------------------------------------------------------------------
// Agent setup
// ---------------------------------------------------------------------------

public static class AgentSetup
{
    /// <summary>
    /// Resolution tool name prefix — used to detect resolution tool calls
    /// in AgentResponseUpdateEvent.Update.Contents (FunctionCallContent).
    /// </summary>
    internal const string ResolutionToolPrefix = "resolve_";

    /// <summary>
    /// Create the specialist workflows.
    ///
    /// The pattern:
    ///   1. Create specialist agents with focused instructions
    ///   2. Add local knowledge and resolution tools to each specialist
    ///   3. Build one workflow per specialist using BindAsExecutor(emitEvents: true)
    ///   4. Create CheckpointManager.CreateInMemory() for multi-turn state
    /// </summary>
    public static AgentSetupResult Create(AgentConfig config, ILogger logger)
    {
        var responsesClient = CreateResponsesClient(config);

        var sharedInstructions = config.SharedInstructions.Trim();
        string Compose(string specialistInstructions) => $"{sharedInstructions}\n\n{specialistInstructions}".Trim();

        var discoveryKnowledge = AIFunctionFactory.Create(
            ([Description("What discovery signal, qualification detail, or customer need is needed")] string query) =>
                System.Text.Json.JsonSerializer.Serialize(new { items = KnowledgeBase.LookupDiscovery(query) }),
            "lookup_discovery_knowledge",
            "Retrieve fictional sample discovery guidance and qualification cues.");

        var planningKnowledge = AIFunctionFactory.Create(
            ([Description("What account-planning priority, risk, or next-step detail is needed")] string query) =>
                System.Text.Json.JsonSerializer.Serialize(new { items = KnowledgeBase.LookupPlanning(query) }),
            "lookup_planning_knowledge",
            "Retrieve fictional sample account-planning guidance, risks, and milestones.");

        var staffingKnowledge = AIFunctionFactory.Create(
            ([Description("What staffing role, coverage level, or qualification detail is needed")] string query) =>
                System.Text.Json.JsonSerializer.Serialize(new { items = KnowledgeBase.LookupStaffing(query) }),
            "lookup_staffing_knowledge",
            "Retrieve fictional sample staffing roles, coverage guidance, and qualifications.");

        var resolveDiscovery = AIFunctionFactory.Create(
            (
                [Description("Qualification outcome for the opportunity")] string fit,
                [Description("Number of qualification signals reviewed")] int signals_reviewed,
                [Description("The single most important customer need or buying signal")] string primary_need
            ) =>
            {
                logger.LogInformation("Discovery flow resolved after {SignalsReviewed} signals", signals_reviewed);
                return $"Discovery flow resolved: {fit} after {signals_reviewed} signals.";
            },
            "resolve_discovery",
            "Call this when the discovery activity concludes. Records the fit signal summary using the existing contract.");

        var resolvePlanning = AIFunctionFactory.Create(
            (
                [Description("Whether the plan should advance now")] bool approved,
                [Description("Primary account focus area")] string focus_area,
                [Description("Next milestone, meeting, or workstream")] string next_step
            ) =>
            {
                var outcome = approved ? "Advance" : "Hold";
                logger.LogInformation("Account plan resolved: {Outcome}", outcome);
                return $"Account plan resolved: {outcome} \"{focus_area}\" with next step {next_step}.";
            },
            "resolve_planning",
            "Call this when the account-planning activity concludes. Records the planning outcome using the existing contract.");

        var resolveStaffing = AIFunctionFactory.Create(
            (
                [Description("The recommended coverage level")] string coverage_level,
                [Description("The recommended owner role")] string role,
                [Description("The fictional account team name")] string team_name
            ) =>
            {
                logger.LogInformation("Staffing flow resolved");
                return $"Staffing flow resolved: {coverage_level} {role} on {team_name}.";
            },
            "resolve_staffing",
            "Call this when the staffing conversation concludes. Records the staffing recommendation using the existing contract.");

        var discoveryAgentWithTools = responsesClient.AsAIAgent(
            instructions: Compose(config.DiscoveryInstructions),
            name: "DiscoverySpecialist",
            tools:
            [
                discoveryKnowledge,
                resolveDiscovery,
            ]);

        var planningAgentWithTools = responsesClient.AsAIAgent(
            instructions: Compose(config.PlanningInstructions),
            name: "PlanningSpecialist",
            tools:
            [
                planningKnowledge,
                resolvePlanning,
            ]);

        var staffingAgentWithTools = responsesClient.AsAIAgent(
            instructions: Compose(config.StaffingInstructions),
            name: "StaffingSpecialist",
            tools:
            [
                staffingKnowledge,
                resolveStaffing,
            ]);

        var discoveryBinding = discoveryAgentWithTools.BindAsExecutor(emitEvents: true);
        var planningBinding = planningAgentWithTools.BindAsExecutor(emitEvents: true);
        var staffingBinding = staffingAgentWithTools.BindAsExecutor(emitEvents: true);

        var workflows = new Dictionary<string, Workflow>
        {
            ["discovery"] = new WorkflowBuilder(discoveryBinding)
                .WithOutputFrom(discoveryBinding)
                .Build(),
            ["planning"] = new WorkflowBuilder(planningBinding)
                .WithOutputFrom(planningBinding)
                .Build(),
            ["staffing"] = new WorkflowBuilder(staffingBinding)
                .WithOutputFrom(staffingBinding)
                .Build(),
        };

        // ---- Create checkpoint manager ----
        // CheckpointManager.CreateInMemory() stores workflow state (including
        // the agent's full conversation history) between messages. Each
        // SuperStepCompletedEvent yields a CheckpointInfo that can be used
        // to resume the workflow for the next turn.

        var checkpointManager = CheckpointManager.CreateInMemory();

        logger.LogInformation(
            "Mode-specific MAF workflows initialised (model={Model}, name={AgentName})",
            config.Model, config.AgentName);

        return new AgentSetupResult
        {
            Workflow = workflows["discovery"],
            CheckpointManager = checkpointManager,
            WorkflowsByMode = workflows,
        };
    }

    // ---- Helpers ----

    /// <summary>
    /// Create a ResponsesClient pointing at Azure OpenAI or an APIM gateway.
    ///
    /// Always uses AzureOpenAIClient with a TokenCredential:
    ///   - HTTPS endpoint (production): the runtime-appropriate Azure credential for real
    ///     Azure AD tokens via the cognitiveservices scope
    ///   - HTTP endpoint + SKIP_AUTH (local dev / CI): a static dummy
    ///     token credential — the Azure SDK's AzureTokenAuthenticationPolicy
    ///     has no HTTPS enforcement, so this sends "Bearer dummy" which
    ///     any permissive endpoint accepts
    ///
    /// The agent code path is identical regardless of the target endpoint.
    /// </summary>
    private static OpenAI.Responses.ResponsesClient CreateResponsesClient(AgentConfig config)
    {
        var isHttpEndpoint = config.AzureEndpoint.StartsWith("http://");

        Azure.Core.TokenCredential credential = isHttpEndpoint && config.SkipAuth
            ? new StaticTokenCredential("dummy")
            : CreateAzureCredential();

        var azureClient = new Azure.AI.OpenAI.AzureOpenAIClient(
            new Uri(config.AzureEndpoint),
            credential);
        return azureClient.GetResponsesClient(config.Model);
    }

    private static Azure.Core.TokenCredential CreateAzureCredential()
    {
        var managedIdentityEndpoint = Environment.GetEnvironmentVariable("IDENTITY_ENDPOINT")
            ?? Environment.GetEnvironmentVariable("MSI_ENDPOINT");
        if (!string.IsNullOrWhiteSpace(managedIdentityEndpoint))
        {
            var clientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID");
            return string.IsNullOrWhiteSpace(clientId)
                ? new Azure.Identity.ManagedIdentityCredential()
                : new Azure.Identity.ManagedIdentityCredential(clientId);
        }

        return new Azure.Identity.DefaultAzureCredential();
    }
}

// ---------------------------------------------------------------------------
// Static token credential — dummy bearer token for HTTP endpoints
// ---------------------------------------------------------------------------

/// <summary>
/// A TokenCredential that always returns a fixed token string.
/// Used for HTTP endpoints (local dev / CI) where the Azure SDK's
/// the runtime-selected Azure credential cannot acquire real tokens. Equivalent to
/// the TypeScript pattern: () => Promise.resolve('dummy').
/// </summary>
internal sealed class StaticTokenCredential : Azure.Core.TokenCredential
{
    private readonly Azure.Core.AccessToken _token;

    public StaticTokenCredential(string token)
    {
        _token = new Azure.Core.AccessToken(token, DateTimeOffset.MaxValue);
    }

    public override Azure.Core.AccessToken GetToken(
        Azure.Core.TokenRequestContext requestContext, CancellationToken cancellationToken)
        => _token;

    public override ValueTask<Azure.Core.AccessToken> GetTokenAsync(
        Azure.Core.TokenRequestContext requestContext, CancellationToken cancellationToken)
        => new(_token);
}

// ---------------------------------------------------------------------------
// SSE formatting helper
// ---------------------------------------------------------------------------

/// <summary>
/// Format SSE events as "event: {name}\ndata: {json}\n\n" strings.
/// Shared by WorkflowRunner for all SSE event types.
/// </summary>
internal static class SseFormatter
{
    public static string Format(string eventName, object data)
    {
        return $"event: {eventName}\ndata: {System.Text.Json.JsonSerializer.Serialize(data)}\n\n";
    }
}
