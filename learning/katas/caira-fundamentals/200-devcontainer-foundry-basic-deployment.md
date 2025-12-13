---
# Core Metadata
title: "Kata: Devcontainer & Foundry Basic Deployment"
description: Deploy CAIRA foundry_basic architecture using devcontainer workflow with AI-assisted Terraform deployment and validation
author: HVE Essentials Team
ms.date: 2025-12-02
ms.topic: how-to-guide

# Kata Identity
kata_id: caira-fundamentals-200-devcontainer-foundry-basic-deployment
kata_category:
  - caira-fundamentals
kata_difficulty: 2
estimated_time_minutes: 39
requires_dev_container: true

# Learning Content
learning_objectives:
  - Develop inside CAIRA devcontainer with all tools pre-configured
  - Authenticate Azure CLI within containerized development environment
  - Use caira-assistant chatmode for guided Terraform deployment workflow
  - Execute complete Terraform lifecycle (init, plan, apply) safely
  - Make informed configuration decisions for variable management
  - Validate successful Azure AI Foundry infrastructure deployment
prerequisite_katas:
  - caira-fundamentals-100-gathering-requirements-with-caira-assistant
  - caira-fundamentals-150-understanding-architecture-patterns
technologies:
  - Docker
  - VS Code Dev Containers
  - CAIRA
  - Terraform
  - Azure CLI
  - Azure AI Foundry
  - caira-assistant chatmode
success_criteria:
  - Devcontainer opened successfully with all tools available
  - Azure CLI authenticated and subscription verified
  - Terraform initialized without errors in foundry_basic directory
  - Plan reviewed showing only expected resource creations
  - Infrastructure deployed successfully to Azure
  - All expected resources visible in Azure Portal
  - Can explain devcontainer benefits and deployment workflow

# AI Coaching
ai_coaching_level: guided
scaffolding_level: medium-heavy
hint_strategy: progressive
common_pitfalls:
  - Docker Desktop not running before opening devcontainer
  - Skipping Azure CLI login step inside container (authentication scoped to container)
  - Applying Terraform without reviewing plan first
  - Insufficient Azure permissions (need Contributor + User Access Administrator)
  - Not setting ARM_SUBSCRIPTION_ID environment variable before Terraform commands
  - Using non-existent variable names (e.g., resource_group_name instead of resource_group_resource_id)
  - Providing resource_group_resource_id when you want auto-creation (leave it unset/null for auto-create)
  - Deploying to regions without AI model availability (use eastus for best compatibility)

# Requirements
requires_azure_subscription: true
requires_local_environment: true
requires_github_account: false

# SEO & Discoverability
tags:
  - caira-fundamentals
  - ai-assisted-engineering
search_keywords:
  - CAIRA devcontainer deployment
  - Azure AI Foundry terraform
  - caira-assistant guided deployment
  - foundry_basic architecture
  - containerized development workflow
real_world_application: New team members onboard to CAIRA platform by deploying foundry_basic architecture using standardized devcontainer environment, following AI-assisted workflow that ensures safe configuration and deployment practices aligned with team standards
---

<!--
AI_COACH: This kata introduces hands-on Terraform deployment within devcontainer.
Guide learners to ALWAYS review terraform plan output before apply. If they rush
to apply without reviewing, remind them this is a critical safety practice.
The caira-assistant chatmode is recommended (but optional) for validation checkpoints.
-->

## Quick Context

**You'll Learn**: How to deploy CAIRA's foundry_basic architecture using the built-in devcontainer environment and AI-assisted deployment workflow for safe, guided infrastructure provisioning.

**Real Challenge**: Your team needs a standardized way to onboard new engineers to the CAIRA platform. Everyone should use the same development environment with pre-configured tools, follow consistent deployment workflows, and leverage AI assistance to avoid common configuration mistakes. You're the first to validate this workflow.

**Your Task**: Open CAIRA in VS Code devcontainer, authenticate with Azure, optionally use caira-assistant chatmode to guide your deployment decisions, and successfully deploy the foundry_basic architecture with proper validation at each step.

## Essential Setup

**Required** (check these first):

- [ ] Docker Desktop installed and **running** (check status bar/tray icon)
- [ ] VS Code installed with **Dev Containers extension** (ms-vscode-remote.remote-containers) - **MUST be installed before opening CAIRA repo**
- [ ] CAIRA repository cloned locally (`git clone https://github.com/microsoft/CAIRA.git`)
- [ ] Azure subscription with these permissions: **Contributor** + **User Access Administrator** (or **Owner**)
- [ ] Azure CLI authentication capability (browser or device code flow available)
- [ ] Completed Kata 150 (Understanding CAIRA Architecture Patterns)

**Important**: Use a **separate VS Code instance** (not this one) to work through the kata steps. This kata instance should remain open for reference and progress tracking while you work in the CAIRA repository.

**Quick Validation**: Open Docker Desktop and confirm it shows "Engine running". In VS Code, verify the Remote - Containers extension is installed and enabled.

> **🤖 Want Interactive AI Coaching?**
>
> Load the **Learning Kata Coach** chat mode for task check-offs, progress tracking, progressive hints, and personalized guidance.
>
> In GitHub Copilot Chat, select **Learning Kata Coach** mode and say:
>
> ```text
> I'm working on the Devcontainer & Foundry Basic Deployment kata and want guidance for deploying foundry_basic architecture.
> ```

## Practice Tasks

### Task 1: Launch Devcontainer & Verify Environment (10 minutes)

**What You'll Do**: Open the CAIRA repository in a VS Code devcontainer and verify all development tools are available and properly configured.

**Steps**:

1. **Open** CAIRA repository in VS Code
   - [ ] Launch a **new VS Code window** (separate from this kata instance)
   - [ ] Open the folder containing your cloned CAIRA repository
   - [ ] Wait for VS Code to detect the `.devcontainer` configuration
   - **Pro tip**: VS Code should show a notification "Folder contains a Dev Container configuration file"
   - **Note**: Keep this kata window open for reference while working in the CAIRA window

2. **Reopen** in devcontainer
   - [ ] Click "Reopen in Container" when prompted (or use Command Palette: "Dev Containers: Reopen in Container")
   - [ ] Wait for container build and initialization (first time: 3-5 minutes; subsequent: 30-60 seconds)
   - [ ] Verify status bar shows "Dev Container: CAIRA"
   - **Expected result**: Terminal opens inside container with vscode@[container-id] prompt

3. **Verify** development tools inside container
   - [ ] Open terminal in VS Code (should be inside container)
   - [ ] Run: `terraform version` (should show v1.13 or later)
   - [ ] Run: `az version` (should show Azure CLI version info)
   - [ ] Run: `which docker` (should show path, confirming Docker-outside-of-Docker works)
   - **Success check**: All three commands return version information without errors

4. **Authenticate** with Azure CLI inside container
   - [ ] Run: `az login` in terminal
   - [ ] Complete authentication flow (browser or device code)
   - [ ] Verify authentication: `az account show`
   - **Validation checkpoint**: Output shows your subscription details in JSON format
   - **Expected result**: You are now authenticated to Azure from within the container

### Task 2: Configure Deployment with AI Assistance (12 minutes)

**What You'll Do**: Review variable requirements and prepare your Terraform variables for foundry_basic deployment. Optionally use caira-assistant chatmode for guided recommendations.

**Steps**:

1. **Activate** caira-assistant chatmode (optional but recommended)
   - [ ] Open GitHub Copilot Chat in VS Code
   - [ ] Select **caira-assistant** mode from the dropdown if available
   - [ ] Ask: "I want to deploy foundry_basic. What are the required variables and recommended configuration approach?"
   - **Pro tip**: The assistant will explain terraform.tfvars vs main.tf variable approaches
   - **Note**: You can complete this kata without caira-assistant by reviewing the files directly

2. **Navigate** to foundry_basic directory
   - [ ] In terminal: `cd reference_architectures/foundry_basic`
   - [ ] List contents: `ls -la`
   - [ ] Verify you see: main.tf, variables.tf, outputs.tf, README.md
   - **Expected result**: You're in the correct deployment directory

3. **Review** variable requirements
   - [ ] Open `variables.tf` and scan for required variables (those without defaults)
   - [ ] Identify available variables: `location`, `resource_group_resource_id`, `sku`, `enable_telemetry`, `tags`
   - [ ] Optional: Ask caira-assistant: "Which variables are required vs optional for minimal foundry_basic deployment?"
   - **Validation checkpoint**: ALL variables have defaults - deployment works with zero configuration! Location defaults to swedencentral, resource group auto-creates with unique name

4. **Choose** configuration method
   - [ ] Optional: Ask caira-assistant: "Should I create terraform.tfvars or set variables via command line for this deployment?"
   - [ ] Recommendation: Create `terraform.tfvars` file for configuration (tfvars is cleaner for multiple variables)
   - [ ] Decision: Create `terraform.tfvars` file for configuration
   - **Pro tip**: Using tfvars keeps your configuration reusable and version-controllable

5. **Create** terraform.tfvars file (optional - customize deployment)
   - [ ] Create file: `touch terraform.tfvars`
   - [ ] Open in editor and add optional configuration to override defaults:

   ```hcl
   # Optional: Override default location (default is swedencentral)
   # Recommended: eastus for best AI model availability
   location = "eastus"

   # Optional: Use existing resource group instead of auto-creating one
   # resource_group_resource_id = "/subscriptions/YOUR_SUB_ID/resourceGroups/rg-existing"

   # Optional: Override SKU (default is S0)
   # sku = "S0"
   ```

   - [ ] **Note**: All variables have defaults - empty terraform.tfvars works fine!
   - [ ] Save the file
   - **Success check**: terraform.tfvars exists (can be empty or with location override)

### Task 3: Execute Terraform Deployment Workflow (15 minutes)

**What You'll Do**: Run the complete Terraform deployment lifecycle (init → plan → apply) with AI-assisted validation at each checkpoint to safely provision Azure AI Foundry infrastructure.

**Steps**:

1. **Set** ARM_SUBSCRIPTION_ID environment variable
   - [ ] Run: `export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)`
   - [ ] Verify: `echo $ARM_SUBSCRIPTION_ID` (should show your subscription ID)
   - **Pro tip**: Terraform AzureRM provider needs this environment variable for authentication
   - **Expected result**: Environment variable set correctly for current terminal session

2. **Initialize** Terraform
   - [ ] Run: `terraform init`
   - [ ] Observe provider downloads (azurerm, azapi)
   - [ ] Look for: "Terraform has been successfully initialized!"
   - **Validation checkpoint**: No errors about provider configuration or backend initialization
   - **Expected result**: .terraform directory created with providers installed

3. **Generate** and review plan
   - [ ] Run: `terraform plan -out=tfplan`
   - [ ] **CRITICAL**: Read the plan output carefully
   - [ ] Count resources to be created (should be ~20 resources: 1 resource group + 19 AI Foundry resources)
   - [ ] Verify resource types include: azurerm_resource_group (auto-created), azurerm_log_analytics_workspace, azurerm_application_insights, azapi_resource (AI Foundry and project), azurerm_cognitive_deployment (3 model deployments)
   - [ ] Confirm resource group name follows pattern: `rg-basic-XXXXX` (auto-generated unique name)
   - [ ] Optional: Ask caira-assistant: "Review this terraform plan output - does it look correct for foundry_basic minimal deployment?"
   - **Success check**: Plan shows only "create" actions (no updates or deletes), resource count matches expectation, resource group being created

4. **Apply** the deployment
   - [ ] Run: `terraform apply tfplan`
   - [ ] Observe resource creation progress (takes 3-5 minutes)
   - [ ] Watch for: "Apply complete! Resources: X added, 0 changed, 0 destroyed."
   - **Pro tip**: Don't interrupt the apply process - let it complete fully
   - **Expected result**: Successful deployment with no errors

5. **Capture** deployment outputs
   - [ ] Run: `terraform output`
   - [ ] Note the resource_group_name, ai_foundry_default_project_id, and other outputs
   - [ ] Copy resource_group_name for next task validation
   - **Validation checkpoint**: Outputs show deployed resource identifiers

6. **Verify** in Azure Portal
   - [ ] Open Azure Portal in browser
   - [ ] Navigate to Resource Groups
   - [ ] Find your deployed resource group (look for `rg-basic-XXXXX` with auto-generated suffix)
   - [ ] Confirm resources exist: AI Foundry, AI Foundry project, Log Analytics Workspace, Application Insights
   - **Success check**: All expected resources visible and show "Succeeded" deployment state

### Task 4: Explore Deployed Resources in Azure Portal (8 minutes)

**What You'll Do**: Navigate through Azure Portal and AI Foundry portal to understand the deployed infrastructure, verify resource configurations, and explore the AI project workspace.

**Steps**:

1. **Examine** resource group contents
   - [ ] In Azure Portal, open your resource group (rg-basic-XXXXX)
   - [ ] Identify each resource and its type:
     - **AI Foundry** - The AI Foundry resource for managing AI services
     - **AI Foundry project** - Your workspace for AI development
     - **Log Analytics Workspace** - Centralized logging and monitoring
     - **Application Insights** - Application performance monitoring
   - [ ] Click on each resource to view its Overview page
   - **Validation checkpoint**: AI Foundry resource shows "Status: Succeeded" on Overview page
   - **Expected result**: Understanding of how Terraform resources map to Azure Portal resources

2. **Launch** Foundry portal
   - [ ] Return to the AI Foundry resource in Azure Portal
   - [ ] Look for the "Go to Azure AI Foundry portal" button at the top of the Overview page
   - [ ] Click the button to launch the Foundry portal (opens <https://ai.azure.com>)
   - [ ] Sign in with your Azure credentials if prompted
   - [ ] Verify your project appears in the project list
   - **Expected result**: Foundry portal opens and shows your deployed project

3. **Explore** Foundry project workspace
   - [ ] In the Foundry portal, click on your project to open the project workspace
   - [ ] Navigate to "Models + endpoints" in left menu
   - [ ] Verify model deployments exist:
     - **gpt-4** (or gpt-4.1) - Chat completion model
     - **text-embedding-3-large** - Embedding model for semantic search
     - **o4-mini** - Reasoning model
   - [ ] Click on one model deployment to see its configuration (version, rate limits, region)
   - **Validation checkpoint**: All three model deployments show "Succeeded" status
   - **Expected result**: Understanding what models are immediately available for development

4. **Review** project workspace
   - [ ] Explore the available sections in the left menu
   - [ ] Check the project Overview page to see basic information
   - [ ] Familiarize yourself with the project workspace layout and navigation
   - **Pro tip**: The project workspace provides access to AI development tools and model configurations
   - **Expected result**: Understanding the project's structure and available features

5. **Verify** monitoring resources in Azure Portal
   - [ ] Return to Azure Portal and open your resource group
   - [ ] Click on the Application Insights resource
   - [ ] Confirm it shows "Status: Succeeded" on the Overview page
   - [ ] Click on the Log Analytics Workspace resource
   - [ ] Confirm it shows "Status: Active" and is ready to collect logs
   - **Success check**: Monitoring resources are deployed and ready to capture metrics once you start using the models

## Completion Check

**You've Succeeded When**:

- [ ] Devcontainer opened successfully and all development tools verified
- [ ] Azure CLI authenticated within container environment
- [ ] Reviewed configuration approach (with or without caira-assistant)
- [ ] terraform.tfvars created with correct location settings (or left empty to use defaults)
- [ ] Terraform initialization completed without errors
- [ ] Terraform plan reviewed and validated before applying
- [ ] Infrastructure deployed successfully (apply completed with 0 errors)
- [ ] All expected resources visible and healthy in Azure Portal
- [ ] Explored Azure Portal and identified all deployed resources (AI Foundry, project, Log Analytics, App Insights)
- [ ] Navigated Foundry portal and reviewed project workspace
- [ ] Verified three model deployments (gpt-4, text-embedding-3-large, o4-mini) are active
- [ ] Understand AI Foundry and project relationship and observability stack configuration
- [ ] Can explain benefits of devcontainer for team standardization
- [ ] Can describe the Terraform deployment workflow (init → plan → apply)

**Next Steps**: Ready to learn troubleshooting? Continue to **Kata 300: Troubleshooting CAIRA Deployments** to handle common deployment issues. Or customize your deployment in **Kata 400: Customizing CAIRA for Your Requirements**.

---

## Reference Appendix

### Help Resources

- **CAIRA Assistant Chatmode**: Use throughout deployment for decision validation and troubleshooting
- **foundry_basic README**: `external/caira/reference_architectures/foundry_basic/README.md` - detailed architecture documentation
- **Terraform Documentation**: Official Terraform CLI command reference
- **Azure AI Foundry Docs**: Microsoft Learn documentation for Azure AI services
- **Dev Containers Documentation**: VS Code development container configuration reference

### Professional Tips

**Devcontainer Benefits for Teams**:

- **Consistent Environment**: Everyone uses identical tool versions (Terraform, Azure CLI, Python)
- **Fast Onboarding**: New team members productive in minutes, not hours
- **Isolated Dependencies**: Container keeps project tools separate from local machine
- **Reproducible Builds**: Same container configuration ensures identical behavior across team

**Terraform Workflow Best Practices**:

```bash
# Always follow this safe deployment pattern:
terraform init      # Install providers and initialize backend
terraform plan      # Preview changes BEFORE applying
terraform apply     # Execute changes after review

# For ongoing changes:
terraform plan -out=tfplan    # Save plan to file
# Review the plan output carefully
terraform apply tfplan        # Apply the reviewed plan
```

**Configuration Management Decision Tree**:

- **Single deployment, few variables** → Command line: `terraform apply -var="subscription_id=..."`
- **Repeatable deployment, multiple variables** → terraform.tfvars file (recommended)
- **Multiple environments** → Separate .tfvars files per environment (dev.tfvars, prod.tfvars)
- **Sensitive values** → Environment variables + .tfvars for non-sensitive
- **Team collaboration** → terraform.tfvars.example (template) + gitignored terraform.tfvars (local)

### Troubleshooting

**Issue**: "Reopen in Container" doesn't appear or fails

- **Check Docker**: Ensure Docker Desktop is running (status bar shows "Engine running")
- **Extension Installed**: Verify Remote - Containers extension is installed in VS Code
- **Docker Resources**: Check Docker Desktop has sufficient memory (8GB+ recommended)
- **Rebuild**: Try Command Palette → "Dev Containers: Rebuild Container"

**Issue**: `az login` fails inside container

- **Browser Access**: Ensure container can open browser for authentication flow
- **Device Code**: Try `az login --use-device-code` for alternate authentication method
- **Corporate Network**: Check if proxy or firewall blocks Azure authentication endpoints
- **Manual Token**: Use `az login --use-device-code` and follow the URL instructions

**Issue**: `terraform init` fails with provider download errors

- **Network Connectivity**: Container needs internet access to download providers from registry.terraform.io
- **Proxy Configuration**: Set HTTP_PROXY and HTTPS_PROXY environment variables if behind proxy
- **Registry Mirror**: Configure Terraform registry mirror if direct access blocked
- **Manual Download**: Download providers manually and place in .terraform directory as last resort

**Issue**: `terraform plan` shows errors about insufficient permissions

- **RBAC Roles**: Verify you have both Contributor AND User Access Administrator roles
- **Subscription Scope**: Ensure roles are assigned at subscription or resource group scope
- **Cached Credentials**: Run `az account clear` then `az login` to refresh authentication
- **ARM_SUBSCRIPTION_ID**: Verify environment variable is set: `echo $ARM_SUBSCRIPTION_ID`

**Issue**: `terraform apply` fails with quota exceeded errors

- **Check Quotas**: Run `az vm list-usage --location eastus -o table` to see current quotas
- **Request Increase**: Submit quota increase request through Azure Portal (Support → Quotas)
- **Different Region**: Try deploying to alternate region with available quota
- **Resource SKUs**: Some regions have limited SKU availability for AI services

**Issue**: Terraform fails with "ResourceGroupNotFound" error

- **Root Cause**: You provided `resource_group_resource_id` pointing to non-existent resource group
- **Solution 1**: Remove `resource_group_resource_id` from terraform.tfvars to let Terraform auto-create the resource group
- **Solution 2**: Create the resource group first: `az group create --name <name> --location <location>`, then provide full resource ID
- **Solution 3**: Use an existing resource group by providing its full resource ID
- **Verify**: Check `terraform plan` shows `azurerm_resource_group.this` being created when auto-creating

**Issue**: Resources deployed but not visible in Azure Portal

- **Subscription Filter**: Check Portal subscription filter includes your deployment subscription
- **Resource Group Name**: Verify you're looking at correct resource group (check terraform output)
- **Refresh Portal**: Click refresh in Portal - newly created resources may take 30-60 seconds
- **Deployment Status**: Check resource group → Deployments to see creation status

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->

<!-- Reference Links -->
