# General Instructions

These instructions define **HOW** Copilot should process user queries and **WHEN** to read specific guidance files.

## Query Processing

### Core Processing Workflow

**MANDATORY SEQUENCE** for every user request:

1. **Pattern Detection**: Identify which context pattern(s) match the user's request
1. **Guidance Loading**: Read required instruction files (minimum 1000 lines each)
1. **Context Integration**: Apply guidance to user's specific query
1. **Response Generation**: Provide solution following loaded guidance

### Critical Directives

- **BEFORE ANY RESPONSE**: Check context patterns and read matching instruction files
- **PATTERN MATCH INDICATOR**: Start responses with "🔍 Pattern Match: [Pattern Name] - Loading guidance"
- **CONTEXT ANALYSIS**: Always analyze user's prompt, included files, folders, conventions, and patterns
- **NO .copilot-tracking ACCESS**: Never search/index `.copilot-tracking/` unless explicitly requested
- **COMPLETE TERMINAL CAPTURE**: Always call `get_terminal_last_command` immediately after EVERY `run_in_terminal` call
- **MONITOR LONG-RUNNING COMMANDS**: Call `get_terminal_last_command` periodically until command finishes
- **NO BACKGROUND INTERACTION**: Use `IsBackground=false` for commands requiring user interaction or confirmation
- **COMPREHENSIVE TERMINAL ANALYSIS**: Provide complete analysis of terminal output and command results
- **CLEAN CODE COMMENTS**: Remove conflicting code comments; never add thinking-process comments

### Response Quality Standards

- **No assumptions** - Always gather context first
- **Complete solutions** - Don't give up unless truly impossible with available tools
- **Clean output** - Use appropriate edit tools, never print code blocks unless requested
- **Terminal command execution** - Always use `run_in_terminal` with `IsBackground=false` for interactive commands
- **Terminal output capture** - Call `get_terminal_last_command` immediately after every terminal command
- **Long-running command monitoring** - Monitor command progress until completion with periodic output checks
- **Comprehensive terminal analysis** - Analyze and explain terminal output, errors, and command results
- **Comprehensive analysis** - Think creatively and explore workspace thoroughly

## Context Recognition

### Context Pattern Recognition

When user queries match these patterns, **immediately** load the corresponding guidance:

| User Query Context | Required Instruction File | Load Priority |
|-------------------|--------------------------|---------------|
| Deployment, infrastructure provisioning, IaC deployment | `.github/instructions/deployment.instructions.md` | Critical |
| Getting started, setup, help requests | `.github/instructions/getting-started.instructions.md` | Critical |
| Architecture decisions, best practices, design guidance | `.github/instructions/architecture-guidance.instructions.md` | Critical |
| Terraform files (.tf), IaC configuration, modules | `.github/instructions/terraform.instructions.md` | Critical |
| Configuration parameters, SKUs, pricing, variables, validation | `.github/instructions/configuration.instructions.md` | Critical |
| Task implementation, .copilot-tracking files | `.github/instructions/task-implementation.instructions.md` | Critical |

**Pattern Matching Rules:**

- Multiple patterns can match simultaneously - load ALL relevant guidance
- When uncertain, err on the side of loading additional guidance
- Each loaded file must be read with minimum 1000 lines
- Search for matching context patterns before every change and interaction

### Discovery and Context Gathering Strategy

**Before making any changes**, follow this systematic approach:

#### Query Analysis Process

1. **Semantic Search**: Use semantic search to understand codebase patterns
1. **File Discovery**: Identify relevant files using file_search and grep_search
1. **Context Loading**: Read complete files (prefer large chunks over multiple small reads)
1. **Pattern Validation**: Ensure approach aligns with existing conventions

### Context Integration Rules

- **Always read guidance BEFORE acting** - Never assume or shortcut
- **Read minimum 1000 lines** from each loaded instruction file
- **Follow loaded guidance exactly** - Don't modify or interpret
- **Integrate multiple guidance sources** when patterns overlap
- **Validate changes against loaded patterns** before implementation
- **Think comprehensively** - Consider user prompt, included files, folders, conventions, and workspace patterns

#### File Reading Strategy

| File Type | When to Read | Purpose |
|-----------|-------------|---------|
| `README.md` | Any directory context | Complete component understanding |
| `variables.tf` | Terraform modules | Input parameters and validation rules |
| `outputs.tf` | Terraform modules | Available outputs and dependencies |
| Guidance files | Pattern match detected | Specific implementation instructions |

## Project Knowledge

### Project Structure Understanding

### Reference Architecture Organization

CAIRA provides enterprise-grade reference architectures for AI/ML workloads on Azure located in the `reference_architectures/` directory. Each architecture follows a consistent structure with comprehensive documentation, deployment instructions, and use case guidance.

### Internal Modules

Internal modules provide reusable Terraform components:

- **ai_foundry** - Core Azure AI Foundry resource and project deployment
- **common_models** - Standardized AI model deployment specifications

### Development Workflow Context

#### When to Read Workflow Documentation

| User Intent | Required Reading | Minimum Lines |
|-------------|-----------------|---------------|
| Making contributions | `./docs/contributing/development_workflow.md` | 500 |
| Creating pull requests | `./docs/contributing/pull_request_guide.md` | 300 |
| Code review | `./docs/contributing/code_review_guidelines.md` | 300 |
| Setting up environment | `./docs/environment_setup.md` | 400 |
| Writing documentation | `./docs/contributing/frontmatter-validation-guide.md` | 200 |

## User Interaction

**CRITICAL USER INTERACTION RULES:**

### Architecture Selection

- **Present Relevant Options**: Show ALL architectures that match the user's stated requirements
- **Group When Many**: If 4+ options exist, group by category (basic vs enterprise, public vs private)
- **Explain Relevance**: For each option, explain WHY it matches their needs
- **Wait for User Choice**: Never auto-select architectures - always ask user to choose explicitly
- **Recommend if Asked**: Offer recommendation if user requests guidance, but still let them choose

### Deployment Confirmations

- **Plan Review Required**: After `terraform plan`, always show key resources that will be created
- **Explicit Confirmation**: Ask "Are you ready to proceed with deployment?" and wait for response
- **No Auto-Apply**: Never run `terraform apply` without explicit user confirmation
- **Cost/Time Estimates**: Provide deployment time estimates (e.g., "This will take 15-30 minutes")

### Interactive Commands

- **Background Setting**: Use `isBackground=false` for commands requiring user interaction
- **Confirmation Points**: For destructive operations, always confirm first
- **Progress Updates**: For long-running commands, provide status updates

**Example Interaction Pattern:**

1. Present options: "Here are your deployment options..."
1. Wait for choice: "Which option would you prefer? Please type 1, 2, or 3."
1. Show plan: "Here's what will be deployed..."
1. Confirm deployment: "Ready to proceed? This will take 15-30 minutes. (yes/no)"
1. Only then execute: `terraform apply`

## Quality Standards

### Code Quality and Formatting Exception

**CRITICAL EXCEPTION**: NEVER apply linting or formatting rules to `**/.copilot-tracking/**` files.

For all other files, follow these essential rules:

### Markdown Files

- Use fenced code blocks with triple backticks (``` )
- Use "1." for ALL ordered list items
- Only use `<br>` and `<pre>` HTML tags
- No line length restrictions

### Terraform Files

- Specify exact module versions: `version = "1.2.3"`
- Use local module references: `source = "./modules/ai_foundry"`
- Run `terraform fmt` before committing

### General Quality

- Always read `.mega-linter.yml` before changes
- Validate frontmatter in documentation
- Ensure proper table alignment
- Check links for validity
- Use consistent YAML indentation (2 spaces)
