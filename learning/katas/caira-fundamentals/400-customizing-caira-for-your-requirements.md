---
# Core Metadata
title: "Kata: Customizing CAIRA for Your Requirements"
description: Customize CAIRA reference architectures by tuning Terraform variables, selecting deployment patterns, and validating changes with safe plan-based workflows.
author: HVE Essentials Team
ms.date: 2025-12-11
ms.topic: how-to-guide

# Kata Identity
kata_id: caira-fundamentals-400-customizing-caira-for-your-requirements
kata_category:
  - caira-fundamentals
kata_difficulty: 3
estimated_time_minutes: 45
requires_dev_container: true

# Learning Content
learning_objectives:
  - Identify the CAIRA customization points that matter most (architecture choice, networking model, and resource control)
  - Customize deployment behavior using supported Terraform variables and `terraform.tfvars`
  - Validate customization changes safely using `terraform validate` and `terraform plan`
  - Create a repeatable customization checklist your team can apply across environments
prerequisite_katas:
  - caira-fundamentals-150-understanding-architecture-patterns
  - caira-fundamentals-200-devcontainer-foundry-basic-deployment
technologies:
  - CAIRA
  - Terraform
  - Azure AI Foundry
  - Azure CLI
  - VS Code Dev Containers
success_criteria:
  - Produced a complete customization checklist covering architecture, networking, and environment settings
  - Created a working `terraform.tfvars` customization file aligned with `variables.tf`
  - Generated a clean `terraform plan` showing only intended changes
  - Documented a reusable customization plan for at least two environments (dev and prod)

# AI Coaching
ai_coaching_level: guided
scaffolding_level: medium-heavy
hint_strategy: progressive
hint_frequency: strategic
common_pitfalls:
  - Overriding variables that break module dependencies or internal resource references
  - Creating naming conventions that violate Azure resource name length limits (24 chars for storage accounts)
  - Forgetting to document WHY customizations were made (future maintainers need context)
  - Not testing customizations in non-production before applying to production
  - Choosing Premium SKUs without understanding cost implications and workload requirements
  - Assuming all organizational requirements can be met with current CAIRA variables

# Requirements
requires_azure_subscription: true
requires_local_environment: true
requires_github_account: false

# SEO & Discoverability
tags:
  - caira-fundamentals
  - ai-assisted-engineering
search_keywords:
  - customize CAIRA terraform
  - CAIRA configuration variables
  - Azure AI Foundry architecture customization
  - terraform.tfvars best practices
  - safe terraform plan workflow
real_world_application: Platform engineers tailor CAIRA deployments to match organizational requirements for regions, networking isolation, tagging standards, and environment separation while maintaining safe infrastructure-as-code workflows.

# Optional Fields
related_katas:
  - troubleshooting-300-troubleshooting-caira-deployments
related_labs: []
skill_assessment_id: ""
validation_commands:
  - terraform fmt -check
  - terraform validate
  - terraform plan
  - az account show
chatmode_references:
  - caira-assistant
  - learning-kata-coach
file_references:
  - reference_architectures/README.md
  - reference_architectures/foundry_basic/variables.tf
  - reference_architectures/foundry_basic/main.tf
  - reference_architectures/foundry_basic/terraform.tfvars
troubleshooting_guide: "../../../docs/troubleshooting.md"
---

<!--
CHECKBOX STRUCTURE GUIDANCE FOR CONTENT GENERATION:

✅ DO - Use flat checkbox structure:
- [ ] Complete step 1
- [ ] Complete step 2
- [ ] Verify result

❌ DON'T - Nest content under checkboxes (causes CSS strikethrough issues):
- [ ] Setup validation - with nested content below
  - Nested bullet (causes CSS issues)
  - Another nested item

Instead use:
- Numbered steps for grouping
- Bold text for emphasis
- Inline em-dashed lists for multiple items
- Separate flat checkboxes with prefixes
-->

## Quick Context

### You'll Learn

- How CAIRA customization maps to business requirements (architecture, networking, and resource control)
- How to use `variables.tf` and `terraform.tfvars` to customize deployments cleanly
- How to validate changes safely with `terraform validate` and `terraform plan`
- How to document reusable customization decisions for dev/prod environments

### Prerequisites

- Completed [Kata 150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md)
- Completed [Kata 200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md)
- Azure subscription with **Contributor** + **User Access Administrator** (or **Owner**)
- CAIRA repository cloned locally

### Real Challenge

You're a platform engineer preparing CAIRA infrastructure for a production AI team. Your organization has specific requirements that don't match CAIRA defaults:

**Organizational Requirements**:
- **Data Residency**: Resources must deploy to Canada Central (not default swedencentral)
- **Resource Naming**: Customize the base_name used by CAIRA's Azure naming module to align with organizational standards (currently hardcoded)
- **Governance Tags**: Include cost center tags (CC-12345), department allocation, and compliance markers
- **SKU Selection**: Override AI Foundry SKU based on workload requirements (default is S0)

**Your Task**: Customize `foundry_basic` deployment using `terraform.tfvars` to meet organizational requirements where possible, document customization decisions and any limitations (like hardcoded base_name), validate the configuration doesn't break CAIRA module contracts, and create a reusable customization template for future deployments.

## Essential Setup

**Required** (check these first):

- [ ] CAIRA repository cloned locally
- [ ] VS Code with Dev Containers extension installed
- [ ] Docker Desktop installed and running
- [ ] Azure CLI authenticated in your devcontainer (`az account show` works)

**Quick Validation**: In the devcontainer terminal, run `terraform version && az account show` and confirm both succeed.

> **🤖 Want Interactive AI Coaching?**
>
> Load the **Learning Kata Coach** chat mode for task check-offs, progress tracking, progressive hints, and personalized guidance.
>
> In GitHub Copilot Chat, select **Learning Kata Coach** mode and say:
>
> ```text
> I'm working on Customizing CAIRA for Your Requirements and want interactive coaching with progress tracking.
> ```

## Practice Tasks

### Task 1: Analyze Requirements and Discover Available Variables (15 minutes)

<!-- AI_COACH: Learners often jump straight into editing main.tf. Encourage them to start by thoroughly reviewing variables.tf to understand what's customizable. Ask them to identify which organizational requirements map to which Terraform variables. Have them think about module contracts - what can be safely overridden vs what would break dependencies. -->

**What You'll Do**: Analyze organizational requirements, explore available customization variables in `foundry_standard`, and document your customization strategy.

**Steps**:

1. **Review** organizational requirements
   - [ ] Open the Real Challenge section and list all 4 requirements (data residency, naming, tags, SKU)
   - [ ] Prioritize requirements as "must have" vs "nice to have"
   - [ ] Identify which requirements affect cost or compliance
   - [ ] Identify which requirements can be met via terraform.tfvars vs require editing main.tf
   - [ ] **Expected result**: Clear understanding of what needs to be customized and what's achievable

2. **Discover** available customization points
   - [ ] Navigate to `reference_architectures/foundry_basic/`
   - [ ] Open `variables.tf` and review all available variables (location, tags, sku, enable_telemetry, resource_group_resource_id)
   - [ ] Open `terraform.tfvars` to see current configuration values
   - [ ] Open `main.tf` and find the `locals` block to understand how `base_name` is constructed (used by Azure naming module)
   - [ ] Note that `base_name` is hardcoded in locals and NOT exposed as a variable
   - [ ] **Expected result**: List of customizable variables and documented limitations (base_name not customizable via tfvars)

3. **Document** your customization strategy
   - [ ] Create `caira-customization-strategy.md` in your workspace
   - [ ] Map customizable requirements to Terraform variables (location→location, tags→tags, SKU→sku)
   - [ ] Document limitations: base_name is hardcoded in locals, not customizable via tfvars without editing main.tf
   - [ ] Document rationale for SKU choice (S0 is default, sufficient for basic deployments)
   - [ ] Note trade-offs: staying with tfvars-only approach vs forking to customize base_name
   - [ ] **Expected result**: Clear customization plan with both what's achievable and documented limitations

### Task 2: Implement Customization via `terraform.tfvars` (18 minutes)

<!-- AI_COACH: If learners aren’t sure what to customize, guide them to search variables.tf for defaults and required values. Ask them to explain why tfvars is safer than editing module code. Encourage them to keep decisions in one place and to avoid adding new unsupported variables. -->

**What You'll Do**: Create environment-specific `terraform.tfvars` files using only supported variables, aligned with `variables.tf`.

**Steps**:

1. **Set** ARM_SUBSCRIPTION_ID environment variable
   - [ ] Run: `export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)`
   - [ ] Verify: `echo $ARM_SUBSCRIPTION_ID` (should show your subscription ID)
   - **Pro tip**: Terraform AzureRM provider needs this environment variable for authentication
   - [ ] **Expected result**: Environment variable set correctly for current terminal session

2. **Review** what is configurable
   - [ ] Open `variables.tf` in your chosen architecture folder
   - [ ] Identify the variables you want to set explicitly (location, tags, resource group settings, telemetry settings)
   - **Validation checkpoint**: Can you find each variable name and type in `variables.tf`?
   - [ ] **Expected result**: You have a short list of supported variables to override

3. **Create** a dev configuration file
   - [ ] In your chosen architecture folder, create `terraform.dev.tfvars`
   - [ ] Add location and tags aligned with your `caira-customization-plan.md`
   - [ ] Keep the file minimal: only override values you must control
   - [ ] **Expected result**: A valid dev tfvars file with organization-approved values

4. **Create** a prod configuration file
   - [ ] Create `terraform.prod.tfvars`
   - [ ] Configure region and tags for prod
   - [ ] If your organization requires existing resource groups, set the correct resource group ID (only if the architecture supports it)
   - [ ] **Expected result**: A valid prod tfvars file that matches stricter requirements

5. **Format** Terraform and confirm no syntax errors
   - [ ] Run `terraform fmt -recursive`
   - [ ] Run `terraform validate`
   - [ ] **Expected result**: `terraform validate` succeeds with no errors

### Task 3: Validate Against Module Contracts and Well-Architected Framework (10 minutes)

<!-- AI_COACH: This is where learners validate their work holistically. Guide them to think beyond "does it work" to "does it follow best practices". Ask them to review their customizations against security, cost optimization, operational excellence, and reliability principles. Have them consider what happens if variables change in future CAIRA updates. -->

**What You'll Do**: Validate your customizations don't break CAIRA module contracts, generate terraform plan, and review against Azure Well-Architected Framework principles.

**Steps**:

1. **Validate** module contract compliance
   - [ ] Verify `ARM_SUBSCRIPTION_ID` is set: `echo $ARM_SUBSCRIPTION_ID`
   - [ ] Run `terraform init` in `foundry_basic/`
   - [ ] Run `terraform validate` to check configuration correctness
   - [ ] Review for any warnings about variable types or unexpected values
   - [ ] **Expected result**: No errors, configuration respects module contracts

2. **Generate and review** terraform plan
   - [ ] Run `terraform plan -out=tfplan`
   - [ ] Verify all customizations appear in plan (location, tags, SKU if changed, naming pattern)
   - [ ] Check for unexpected resource changes or recreations
   - [ ] Confirm resource count matches expectations for `foundry_basic`
   - [ ] **Expected result**: Plan shows only intended customizations, no surprises

3. **Review** against Well-Architected Framework
   - [ ] Update your `caira-customization-strategy.md` with Well-Architected analysis
   - [ ] **Cost Optimization**: Document cost impact of SKU choices and resource selections
   - [ ] **Security**: Verify tags include data classification for compliance
   - [ ] **Operational Excellence**: Confirm naming patterns support resource identification and tracking
   - [ ] **Reliability**: Verify Canada Central region supports all required services (AI Foundry, Storage, Key Vault)
   - [ ] **Performance**: Justify SKU choices based on workload requirements
   - [ ] **Expected result**: Documented alignment with all 5 Well-Architected pillars

## Completion Check

**You've Succeeded When**:

- [ ] Your `caira-customization-strategy.md` documents customization decisions, limitations, and rationale
- [ ] Created `terraform.tfvars` implementing customizable requirements (location→Canada Central, tags with CC-12345, sku if needed)
- [ ] Documented that base_name is hardcoded and requires main.tf edit to customize (trade-off decision)
- [ ] `terraform validate` succeeds with no module contract violations
- [ ] `terraform plan` shows customizations correctly applied (Canada Central region, cost center tags)
- [ ] Well-Architected Framework review completed covering all 5 pillars
- [ ] Customization decisions documented with cost implications and compliance justification
- [ ] Template created that can be reused for future CAIRA deployments

**Self-Test Questions**:
1. What's the difference between customizing via terraform.tfvars vs editing main.tf directly?
2. What would happen if CAIRA adds a new required variable in a future version?
3. How does CAIRA's Azure naming module generate resource names, and why is base_name hardcoded?
4. What are the trade-offs of forking CAIRA to customize base_name vs accepting the default naming?

**Next Steps**: Proceed to **Kata 450: Securing CAIRA for Production** to add network isolation and enterprise security hardening, or proceed with deployment following your team's approval process.

---

## Reference Appendix

### Help Resources

- **CAIRA documentation**: Start at `reference_architectures/README.md` for architecture selection
- **Terraform variables**: Use `variables.tf` as the single source of truth for supported customization
- **AI assistance**: Use `@caira-assistant` for architecture choice validation and trade-off explanations

### Professional Tips

- Prefer `terraform.tfvars` (or environment-specific tfvars) over editing reference architecture code
- Keep customization minimal and intentional, then document why each override exists
- Treat `terraform plan` output as a change review, not a formality

### Troubleshooting

**Issue**: `terraform validate` fails with "unknown variable" errors

- **Solution**: You're trying to customize a variable that doesn't exist in `variables.tf`. Review available variables and remove unsupported customizations from your tfvars file.

**Issue**: Storage account name exceeds length limit

- **Solution**: Azure storage account names must be 3-24 characters, lowercase, no special characters. The Azure naming module handles this automatically.

**Issue**: Want to customize resource naming but base_name is hardcoded

- **Solution**: You have three options: (A) Accept default naming with "basic" prefix, (B) Fork CAIRA and modify locals block in main.tf, or (C) Propose adding base_name as a variable to upstream CAIRA.

**Issue**: Region not available for all required services

- **Solution**: Check [Azure Products by Region](https://azure.microsoft.com/global-infrastructure/services/) to verify service availability. AI Foundry is available in limited regions.

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->
