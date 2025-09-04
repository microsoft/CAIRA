# Deploy CAIRA Reference Architectures

This guide provides comprehensive instructions for deploying CAIRA's enterprise-grade AI reference architectures on Azure.

## Prerequisites

Before deploying any CAIRA architecture, ensure you have:

- Azure subscription with appropriate permissions
- Azure CLI installed and authenticated
- Terraform >= 1.10.0 installed
- Access to all Azure resource types in your chosen reference architecture

**Environment Setup**: If you need help with environment setup, start with the [Environment Setup Guide](../../docs/environment_setup.md).

## Deployment Process

### Step 1: Choose Your Architecture

First, check the available reference architectures:

```bash
ls reference_architectures/
```

Based on the available architectures, **ALWAYS present options and wait for user confirmation** before proceeding. Review each architecture's README.md to understand:

- **Target use case**: Development vs. enterprise workloads
- **Security requirements**: Basic vs. advanced compliance needs
- **Resource control**: Simplified vs. explicit resource management
- **Cost considerations**: Standard vs. optimized pricing tiers

**CRITICAL**: Present ALL relevant architectures that match the user's stated requirements with clear explanations, then **explicitly ask the user to choose** before proceeding to the next step. If there are many options, group them by category (e.g., basic vs enterprise, public vs private). Do not assume or auto-select an architecture.

### Step 2: Navigate to Architecture Directory

```bash
cd reference_architectures/{chosen_architecture}
```

### Step 3: Review Architecture Documentation

- **MANDATORY**: Read the architecture's README.md completely
- Understand the resources that will be deployed
- Review the architecture diagram and components
- Understand RBAC patterns and security configurations

### Step 4: Environment Authentication

Verify Azure authentication and subscription setup:

```bash
# Login to Azure
az login

# Set active subscription
az account set --subscription "<subscription_id>"

# Export subscription ID for Terraform
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Verify setup
az account show
echo $ARM_SUBSCRIPTION_ID
```

## Deploying Reference Architectures

### Step 5: Configure Deployment Variables

CAIRA reference architectures use Terraform variables for configuration. Since there are no pre-configured `.tfvars` files, you'll need to set variables directly or create your own configuration file.

#### Create Your Configuration File

Create a `terraform.tfvars` file in your chosen architecture directory:

```bash
# Create configuration file
touch terraform.tfvars
```

#### Configure Key Variables

Edit the `terraform.tfvars` file with your environment-specific values. Review the architecture's `variables.tf` file for all available configuration options.

**Example Configuration:**

```hcl
# Required Configuration
location             = "swedencentral"
project_name         = "my-ai-project"
project_display_name = "My AI Project"
project_description  = "AI project description"

# Optional Configuration (varies by architecture)
resource_group_resource_id = null # Will create new resource group
sku                        = "S0" # Standard pricing tier
enable_telemetry           = true

# Tags for resource organization
tags = {
  environment = "development"
  project     = "ai-experimentation"
  owner       = "your-team"
}
```

**Important**: Each architecture may have different required and optional variables. Always check the specific architecture's `variables.tf` and README.md for complete configuration options.

Use a Markdown checklist when updating multiple parameters with the user.

### Step 6: Initialize and Plan Deployment

```bash
# Initialize Terraform
terraform init

# Create and save the deployment plan
terraform plan -var-file=terraform.tfvars -out=deployment.tfplan

# Review the saved plan (optional - shows human-readable output)
terraform show deployment.tfplan
```

**Important**: Review the Terraform plan output carefully with the user to ensure:

- Correct resources will be created
- No unexpected deletions or modifications
- Resource names are unique and follow conventions
- Security configurations match requirements
- The saved plan file (`deployment.tfplan`) can be used for auditing and compliance

**MANDATORY USER CONFIRMATION**: After showing the plan output, **explicitly ask the user if they want to proceed with deployment** before running `terraform apply`. Present the plan summary and wait for explicit confirmation.

### Step 7: Deploy Architecture (User Confirmation Required)

**ONLY after explicit user confirmation**, proceed with deployment:

```bash
# Deploy using the saved plan
terraform apply deployment.tfplan
```

**Deployment Monitoring**:

- Wait for Azure CLI commands to complete (some operations take 10-30 minutes)
- Monitor deployment progress and provide updates
- Watch for any errors or warnings during deployment

### Step 8: Post-Deployment Verification

After successful deployment:

1. **Verify Resources**: Check Azure Portal for created resources
1. **Test Connectivity**:
   - Access Azure AI Foundry Studio portal
   - Verify the AI project is accessible
1. **Validate Configuration**: Confirm AI Foundry project and model deployments
1. **Test AI Services**: Test deployed models (GPT-4.1 by default) through the AI Foundry interface

## Architecture-Specific Considerations

Each reference architecture has unique characteristics and target scenarios. Before deployment:

1. **Read the Architecture README**: Each architecture's README.md contains:
   - Target use cases and scenarios
   - Component descriptions and configurations
   - Security and compliance features
   - Cost considerations
   - Prerequisites and limitations

1. **Review Architecture Diagrams**: Visual representations help understand:
   - Resource relationships and dependencies
   - Data flow and security boundaries
   - Network topology and access patterns

1. **Understand Resource Management**: Different architectures may:
   - Create new resources vs. use existing ones
   - Have different RBAC and security configurations
   - Require different levels of Azure permissions
   - Support different customization options

Always consult the specific architecture's documentation for detailed considerations.

## Custom Module Deployment

For deploying individual CAIRA modules (advanced use case):

1. **Review Module Documentation**: Read the specific module's README.md
1. **Understand Dependencies**: Check required inputs from other modules
1. **Configure Variables**: Set up module-specific variables
1. **Deploy in Dependency Order**: Follow the module dependency chain

Example module deployment order:

```text
naming -> `ai_foundry` -> networking -> security
```

## Troubleshooting

If you encounter deployment issues, see the [Troubleshooting Guide](../../docs/troubleshooting.md) for comprehensive solutions.

## Advanced Deployment Patterns

### Multi-Environment Pipeline

- Use separate `terraform.tfvars` files for each environment
- Implement proper promotion workflows between different architectures
- Maintain environment isolation with different Azure subscriptions or resource groups
- Consider architecture progression (simple to complex) as requirements evolve

### Custom Configurations

- Extend existing configurations with additional Terraform variables
- Use simpler architectures as starting points for custom solutions
- Follow CAIRA patterns and conventions for consistency
- Review module documentation for extension points

### Enterprise Integration

- Choose architectures that support bring-your-own resource scenarios
- Integrate with existing Azure services based on architecture capabilities
- Plan integration strategy based on compliance and regulatory requirements
- Consider data sovereignty and resource control features

Remember: Always read the specific reference architecture's README.md completely before deployment for architecture-specific requirements and considerations.
