---
# Core Metadata
title: "Kata: Understanding CAIRA Architecture Patterns"
description: Compare four CAIRA reference architectures and match business requirements to appropriate deployment patterns for Azure AI Foundry
author: HVE Essentials Team
ms.date: 2025-12-02
ms.topic: how-to-guide

# Kata Identity
kata_id: caira-fundamentals-150-understanding-architecture-patterns
kata_category:
  - caira-fundamentals
kata_difficulty: 1
estimated_time_minutes: 30

# Learning Content
learning_objectives:
  - Explain differences between all 4 CAIRA architectures (foundry_basic, foundry_basic_private, foundry_standard, foundry_standard_private)
  - Identify when to use public vs private networking patterns
  - Recognize resource requirements for agent vs non-agent workloads
  - Match business scenarios to appropriate architecture choices
  - Understand cost and security trade-offs between configurations
prerequisite_katas:
  - caira-fundamentals-100-gathering-requirements-with-caira-assistant
technologies:
  - CAIRA
  - Azure AI Foundry
  - Terraform
  - Azure Cosmos DB
  - Azure AI Search
  - Azure Storage
success_criteria:
  - Completed architecture comparison matrix accurately
  - Successfully matched all 5 scenarios to correct architectures
  - Can explain basic vs standard resource differences
  - Understands public vs private networking trade-offs
  - Can articulate when Agent Service requires standard architecture

# AI Coaching
ai_coaching_level: guided
scaffolding_level: medium-heavy
hint_strategy: progressive
common_pitfalls:
  - Confusing basic vs standard with public vs private (two independent dimensions)
  - Assuming all AI workloads require agent-focused resources
  - Not considering networking isolation requirements early
  - Overlooking cost implications of standard architecture dependencies

# Requirements
requires_azure_subscription: false
requires_local_environment: true
requires_github_account: false

# SEO & Discoverability
tags:
  - caira-fundamentals
  - ai-assisted-engineering
search_keywords:
  - CAIRA architecture comparison
  - Azure AI Foundry deployment patterns
  - agent service requirements
  - public vs private networking
  - foundry basic vs standard
real_world_application: Platform engineers evaluate CAIRA reference architectures to select deployment patterns matching organizational security policies, budget constraints, and technical requirements for AI agent workloads
---

<!--
AI_COACH: This kata builds architectural understanding through systematic comparison.
If learners struggle with the four-architecture matrix, guide them to first understand
the two dimensions: basic/standard (agent capability) and public/private (networking).
Encourage use of the CAIRA Assistant chatmode for architecture questions.
-->

## Quick Context

**You'll Learn**: How to systematically compare CAIRA's four reference architectures and match business requirements to appropriate deployment patterns.

**Real Challenge**: Your platform engineering team is preparing deployment standards for multiple AI projects. Some teams need simple generative AI development environments while others require production-ready agent systems with data sovereignty controls. You need to document which CAIRA architecture each scenario requires and justify your recommendations.

**Your Task**: Create an architecture comparison matrix documenting key differences between the four CAIRA configurations, then match five realistic business scenarios to appropriate architectures with clear rationale.

## Essential Setup

**Required** (check these first):

- [ ] CAIRA repository cloned locally (`git clone https://github.com/microsoft/CAIRA.git`)
- [ ] VS Code with GitHub Copilot installed
- [ ] Completed Kata 100 (Gathering Requirements with CAIRA Assistant)
- [ ] Access to CAIRA documentation in `reference_architectures/` folder

**Quick Validation**: Can you navigate to `external/caira/reference_architectures/` and see four folders (foundry_basic, foundry_basic_private, foundry_standard, foundry_standard_private)?

> **🤖 Want Interactive AI Coaching?**
>
> Load the **CAIRA Assistant** chat mode for architecture-specific guidance and validation!
>
> In GitHub Copilot Chat, select **caira-assistant** mode and say:
>
> ```text
> I'm working on Understanding CAIRA Architecture Patterns kata and want help comparing the four reference architectures.
> ```

## Practice Tasks

### Task 1: Explore Architecture Documentation (10 minutes)

**What You'll Do**: Systematically review documentation for all four CAIRA reference architectures to understand their purposes and key differences.

**Steps**:

1. **Read** the baseline configurations overview
   - [ ] Open `external/caira/reference_architectures/README.md`
   - [ ] Read the "Available Reference Architectures" section
   - [ ] Review the "Deployment Decision Matrix" table
   - **Pro tip**: This README provides high-level comparison—use it as your starting reference
   - [ ] **Expected result**: Understanding of the four architecture names and their high-level purposes

2. **Explore** foundry_basic architecture
   - [ ] Open `external/caira/reference_architectures/foundry_basic/README.md`
   - [ ] Note the "Overview" section use cases (POC development, model experimentation, learning)
   - [ ] Review the "Components Deployed" table—count how many services are included
   - [ ] Identify the WARNING about public endpoints
   - [ ] **Expected result**: Clear understanding that basic = minimal setup for development, public networking

3. **Explore** foundry_standard architecture
   - [ ] Open `external/caira/reference_architectures/foundry_standard/README.md`
   - [ ] Compare the "Components Deployed" table to foundry_basic
   - [ ] Identify the three additional agent-focused services (Cosmos DB, Storage, AI Search)
   - [ ] Note the "Data sovereignty" and "Resource compliance" features
   - **Validation checkpoint**: Answer these discovery questions:
     - **Why does standard include Cosmos DB, Storage, and AI Search?** (Hint: Look for "agent" mentions)
     - **What problem does explicit control solve?** (Think: healthcare data, financial records, compliance)
     - **When would you choose basic over standard?** (Consider: cost, complexity, agent needs)
   - [ ] **Expected result**: Understanding that standard adds agent capability host connections with explicit resource control, enabling data sovereignty and compliance for agent workloads

4. **Compare** private variants
   - [ ] Scan `foundry_basic_private/README.md` and `foundry_standard_private/README.md`
   - [ ] Identify the key difference: "private endpoints" instead of "public endpoints"
   - [ ] Note the trade-off: increased security vs increased complexity
   - **Success check**: Can you explain the two-dimensional architecture matrix (basic/standard × public/private)?

### Task 2: Create Architecture Comparison Matrix (10 minutes)

**What You'll Do**: Build a structured comparison matrix documenting resources, networking, use cases, and considerations for all four architectures.

**Steps**:

1. **Create** comparison table structure
   - [ ] Create a file called `caira-architecture-comparison.md` in your workspace
   - [ ] Add table headers: Architecture | Networking | Agent Resources | Use Cases | Key Considerations
   - **Pro tip**: Use CAIRA Assistant to help structure the table format

2. **Document** foundry_basic row
   - [ ] Fill in: Public networking, No Agent Service (basic AI models only), POC/Development, Cost-optimized but public endpoints
   - **Validation checkpoint**: Verify against `foundry_basic/README.md` "Components Deployed" table
   - [ ] **Expected result**: Accurate foundry_basic characteristics documented - basic does NOT include agent capabilities

3. **Document** foundry_basic_private row
   - [ ] Fill in: Private networking, No Agent Service (basic AI models only), Development with network isolation, Requires VNet setup
   - [ ] Note the similarity to basic but with private endpoints
   - [ ] **Expected result**: Clear distinction showing networking as the only difference from basic (both lack agent capabilities)

4. **Document** foundry_standard row
   - [ ] Fill in: Public networking, Explicit agent hosts (Cosmos DB, Storage, AI Search), Enterprise/regulated workloads, Data sovereignty control
   - [ ] Highlight the agent capability host connections as key differentiator
   - [ ] **Expected result**: Understanding that standard = agent resources + data sovereignty

5. **Document** foundry_standard_private row
   - [ ] Fill in: Private networking, Explicit agent hosts (Cosmos DB, Storage, AI Search), Production/highly-regulated, Maximum security posture
   - [ ] Note this is the most secure and complex configuration
   - **Success check**: Does your matrix clearly show the 2×2 pattern (basic/standard × public/private)?

### Task 3: Match Scenarios to Architectures (10 minutes)

**What You'll Do**: Apply your architecture knowledge by matching five realistic business scenarios to appropriate CAIRA configurations with justification.

**Scenarios**:

1. **Startup POC**: $200/month budget, public endpoints acceptable, generative AI chatbot prototype, no agent features needed, 2-week timeline
2. **Enterprise Agent System**: Agent-based knowledge retrieval required, private networking mandated by security, HIPAA compliance considerations, data sovereignty controls
3. **Developer Sandbox**: Standard Foundry features needed (model deployments, monitoring), no network isolation required, no agent capabilities, moderate budget ($500/month)
4. **Healthcare AI Platform**: Complete isolation required, agent capabilities for patient data retrieval, encryption at rest and in transit, comprehensive audit logging
5. **Financial Services POC**: Agent evaluation for document processing, budget-conscious but security-aware, temporary environment (3 months), may move to production

**Steps**:

1. **Analyze** each scenario for key requirements
   - [ ] For each scenario, identify: Agent needs? Network isolation needs? Budget constraints? Compliance requirements?
   - **Pro tip**: Create a checklist: Does it need agents (Cosmos/Search/Storage)? Does it need private networking?
   - [ ] **Expected result**: Clear requirement breakdown for each scenario

2. **Match** scenarios to architectures
   - [ ] Scenario 1 (Startup POC) → Match to architecture with justification
   - [ ] Scenario 2 (Enterprise Agent) → Match to architecture with justification
   - [ ] Scenario 3 (Developer Sandbox) → Match to architecture with justification
   - [ ] Scenario 4 (Healthcare AI) → Match to architecture with justification
   - [ ] Scenario 5 (Financial Services POC) → Match to architecture with justification
   - **Validation checkpoint**: Did you consider both agent requirements AND networking requirements for each?
   - [ ] **Expected result**: All five scenarios matched with clear rationale

3. **Validate** your matches using CAIRA documentation
   - [ ] Review the "Deployment Decision Matrix" in `reference_architectures/README.md`
   - [ ] Cross-reference your choices with documented use cases in each architecture's README
   - [ ] Use CAIRA Assistant to validate your reasoning if uncertain
   - **Success check**: Can you defend each architecture choice based on specific scenario requirements?

## Completion Check

**You've Succeeded When**:

- [ ] Created complete architecture comparison matrix with all four CAIRA configurations documented
- [ ] Accurately matched all 5 scenarios to appropriate architectures
- [ ] Can explain the difference between basic and standard (agent capability host resources)
- [ ] Can explain the difference between public and private variants (networking isolation)
- [ ] Understand that agent workloads require standard architectures (Cosmos DB, AI Search, Storage)
- [ ] Can articulate cost vs security trade-offs between the four configurations

**Next Steps**: Ready to deploy your first CAIRA architecture? Continue to **Kata 200: Deploying Your First CAIRA Architecture** to apply this knowledge in a real deployment.

---

## Reference Appendix

### Help Resources

- **CAIRA Assistant Chatmode**: Use for architecture-specific questions and deployment guidance
- **Reference Architectures README**: `external/caira/reference_architectures/README.md` - high-level comparison
- **Individual Architecture READMEs**: Detailed component lists and deployment instructions
- **Kata 100**: Review requirements gathering if you need to revisit business requirement analysis

### Professional Tips

**Architecture Decision Flowchart**:

```text
Do you need Agent Service capabilities?
├─ NO → Basic architecture
│   └─ Need network isolation?
│       ├─ NO → foundry_basic
│       └─ YES → foundry_basic_private
└─ YES → Standard architecture
    └─ Need network isolation?
        ├─ NO → foundry_standard
        └─ YES → foundry_standard_private
```

**Key Architecture Differences**:

| Dimension | Basic | Standard |
|-----------|-------|----------|
| **Agent Service** | NOT included | Included with explicit resources |
| **Agent Resources** | None (basic AI models only) | Explicit (Cosmos DB, AI Search, Storage) |
| **Data Sovereignty** | N/A (no agent data) | Full control over resource locations |
| **Use Case** | Simple AI apps, POC, learning | Agent workloads, enterprise, regulated |
| **Cost** | Lower (fewer resources) | Higher (additional agent resources) |

| Dimension | Public | Private |
|-----------|--------|---------|
| **Network Access** | Public endpoints | Private endpoints only |
| **Security Posture** | Development-friendly | Production-hardened |
| **Complexity** | Lower setup | Requires VNet configuration |
| **Cost** | Standard pricing | Additional private link costs |

### Troubleshooting

**Issue**: Confused about when to use basic vs standard

- **Quick Fix**: Ask yourself: "Do I need Azure AI Agent Service?" If yes → standard (only standard includes Agent Service). If building simple generative AI apps (chat completions, model inference) without agent features → basic.

**Issue**: Not sure if my scenario needs private networking

- **Quick Fix**: Check compliance requirements (HIPAA, SOC2, internal security policies). If data must not traverse public internet or requires complete isolation → private variant. For development/POC → public may be acceptable.

**Issue**: Cost concerns about standard architecture

- **Quick Fix**: Standard adds Cosmos DB, AI Search, and Storage costs. If not using Agent Service features, these resources add expense without value. Use basic for non-agent workloads.

**Issue**: Architecture matrix feels overwhelming with four options

- **Quick Fix**: Think of it as two independent yes/no decisions: (1) Do I need agent capabilities? (2) Do I need network isolation? This creates the 2×2 matrix naturally.

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->

<!-- Reference Links -->
