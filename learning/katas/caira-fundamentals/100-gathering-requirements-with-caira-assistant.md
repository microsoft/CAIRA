---
kata_id: caira-fundamentals-100
kata_category:
  - caira-fundamentals
title: Gathering Requirements with CAIRA Assistant
description: Learn to use the CAIRA Assistant chatmode to gather requirements and identify the right Azure AI Foundry architecture for your project.
kata_difficulty: 1
estimated_time_minutes: 30
technologies:
  - azure-ai-foundry
  - caira
  - github-copilot
  - requirements-gathering
tags:
  - requirements-gathering
  - architecture-selection
  - chatmode
  - beginner-friendly
learning_objectives:
  - Activate and use the CAIRA Assistant chatmode in VS Code
  - Ask effective questions to gather deployment requirements
  - Understand the differences between CAIRA reference architectures
  - Match business requirements to appropriate architecture choices
  - Document architecture recommendations with justification
prerequisites:
  - VS Code with GitHub Copilot installed
  - Access to the CAIRA repository
  - Basic understanding of cloud deployment concepts
success_criteria:
  - Successfully activated CAIRA Assistant chatmode
  - Conducted a complete requirements gathering conversation
  - Received architecture recommendation from the assistant
  - Documented key decision criteria and rationale
  - Can explain why the recommended architecture fits the scenario
common_pitfalls:
  - Providing too little context in questions to the assistant
  - Not clarifying environment type (dev vs production)
  - Forgetting to ask about network isolation requirements
  - Assuming one architecture fits all use cases
search_keywords:
  - caira assistant
  - requirements gathering
  - architecture selection
  - azure ai foundry
  - chatmode
  - deployment planning
real_world_application: In real projects, gathering accurate requirements upfront prevents costly re-architecture later. Using an AI assistant trained on specific infrastructure patterns helps teams quickly identify the right starting point for their Azure AI deployments, reducing time-to-value from weeks to hours.
ai_coaching_level: guided
scaffolding_level: heavy
hint_strategy: progressive
requires_azure_subscription: false
requires_local_environment: true
requires_github_account: false
author: CAIRA Learning Team
ms.date: 2025-12-01
related_katas: []
chatmode_references:
  - caira-assistant
---

# Gathering Requirements with CAIRA Assistant

Learn to use the CAIRA Assistant to gather requirements and identify the right architecture for your Azure AI project.

## Quick Context

**What You'll Build**: A documented architecture recommendation based on a business scenario

**Why This Matters**: Choosing the right architecture upfront saves time, money, and prevents security issues later

**Real Challenge**: Your manager asks you to research Azure AI infrastructure options for a new customer service chatbot project. The team needs to understand which CAIRA architecture to use, but you're new to Azure AI Foundry and infrastructure planning.

## Essential Setup

### Prerequisites Check

Before starting, verify you have:

- [ ] VS Code installed and open
- [ ] GitHub Copilot extension installed and active
- [ ] CAIRA repository cloned and open in VS Code
- [ ] Access to Copilot chat panel (Cmd+Shift+I or Ctrl+Shift+I)

**Expected Result**: You can open the Copilot chat panel and see the chat interface.

### Setup Validation

- [ ] Open VS Code
- [ ] Press `Cmd+Shift+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
- [ ] Verify the Copilot chat panel opens on the right side

**If you don't see the chat panel**: Ensure GitHub Copilot is installed and you're signed in. Go to Extensions (Cmd+Shift+X) and search for "GitHub Copilot".

## Practice Tasks

### Task 1: Activate the CAIRA Assistant (5 minutes)

**What You'll Do**: Find and activate the CAIRA Assistant chatmode in VS Code.

**Steps:**

- [ ] Open the Copilot chat panel (Cmd+Shift+I or Ctrl+Shift+I)
- [ ] Look at the top of the chat panel for the mode selector dropdown
- [ ] Click the mode selector (it might say "Chat" or another mode name)
- [ ] Scroll through the list and find "caira-assistant"
- [ ] Select "caira-assistant" from the dropdown

**Expected Result**: The chat panel header should now show "caira-assistant" as the active mode.

**Success Criteria**:

- [ ] Chat mode selector shows "caira-assistant"
- [ ] Chat panel is ready to receive messages
- [ ] You see a greeting or prompt from the assistant

### Task 2: Start the Requirements Conversation (10 minutes)

**What You'll Do**: Engage with the CAIRA Assistant using a realistic business scenario.

**Business Scenario**:
Your company is building a customer service chatbot that will:
- Handle 10,000+ customer inquiries per day
- Access customer data from your existing databases
- Must comply with data privacy regulations (GDPR)
- Needs to be production-ready in 60 days
- Will use Azure AI Agent Service capabilities

**Steps:**

- [ ] In the CAIRA Assistant chat, type: "I need help selecting the right CAIRA architecture for my project"
- [ ] When the assistant asks questions, provide information from the scenario above
- [ ] Answer questions about environment type, agent service needs, and network requirements
- [ ] Continue the conversation until you receive an architecture recommendation

**Expected Result**: The assistant asks 3-5 clarifying questions and provides a specific architecture recommendation.

**Success Criteria**:

- [ ] You answered questions about production vs development environment
- [ ] You clarified whether you need Azure AI Agent Service
- [ ] You discussed network isolation or compliance requirements
- [ ] You received a specific architecture name (e.g., "foundry_standard_private")

**Common Issue**: If the assistant doesn't ask enough questions, try providing more context: "This is for a production system that processes customer data and needs to comply with GDPR."

### Task 3: Document the Recommendation (10 minutes)

**What You'll Do**: Create a simple requirements document based on the conversation.

**Steps:**

- [ ] Create a new file: `docs/learning/katas/caira-fundamentals/my-architecture-requirements.md`
- [ ] Copy and paste the template below into your file
- [ ] Fill in the template based on your conversation with the assistant

**Template:**

```markdown
# Architecture Requirements Document

## Project Overview
**Project Name**: Customer Service Chatbot
**Date**: [Today's date]

## Business Requirements
- [List key business needs from the scenario]
- [Example: Handle 10,000+ daily inquiries]

## Technical Requirements
- [ ] Environment Type: [Development/Production]
- [ ] Agent Service Needed: [Yes/No]
- [ ] Network Isolation: [Required/Not Required]
- [ ] Data Sovereignty: [Required/Not Required]

## Recommended Architecture
**Architecture**: [Name from assistant recommendation]

**Justification**:
[Explain in 2-3 sentences why this architecture was recommended]

## Key Decision Factors
1. [Factor 1 and why it mattered]
2. [Factor 2 and why it mattered]
3. [Factor 3 and why it mattered]

## Next Steps
- [ ] Review architecture documentation
- [ ] Validate with team
- [ ] Plan deployment timeline
```

**Expected Result**: A completed markdown file with all sections filled in based on your CAIRA Assistant conversation.

**Success Criteria**:

- [ ] File created and saved
- [ ] All template sections completed
- [ ] Architecture name matches assistant recommendation
- [ ] Justification clearly explains the reasoning
- [ ] Decision factors reflect the conversation

### Task 4: Verify Your Understanding (5 minutes)

**What You'll Do**: Test your knowledge by asking follow-up questions.

**Steps:**

- [ ] In the CAIRA Assistant chat, ask: "What's the difference between foundry_basic and foundry_standard?"
- [ ] Ask: "Why would I choose a private architecture variant?"
- [ ] Ask: "What happens if I don't need Azure AI Agent Service?"

**Expected Result**: The assistant provides clear explanations that help you understand architecture differences.

**Success Criteria**:

- [ ] You understand when to use basic vs standard architectures
- [ ] You know why private networking matters for compliance
- [ ] You can explain the agent service requirement difference

## Completion Check

### Self-Test Questions

Answer these without looking back at your notes:

1. What are the 4 main CAIRA reference architectures?
2. What's the primary difference between basic and standard variants?
3. When would you choose a private architecture over a public one?
4. What question should you always ask about Azure AI Agent Service?

**Check Your Answers**:

1. foundry_basic, foundry_basic_private, foundry_standard, foundry_standard_private
2. Standard includes explicit resources for agent capability host connections (Cosmos DB, Storage, AI Search)
3. When you have compliance requirements for network isolation or data privacy regulations
4. "Do you plan to use Azure AI Agent Service?" - determines basic vs standard choice

### You've Succeeded When

- [ ] CAIRA Assistant chatmode is activated and usable
- [ ] You completed a requirements gathering conversation
- [ ] Your requirements document has all sections filled in
- [ ] You can explain why the recommended architecture fits your scenario
- [ ] You understand the differences between the 4 architecture types

### What You've Learned

**Core Skills**:
- Using AI assistants for technical requirements gathering
- Asking effective clarifying questions
- Matching requirements to architecture patterns
- Documenting technical decisions

**CAIRA Knowledge**:
- The 4 reference architecture types and their purposes
- Key decision factors: environment, agents, networking, data control
- How to activate and use the CAIRA Assistant chatmode

## Reference Appendix

### Architecture Quick Reference

| Architecture | Best For | Key Features |
|-------------|----------|--------------|
| `foundry_basic` | Dev/POC, no agents | Quick setup, Microsoft-managed resources |
| `foundry_basic_private` | Dev/POC with network isolation | Private endpoints, no agents |
| `foundry_standard` | Production with agents | Explicit capability host connections |
| `foundry_standard_private` | Production with agents + compliance | Full network isolation + agent resources |

### Key Decision Questions

**Environment Type**:
- Development/Experimentation → Basic variants
- Production/Enterprise → Standard variants

**Agent Service**:
- Using Azure AI Agent Service → Standard variants (includes Cosmos DB, Storage, Search)
- Only model deployments → Basic variants

**Network Isolation**:
- Compliance requirements → Private variants
- No specific isolation needs → Public variants

**Data Control**:
- Need explicit resource control → Standard variants
- Microsoft-managed acceptable → Basic variants

### Hints

**Hint 1 (If stuck starting conversation)**: Begin with a simple statement like "I need to deploy Azure AI Foundry for [your use case]" and let the assistant guide you.

**Hint 2 (If not getting architecture recommendation)**: Make sure you've clearly stated whether this is for production and whether you need agent capabilities.

**Hint 3 (If confused about architectures)**: Ask the assistant directly: "Can you explain the differences between all 4 architectures in a table?"

**Hint 4 (If documentation feels incomplete)**: Review your chat history - the assistant likely provided the information you need to fill in decision factors.

### Troubleshooting

**Issue**: Chat mode selector doesn't show "caira-assistant"

**Solution**: The chatmode file might not be in the `.github/chatmodes/` directory. Verify you've opened the CAIRA repository as your workspace root in VS Code.

**Issue**: Assistant provides generic Azure advice instead of CAIRA-specific guidance

**Solution**: Confirm you have the correct chatmode selected. The name should be exactly "caira-assistant" in the dropdown.

**Issue**: Not sure how to answer the assistant's questions

**Solution**: It's okay to say "I don't know" or "What are my options?" The assistant will provide guidance and explain the choices.

### Additional Resources

- [CAIRA Reference Architectures Overview](../../../reference_architectures/README.md)
- [CAIRA Getting Started Guide](../../../README.md)
- [Architecture Decision Records](../../../docs/adr/)

### Next Learning Steps

After completing this kata, try:
- **Kata 101**: Deploying Your First CAIRA Architecture
- **Kata 102**: Understanding CAIRA Module Structure
- Review the specific README for your recommended architecture

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->

<!-- Reference Links -->
