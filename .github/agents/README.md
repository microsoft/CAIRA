<!-- META
title: CAIRA Custom Agents
description: Custom AI agents that provide specialized assistance for working with the CAIRA project.
author: CAIRA Team
ms.date: 03/03/2026
ms.topic: reference
estimated_reading_time: 3
keywords:
    - custom agents
    - AI assistants
    - CAIRA
    - copilot agents
    - deployment guidance
    - architecture decisions
-->

# CAIRA Custom Agents

This directory contains custom AI [agent](https://code.visualstudio.com/docs/copilot/customization/custom-agents) configurations designed to enhance your experience when working with the CAIRA project. Each agent provides tailored guidance and assistance for specific types of tasks.

## AI Usage Disclaimer

**Important Notice**: AI assistance is helpful but variable. Results depend on model selection, context quality, and evolving technology capabilities. Always validate AI-generated content with qualified professionals, especially for production environments.

_Copilot is powered by AI, so mistakes are possible. Review output carefully before use._

**When using these agents, you must**:

- Review and test all AI-generated code, configurations, and recommendations
- Verify decisions against official documentation and best practices
- Follow your organization's security and compliance requirements
- Be cautious when sharing sensitive information in AI conversations

## Available Agents

### [CAIRA AI Assistant](caira-assistant.agent.md)

Your comprehensive AI guide for Azure AI infrastructure deployment, development, and architecture decisions. This agent provides step-by-step guidance with concise, actionable answers while following Azure Well-Architected Framework principles.

- **Purpose**: Deploy and manage Azure AI infrastructure
- **Best For**: New users, architecture selection, deployments
- **Key Features**: Context-aware pattern matching, automatic instruction loading, interactive deployment execution, architecture guidance

### [ADR Creation Coach](adr-creation.agent.md)

An expert coaching assistant that guides teams through collaborative architectural decision record (ADR) creation using Socratic methods and progressive documentation building.

- **Purpose**: Architectural decision documentation
- **Best For**: Enterprise governance, decision tracking
- **Key Features**: Guided discovery through questioning, collaborative research, progressive documentation, Socratic coaching methodology

## Usage Guidelines

### Selecting an Agent

1. Open GitHub Copilot Chat
1. Select the desired agent from the agent picker
1. Start your conversation with a description of what you need

### When to Use Each Agent

| Task | Recommended Agent |
|------|-------------------|
| Deploy a reference architecture | CAIRA AI Assistant |
| Choose an architecture for your scenario | CAIRA AI Assistant |
| Troubleshoot a deployment issue | CAIRA AI Assistant |
| Document an architecture decision | ADR Creation Coach |
| Evaluate trade-offs between approaches | ADR Creation Coach |

### Best Practices

- **Be Specific**: Provide clear, detailed prompts related to your goals
- **Review Output**: Always validate AI-generated configurations and commands before applying
- **Iterative Approach**: Start with high-level questions, then drill into specifics
- **Provide Context**: Include relevant files or folders in your conversation for better results

## Related Resources

- **[Custom Agents Guide](../../docs/custom_agents.md)**: Detailed guide on using CAIRA agents
- **[Contributing Guidelines](../../CONTRIBUTING.md)**: General contribution guidelines for the project
- **[Development Instructions](../instructions/README.md)**: Context-specific development instruction files
