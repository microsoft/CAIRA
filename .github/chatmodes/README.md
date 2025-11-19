# CAIRA Chatmodes Documentation

This directory contains specialized AI chatmode configurations designed to enhance your experience when working with the CAIRA (Composable AI Reference Architecture) project. Each chatmode provides tailored guidance and assistance for specific types of tasks.

## AI Usage Disclaimer

**Important Notice**: AI assistance is helpful but variable. Results depend on model selection, context quality, and evolving technology capabilities. Always validate AI-generated content with qualified professionals, especially for production environments.

_Copilot is powered by AI, so mistakes are possible. Review output carefully before use._

**When using these chatmodes, you must**:

- Review and test all AI-generated code, configurations, and recommendations
- Verify decisions against official documentation and best practices
- Follow your organization's security and compliance requirements
- Be cautious when sharing sensitive information in AI conversations

## Available Chatmodes

### 1. CAIRA Assistant (`caira-assistant.chatmode.md`)

**Description**: Your comprehensive AI guide for Azure AI infrastructure deployment, development, and architecture decisions. This chatmode provides step-by-step guidance with concise, actionable answers while following the Azure Well-Architected Framework principles.

**Intended Use**:

- Learning the CAIRA modular Infrastructure as Code baseline
- Deploying secure, observable AI environments on Azure
- Making informed architecture decisions
- Getting help with deployment, development, and troubleshooting

**Usage Instructions**:

1. Activate this chatmode when working with CAIRA deployment or architecture questions
1. Ask questions about deployment steps, configuration options, or best practices
1. Request guidance on choosing the right reference architecture for your needs
1. Seek help with troubleshooting deployment issues or errors

**Key Features**:

- Context-aware pattern matching for different types of requests
- Automatic loading of relevant instruction files based on your query
- Choice-based interaction (manual execution vs. guided assistance)
- Integration with Azure Well-Architected Framework guidance

### 2. ADR Creation Coach (`adr-creation.chatmode.md`)

**Description**: An expert coaching assistant that guides teams through collaborative architectural decision record (ADR) creation using Socratic methods and progressive documentation building.

**Intended Use**:

- Creating high-quality Architectural Decision Records (ADRs)
- Collaborative architectural decision-making processes
- Building architectural thinking skills within teams
- Documenting important design decisions for organizational knowledge

**Usage Instructions**:

1. Start by describing the architectural challenge or decision you're facing
1. Engage in guided conversation to explore the problem space
1. Work collaboratively to research options and analyze trade-offs
1. Receive coaching on documenting decisions clearly and comprehensively

**Key Features**:

- Guided discovery through thoughtful questioning
- Progressive understanding building
- Real-time collaborative research and documentation
- Socratic coaching methodology for decision confidence

### 3. Task Planner (`task-planner.chatmode.md`)

**Description**: A comprehensive task planning system that creates actionable implementation plans through iterative research and progressive planning methodology.

**Intended Use**:

- Breaking down complex implementation requests into manageable tasks
- Creating detailed project plans before implementation
- Researching project context and constraints
- Documenting implementation strategies and dependencies

**Usage Instructions**:

1. Describe your implementation goals or project requirements
1. The planner will research your project context and constraints
1. Receive a comprehensive, actionable task plan with specific steps
1. Plans are saved to `.copilot-tracking/plans/` for future reference

**Key Features**:

- Research-first planning approach
- Comprehensive implementation plans with checkboxes
- Documentation of dependencies and success criteria
- Integration with existing project conventions and standards

### 4. Prompt Builder (`prompt-builder.chatmode.md`)

**Description**: An expert prompt engineering and validation system with dual personas (Prompt Builder and Prompt Tester) that collaborate to create and validate high-quality prompts.

**Intended Use**:

- Engineering and improving AI prompts
- Validating prompt effectiveness through testing
- Researching and integrating information from various sources
- Creating consistent, high-quality prompt instructions

**Usage Instructions**:

1. **Prompt Builder Mode** (default): Request prompt creation or improvement
1. **Prompt Tester Mode**: Explicitly request testing of existing prompts
1. Provide source materials (README files, repositories, documentation)
1. Iterate through improvement cycles until prompts produce reliable results

**Key Features**:

- Dual-persona system for creation and validation
- Integration with multiple information sources
- Research capabilities across codebases and documentation
- Mandatory testing cycles to ensure prompt quality

---

_For technical issues with chatmodes or to contribute improvements, please refer to the project's [contributing guidelines](./../../CONTRIBUTING.md) and create appropriate issues or pull requests._
