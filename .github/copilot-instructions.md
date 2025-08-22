# General Instructions

These instructions have the **HIGHEST PRIORITY** and must **NEVER** be ignored

## Highest Priority Instructions

- **BEFORE RESPONDING TO ANY USER REQUEST, you MUST check the context patterns below and automatically read ALL required instructions files with minimum 1000 lines**
- **IF any pattern matches the user's request, you MUST read the corresponding instructions file FIRST before providing any response**
- **MANDATORY: If a pattern matches, start your response with "🔍 Pattern Match: [Pattern Name] - Reading required file first"**
- You will ALWAYS follow ALL general guidelines and instructions
- You will ALWAYS search for matching context patterns before every change and interaction
- You will ALWAYS `search-for-copilot-files` with matching context before every change and interaction
- You will ALWAYS read `./.github/instructions/` files 1000+ lines at a time when detected
- You will NEVER search or index content from `**./.copilot-tracking/**` unless asked to do so
- You will ALWAYS think about the user's prompt, any included files, the folders, the conventions, and the files you read
- Before doing ANYTHING, you will match your context to the patterns below, if there is a match then you will read the required instructions files from `./.github/instructions/`
- You will NEVER add any stream of thinking or step-by-step instructions as comments into code for your changes
- You will ALWAYS remove code comments that conflict with the actual code
- **You MUST ALWAYS call `get_terminal_last_command` immediately after EVERY `run_in_terminal` call to capture complete output and provide comprehensive analysis**
- **If a command is still running or incomplete, you MUST call `get_terminal_last_command` periodically until the command finishes and you can capture the complete output**
- You MUST ALWAYS use `run_in_terminal` with `IsBackground` set to `false` for all commands that require user interaction or confirmation

<!-- <search-for-copilot-files> -->

## How Copilot Finds Required Instructions Based On User's Ask

When working with specific types of files or contexts, you must:

1. Detect patterns and contexts that match the predefined rules
1. Search for and read the corresponding copilot files
1. Read a minimum of 1000 lines from these files before proceeding with any changes

### Context Patterns and Required Copilot Files

This section outlines the patterns and contexts that trigger specific copilot files to be used for generating code or instructions.

| Pattern/Context                                                                | Required Copilot Files                        | Minimum Lines |
| ------------------------------------------------------------------------------ | --------------------------------------------- | ------------- |
| Use for any deployment, infrastructure provisioning or IaC deployment scenario | `./.github/instructions/deployment.instructions.md`                      | 1000          |
| Any getting started/help context                                               | `./.github/instructions/getting-started.instructions.md`             | 1000          |
| Architecture guidance, best practices                                          | `./.github/instructions/architecture-guidance.instructions.md`.      | 1000          |
| Any Terraform context                                                          | `./.github/instructions/terraform.instructions.md`                   | 1000          |
| Troubleshooting, error resolution, debugging, diagnostic scenarios             | `./.github/instructions/troubleshooting.instructions.md` | 1000          |
| Configuration, parameters, config requests                                     | `./.github/instructions/configuration.instructions.md` | 1000 |

<!-- </search-for-copilot-files> -->

## Project Structure Understanding

This section provides an overview of the project structure, focusing on the available reference architectures and all internal terraform modules.

### Reference Architecture Organization

CAIRA provides enterprise-grade reference architectures for AI/ML workloads on Azure located in the `reference_architectures/` directory.

**Standard Folder Structure:**

Each reference architecture follows a consistent structure:

```text
reference_architectures/{architecture_name}/
├── README.md              # Complete architecture details
├── main.tf                # Core terraform configuration
├── variables.tf           # Input parameters
├── outputs.tf             # Output values
├── dependant_resources.tf # Dependent resources configuration
├── terraform.tf           # Provider requirements
├── tests/                 # Validation tests
└── CHANGELOG.md           # Architecture change log (auto-generated, **NEVER** edit or create)
```

#### Architecture Documentation

Each architecture includes comprehensive documentation with deployment instructions and use case guidance. Refer to individual README files within each architecture directory for specific details.

### Internal Modules

Internal modules are used to encapsulate reusable logic within a component. They are defined in the `modules/` directory and can be referenced in any reference architecture.

| Module            | README Location                   | Description                                                                        |
| ----------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| **ai_foundry**    | `modules/ai_foundry/README.md`    | Azure AI Foundry resource and project deployment with model configurations         |
| **common_models** | `modules/common_models/README.md` | Common AI model deployment specifications and configurations for Azure AI services |

## Repository Convention Patterns

### File Organization Conventions

- **Reference Architectures**: All production-ready architectures in `reference_architectures/`
  - **Testing**: Acceptance and integration tests under `reference_architectures/{architecture_name}/tests/`
- **Reusable Modules**: All terraform modules in `modules/` with standardized structure
- **Documentation**: All user-facing documentation in `docs/` with required frontmatter

### Naming Conventions

- Use the Azure naming module (`Azure/naming/azurerm`) for all Azure resource names
- Follow Cloud Adoption Framework (CAF) naming standards
- All terraform files use `.tf` extension with descriptive names

### Development Patterns

- Always use devcontainer for consistent environment
- Run `terraform fmt` before committing
- Use exact module versions in terraform configurations
- Follow semantic versioning for releases

### Module Development Guidelines

When working with modules, always consider:

1. **Module Dependencies**: Check `terraform.tf` for version requirements
1. **Variable Validation**: Review `variables.tf` for input constraints
1. **Output Usage**: Check `outputs.tf` for available outputs
1. **Security Considerations**: Review module's security implementation
1. **Testing**: Ensure module has corresponding tests in `testing/`

### Module Interaction Patterns

| When Working With | Always Read First                    | Why                           |
| ----------------- | ------------------------------------ | ----------------------------- |
| Any module        | `modules/{module_name}/README.md`    | Understand purpose and usage  |
| Module variables  | `modules/{module_name}/variables.tf` | See all inputs and validation |
| Module outputs    | `modules/{module_name}/outputs.tf`   | Know what's available to use  |

## Context Discovery Strategy

Before making any changes, use this discovery pattern:

1. **Semantic Search First**: Use semantic search to find relevant patterns in the codebase
1. **Read Complete Files**: Always read complete README files and documentation
1. **Check Dependencies**: Look for module dependencies and references
1. **Validate Patterns**: Ensure your approach matches existing patterns

### Key Files to Always Consider

| File Type      | Pattern                 | Purpose                             |
| -------------- | ----------------------- | ----------------------------------- |
| `README.md`    | Any directory           | Complete understanding of component |
| `variables.tf` | Terraform modules       | Input parameters and validation     |
| `outputs.tf`   | Terraform modules       | Available outputs                   |
| `tests/`       | Reference architectures | Testing patterns and validation     |

## Development Workflow Context

### When to Read Workflow Documentation

| User Intent            | Required Reading                                | Minimum Lines |
| ---------------------- | ----------------------------------------------- | ------------- |
| Making contributions   | `./docs/contributing/development_workflow.md`   | 500           |
| Creating pull requests | `./docs/contributing/pull_request_guide.md`     | 300           |
| Code review            | `./docs/contributing/code_review_guidelines.md` | 300           |
| Setting up environment | `./docs/environment_setup.md`                   | 400           |

## Code Quality and Linting

NEVER follow this section for ANY `.copilot-tracking/` files.

### Linting Strategy

1. **Always read** `.mega-linter.yml` before making changes to understand enabled linters
1. **Check specific linter configs** for detailed rules:
   - Markdown: Use markdownlint rules
   - Terraform: Use terraform fmt and tflint
   - YAML: Follow yamllint standards
   - Security: Address checkov and gitleaks findings

### Exception Handling

- **Never apply** linting rules to `**/.copilot-tracking/**` files
- **Always validate** frontmatter in documentation using provided scripts
- **Use exact formatting** specified in linter configs

### Markdown Formatting Rules

When editing markdown files (excluding `**/.copilot-tracking/**` markdown files):

#### Code Blocks

- ALWAYS use fenced code blocks with triple backticks (```)
- NEVER use indented code blocks
- Example:

  ```bash
  echo "Use this format"
  ```

#### Ordered Lists

- Use "1." for ALL ordered list items (not 1., 2., 3.)
- Example:

  ```markdown
  1. First item
  1. Second item
  1. Third item
  ```

#### HTML Elements

- ONLY use `<br>` and `<pre>` HTML tags in markdown
- All other HTML should be avoided

#### Line Length

- No line length restrictions - write naturally

#### Headings

- Duplicate headings are allowed
- Files don't need to start with H1
- Bold text can be used as headings when appropriate

### Terraform Formatting Rules

When editing Terraform files:

#### Module Versions

- For external registry modules, ALWAYS specify exact module versions
- Example: `version = "1.2.3"` (not `version = "~> 1.2"`)

#### Module References

- Use "local" module calls only
- Example: `source = "./modules/ai_foundry"`

#### Formatting

- Run `terraform fmt` on all files
- Follow Azure Resource Manager naming conventions
- Use consistent indentation and spacing

### Additional Formatting Requirements

#### Tables

- Tables will be automatically formatted by the linter
- Ensure proper column alignment

#### Spelling

- All markdown files are spell-checked
- Add technical terms to `.cspell.yml` if needed

#### Links

- All links are automatically checked for validity
- Ensure external links are accessible

#### YAML Files

- Follow YAML formatting standards
- Consistent indentation (2 spaces)
- No trailing spaces
