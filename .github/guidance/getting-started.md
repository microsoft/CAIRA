# Getting Started with CAIRA

Welcome to CAIRA (Composable AI Reference Architecture)! This guide will help you get up and running with deploying secure, enterprise-grade AI infrastructure on Azure.

## What is CAIRA?

CAIRA is a modular, infrastructure-as-code baseline that accelerates the deployment of secure, observable AI-related environments in the cloud. It provides reference architectures that you can explore by checking the `reference_architectures/` directory:

```bash
ls reference_architectures/
```

Each architecture is designed for different use cases and requirements. Review each architecture's README.md to understand its purpose, components, and target scenarios.

## Prerequisites

Before you begin, ensure you have:

1. **Azure Account**: Active Azure subscription with appropriate permissions
1. **Development Environment**: Either use our devcontainer (recommended) or set up your local environment
1. **Basic Knowledge**: Familiarity with Azure, Terraform, and infrastructure concepts

For detailed setup instructions, see our [Environment Setup Guide](../../docs/environment_setup.md).

## Choose Your Learning Path

CAIRA provides tailored guidance based on your role, experience level, and objectives. Select the learning path that best matches your needs for the most effective onboarding experience.

### Quick Deployer Path - "I Need AI Infrastructure Now"

**Perfect for**: Project managers, solution architects, teams needing rapid AI environment deployment

**Timeline**: 30-60 minutes to working AI infrastructure

**Your Journey:**

1. **Environment Setup** (10 minutes)
   - Use the devcontainer for zero-setup experience (see [Environment Setup Guide](../../docs/environment_setup.md))
   - Or install Azure CLI + Terraform locally
   - Run `az login` and set your subscription

1. **Choose Your Architecture** (5 minutes)
   - Check available architectures: `ls reference_architectures/`
   - Review each architecture's README.md to understand its purpose
   - **For Development/Experimentation**: Choose architectures optimized for learning and cost
   - **For Enterprise/Regulated Workloads**: Choose architectures with enhanced compliance and control

1. **Deploy in Minutes** (15-45 minutes)

   ```bash
   cd reference_architectures/{chosen_architecture}
   export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
   terraform init
   terraform apply
   ```

1. **Immediate Value**
   - Access AI Foundry Studio through Azure Portal
   - Pre-configured AI models (GPT-4.1, o4-mini, text-embedding-3-large)
   - Ready for AI application development
   - Built-in monitoring with Application Insights

**Success Criteria**: Working AI infrastructure deployed and accessible within 1 hour

### Solution Customizer Path - "I Need Tailored Infrastructure"

**Perfect for**: Infrastructure engineers, cloud architects building custom AI solutions

**Timeline**: 2-4 hours for custom solution design and deployment

**Your Journey:**

1. **Architecture Understanding** (30 minutes)
   - Study [AI Foundry module](../../modules/ai_foundry/README.md) and [Common Models module](../../modules/common_models/README.md)
   - Review how reference architectures compose modules
   - Understand deployment patterns and configuration options

1. **Solution Design** (60 minutes)
   - Review available architectures and choose the best foundation for your needs
   - Plan specific AI model requirements using available modules
   - Consider environment-specific requirements (dev vs prod configurations)

1. **Custom Implementation** (90-120 minutes)
   - Start with the reference architecture that best matches your requirements
   - Customize model deployments and project configurations
   - Add specific compliance and security requirements
   - Configure monitoring and observability features

1. **Advanced Features**
   - Implement data sovereignty patterns based on architecture capabilities
   - Configure customer-managed keys and compliance features
   - Set up monitoring for production workloads

**Success Criteria**: Customized AI infrastructure meeting specific requirements and ready for production use

### Active Contributor Path - "I Want to Extend CAIRA"

**Perfect for**: Software engineers, DevOps engineers, infrastructure developers

**Timeline**: 1-2 days for full development environment and first contribution

**Your Journey:**

1. **Development Environment** (30 minutes)
   - Follow [Developer Guide](../../docs/developer.md) for complete toolchain setup
   - Use devcontainer for consistent environment with all tools pre-installed
   - Understand project development workflow and standards

1. **Codebase Deep Dive** (3-4 hours)
   - Study module structure and design patterns in AI Foundry and Common Models modules
   - Review coding standards and Terraform conventions
   - Explore testing and validation framework in `testing/`
   - Understand CI/CD pipelines and quality gates

1. **Contribution Workflow** (2-3 hours)

   ```bash
   task tools    # Install development dependencies
   task lint     # Validate code quality
   ```

   - Follow [Development Workflow](../../docs/contributing/development_workflow.md) for branch management
   - Use [Pull Request Guide](../../docs/contributing/pull_request_guide.md) for submissions
   - Understand [Code Review Guidelines](../../docs/contributing/code_review_guidelines.md)

1. **Advanced Development**
   - Create new modules following established patterns
   - Extend reference architectures for new use cases
   - Participate in architectural decision records (ADRs)

**Success Criteria**: Successful contribution merged into CAIRA with understanding of development workflow

### Knowledge Explorer Path - "I Want to Learn Modern AI Infrastructure"

**Perfect for**: Students, researchers, professionals learning cloud-native AI patterns

**Timeline**: Ongoing learning journey with immediate hands-on experience

**Your Journey:**

1. **Conceptual Foundation** (1-2 hours)
   - Study CAIRA's modular architecture philosophy
   - Understand Azure Well-Architected Framework implementation
   - Learn enterprise-grade security patterns for AI workloads

1. **Hands-On Learning** (Ongoing)
   - Deploy reference architectures to see concepts in action
   - Modify configurations to understand component interactions
   - Experiment with different environment configurations

1. **Advanced Topics** (Progressive)
   - Explore sophisticated networking patterns with private endpoints
   - Study customer-managed encryption and compliance features
   - Learn multi-tenant AI platform design with Azure AI Foundry
   - Understand traffic orchestration and AI gateway patterns

1. **Real-World Application**
   - Build proof-of-concept solutions using CAIRA modules
   - Understand enterprise deployment patterns and best practices
   - Learn from architectural decision records and design rationale

**Success Criteria**: Comprehensive understanding of modern AI infrastructure patterns and ability to design solutions

### Learning Accelerators

**Essential Documentation Flow:**

1. Start with [main README](../../README.md) for project overview
1. Review [Environment Setup](../../docs/environment_setup.md) for tooling
1. Explore specific module READMEs for technical details
1. Reference [Troubleshooting Guide](../../docs/troubleshooting.md) when needed
1. Follow [Development Workflow](../../docs/contributing/development_workflow.md) for contributing

**Key Success Factors:**

- **Start Simple**: Begin with reference architectures before custom solutions
- **Security First**: Understand built-in security patterns and compliance features
- **Iterative Approach**: Deploy basic configurations first, then add complexity
- **Community Engagement**: Use issues and discussions for questions and feedback

## Architecture Selection Guide

Choose the right CAIRA architecture based on your specific requirements and constraints. First, check what architectures are available:

```bash
ls reference_architectures/
```

Then review each architecture's README.md file to understand:

- **Target use cases and scenarios**
- **Component descriptions and configurations**
- **Security and compliance features**
- **Cost considerations**
- **Prerequisites and limitations**

### Decision Framework

**Start Here: What's your primary use case?**

```mermaid
graph TD
    A[What's your primary use case?] --> B[Development & Experimentation]
    A --> C[Enterprise Production Workloads]

    B --> D{Budget constraints?}
    D -->|Cost-sensitive| E[Choose cost-optimized architecture<br/>Review README for details]
    D -->|Budget flexible| F{Need data sovereignty?}

    C --> G{Regulatory requirements?}
    G -->|Yes - Compliance needed| H[Choose enterprise architecture<br/>Explicit resource control]
    G -->|No| I{Multi-team environment?}

    F -->|Yes| H
    F -->|No| E

    I -->|Yes| H
    I -->|No| J{Performance requirements?}

    J -->|High throughput| H
    J -->|Standard| E
```

### Architecture Evaluation Criteria

When comparing available architectures, consider these factors:

| Consideration | Questions to Ask | Look For in README |
|---------------|------------------|--------------------|
| **Cost** | What's my budget? | Pricing tier information, resource optimization |
| **Data Sovereignty** | Do I need explicit data control? | Resource management capabilities, compliance features |
| **Setup Complexity** | How quickly do I need to deploy? | Prerequisites, configuration requirements |
| **Team Support** | Single team or multi-team? | Access control patterns, sharing capabilities |
| **Compliance** | What regulations apply? | Security features, audit capabilities |
| **Performance** | What are my throughput needs? | Resource allocation, scalability features |

## Quick Start Steps

> **New to CAIRA?** Check out our [learning paths](#choose-your-learning-path) above for guided experiences tailored to your role and objectives.

For immediate deployment, follow these streamlined steps:

### 1. Choose Your Development Environment

#### Option A: Devcontainer (Recommended)

1. Open this repository in VS Code
1. When prompted, click "Reopen in Container"
1. Wait for the container to build (includes all required tools)

#### Option B: Local Setup

1. Follow the [Environment Setup Guide](../../docs/environment_setup.md)
1. Install required tools: Azure CLI, Terraform, Git

### 2. Azure Authentication

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "<your-subscription-id>"

# Set environment variable for Terraform
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
```

### 3. Choose Your Architecture

First, check what architectures are available:

```bash
ls reference_architectures/
```

Review each architecture's README.md to understand its purpose and capabilities:

| Architecture | Description | Best For |
|-------------|-------------|----------|
| Review each directory | Read individual README files | Match to your specific needs |

Consider factors like:

- **Use case**: Development vs. enterprise workloads
- **Budget**: Cost optimization vs. dedicated resources
- **Compliance**: Standard vs. enhanced regulatory features
- **Team size**: Individual vs. multi-team environments

### 4. Select Your Architecture

Navigate to your chosen architecture directory:

```bash
# Navigate to your chosen architecture
cd reference_architectures/{chosen_architecture}/
```

Review the architecture's README.md for specific setup instructions and configuration options.

### 5. Deploy Your Architecture

```bash
# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Deploy the infrastructure
terraform apply
```

**Deployment typically takes 15-30 minutes** depending on the architecture and components.

## Architecture Details

Each reference architecture in the `reference_architectures/` directory is designed for specific use cases and requirements. To understand the details of each architecture:

1. **Explore Available Architectures**:

   ```bash
   ls reference_architectures/
   ```

1. **Review Architecture Documentation**: Each architecture includes:
   - **README.md**: Complete architecture details, components, and use cases
   - **Architecture diagrams**: Visual representations of the deployed infrastructure
   - **Configuration examples**: Sample terraform.tfvars configurations
   - **Prerequisites**: Required tools and permissions

1. **Understand Components**: Each architecture README will detail:
   - **Purpose**: Target use cases and scenarios
   - **Components**: What Azure services and resources are deployed
   - **Configuration**: Available customization options
   - **Security**: Built-in security patterns and compliance features

## Key Components

The components deployed by each architecture vary based on the architecture's purpose and target use cases. Common components across CAIRA architectures typically include:

| Component Category | Purpose | Notes |
|-------------------|---------|-------|
| **AI Foundry Resources** | Central AI platform with model deployments | Core component in most architectures |
| **AI Projects** | Workspace for organizing AI work | Project-based organization |
| **Model Deployments** | Pre-deployed AI models | Architecture-specific model selections |
| **Monitoring & Observability** | Application performance monitoring | Varies by architecture complexity |
| **Data Services** | Database and storage services | Some architectures include dedicated services |
| **Search Services** | Search capabilities for AI applications | Architecture-dependent |

**To see specific components for each architecture**, review the individual README.md files in the `reference_architectures/` directory.

## Next Steps After Deployment

1. **Verify Deployment**: Check Azure Portal for created resources
1. **Access Services**:
   - For private deployments: Set up VPN connectivity
   - Test OpenAI endpoints and AI Search services
1. **Explore Documentation**:
   - [Developer Guide](../../docs/developer.md) for advanced usage
   - [Security Practices](../../SECURITY.md) for security guidance
1. **Start Building**: Begin developing your AI applications using the deployed infrastructure

## Common Configuration Options

Each architecture supports customization through Terraform variables. Refer to the architecture-specific README files for detailed configuration options available for your chosen architecture.

Example basic configuration pattern:

```hcl
# Basic Configuration
location = "swedencentral"

# Architecture-specific variables
# (see individual architecture README for available options)
```

## Troubleshooting

If you encounter issues:

1. **Check Prerequisites**: Ensure Azure CLI is logged in and subscription is set
1. **Review Logs**: Check Terraform output for specific error messages
1. **Consult Documentation**:
   - [Troubleshooting Guide](../../docs/troubleshooting.md)
   - Architecture-specific README files
1. **Get Help**: Review [Contributing Guidelines](../../CONTRIBUTING.md) for support options

## Cleanup

To remove deployed resources:

```bash
# Using Terraform (recommended)
terraform destroy

# Or delete resource group in Azure Portal
az group delete --name <resource-group-name>
```

## Learning Resources

- **CAIRA Overview**: [Main README](../../README.md)
- **Security Guidelines**: [Security Practices](../../SECURITY.md)
- **Development Workflow**: [Contributing Guide](../../docs/contributing/development_workflow.md)

## Support

For questions and support:

- Review existing documentation in the `docs/` directory
- Check the [Troubleshooting Guide](../../docs/troubleshooting.md)
- See [Contributing Guidelines](../../CONTRIBUTING.md) for community support options
