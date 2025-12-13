---
# Core Metadata
title: "Kata: Troubleshooting CAIRA Deployments"
description: Diagnose and resolve common Terraform and Azure deployment failures through systematic troubleshooting methodology
author: HVE Essentials Team
ms.date: 12/05/2025
ms.topic: how-to-guide

# Kata Identity
kata_id: troubleshooting-300-troubleshooting-caira-deployments
kata_category:
  - troubleshooting
kata_difficulty: 3
estimated_time_minutes: 45
requires_dev_container: true

# Learning Content
learning_objectives:
  - Read and interpret Terraform error messages to identify root causes
  - Diagnose Azure RBAC permission and quota limit issues systematically
  - Resolve Terraform state management and locking conflicts safely
  - Use Azure Activity Log and diagnostic tools for infrastructure troubleshooting
  - Apply targeted fixes without full redeployment using Terraform workflow
  - Build reusable troubleshooting methodology and documentation practices
prerequisite_katas:
  - caira-fundamentals-200-devcontainer-foundry-basic-deployment
technologies:
  - Terraform
  - Azure CLI
  - Azure Portal
  - Azure Activity Log
  - CAIRA
  - Azure Resource Manager
success_criteria:
  - Successfully diagnosed and resolved all 6 troubleshooting scenarios
  - Can read Terraform error output and trace root causes systematically
  - Knows where to find Azure diagnostic information for deployment failures
  - Built personal troubleshooting checklist with prevention strategies
  - Documented solutions in reusable troubleshooting runbook format
  - Can explain prevention strategies for each common issue type

# AI Coaching
ai_coaching_level: adaptive
scaffolding_level: medium-heavy
hint_strategy: progressive
hint_frequency: strategic
common_pitfalls:
  - Rushing to fix errors without reading complete error messages
  - Not checking Azure Activity Logs for detailed failure information
  - Re-running terraform apply without addressing underlying root cause
  - Attempting to manually edit Terraform state files (dangerous practice)
  - Forcing state unlock without verifying process safety
  - Not documenting solutions for future reference and team knowledge
  - Using email-based identity queries for guest users (use object ID instead)

# Requirements
requires_azure_subscription: true
requires_local_environment: true
requires_github_account: false

# SEO & Discoverability
tags:
  - troubleshooting
  - caira-proficiency
search_keywords:
  - CAIRA deployment troubleshooting
  - Terraform error diagnosis
  - Azure deployment failures
  - state file locking resolution
  - permission denied RBAC debugging
  - quota exceeded troubleshooting
real_world_application: Platform engineers troubleshoot failed CAIRA deployments by systematically diagnosing Terraform errors, Azure permission issues, quota limits, and state conflicts using diagnostic tools and established troubleshooting methodology to restore deployment capability

# Optional Fields
related_katas:
  - caira-fundamentals-200-devcontainer-foundry-basic-deployment
related_labs: []
skill_assessment_id: ""
validation_commands:
  - az role assignment list --all --assignee $(az ad signed-in-user show --query id -o tsv) -o table
  - az cognitiveservices account list-skus --location eastus -o table
  - az storage account check-name --name <storage-account-name>
  - terraform version
  - ps aux | grep terraform
chatmode_references:
  - learning-kata-coach
file_references:
  - reference_architectures/foundry_basic/terraform.tf
  - reference_architectures/foundry_basic/variables.tf
  - docs/troubleshooting.md
troubleshooting_guide: "../../docs/troubleshooting.md"
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

- How to systematically diagnose and resolve common CAIRA deployment failures
- Read and interpret Terraform error messages to identify root causes
- Use Azure Activity Log and diagnostic tools for infrastructure troubleshooting
- Resolve permission errors, quota limits, naming conflicts, and state locking issues
- Build reusable troubleshooting methodology and documentation practices

### Prerequisites

- Completed [Kata 200: Devcontainer & Foundry Basic Deployment](../caira-fundamentals/200-devcontainer-foundry-basic-deployment.md)
- CAIRA repository cloned and devcontainer working
- Azure CLI authenticated with active subscription
- Basic understanding of Terraform workflow (init, plan, apply)

### Real Challenge

You're a platform engineer deploying CAIRA infrastructure for a new AI-powered fraud detection system. Your team has experienced several deployment failures this week that are blocking a critical sprint deadline - some colleagues hit permission errors when deploying AI Foundry resources, others encountered quota limits on Cognitive Services accounts in the primary region, and one deployment left the Terraform state locked after a network interruption. Leadership expects the infrastructure ready for the development team by end of week. You need to build proficiency in troubleshooting these issues quickly to unblock the team and prevent future occurrences.

**Your Task**: Work through 6 common troubleshooting scenarios using simulated errors and real diagnostic techniques. Build a personal troubleshooting runbook with documented solutions and prevention strategies that you can reference and share with your team.

## Essential Setup

**Required** (check these first):

- [ ] Completed Kata 200 (Devcontainer & Foundry Basic Deployment)
- [ ] CAIRA repository cloned and devcontainer working
- [ ] Azure CLI authenticated inside devcontainer
- [ ] Access to Azure Portal with subscription visibility
- [ ] Navigate to `reference_architectures/foundry_basic` directory

**Configure environment for Terraform**:

```bash
# Navigate to the foundry_basic directory
cd reference_architectures/foundry_basic

# Set ARM_SUBSCRIPTION_ID environment variable (REQUIRED for Terraform)
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Verify it's set correctly
echo $ARM_SUBSCRIPTION_ID

# Create terraform.tfvars to override default location (swedencentral → eastus)
cat > terraform.tfvars << EOF
location = "eastus"
EOF

# Verify Azure CLI authentication
az account show
```

**Quick Validation**: Run `terraform version && echo $ARM_SUBSCRIPTION_ID && cat terraform.tfvars` - all should succeed and show eastus location.

> **🤖 Want Interactive AI Coaching?**
>
> Load the **Learning Kata Coach** chat mode for task check-offs, progress tracking, progressive hints, and personalized guidance.
>
> In GitHub Copilot Chat, select **Learning Kata Coach** mode and say:
>
> ```text
> I'm working on Troubleshooting CAIRA Deployments kata and want interactive coaching with progress tracking.
> ```

## Practice Tasks

<!-- AI_COACH: This kata teaches systematic troubleshooting methodology. If learners struggle with error diagnosis, guide them to read complete error messages carefully - the key information is often at the end. Encourage them to document solutions as they work through each scenario for future reference. -->

### Task 1: Diagnose Permission and RBAC Errors (12 minutes)

<!-- AI_COACH: Permission errors are common in enterprise Azure environments. If learners struggle with understanding RBAC roles, consider asking "What do you think the difference is between Contributor and User Access Administrator roles?" Guide them to explore role scope by asking "How might subscription-level vs resource group-level permissions affect creating new resource groups?" Help them discover the answer through their own investigation. -->

**What You'll Do**: Learn to identify and resolve Azure RBAC permission errors by analyzing Terraform output, checking role assignments, and understanding required permissions for CAIRA deployments.

**Steps**:

1. **Understand** the error pattern for permission failures
   - [ ] Review this simulated Terraform error message pattern (common in CAIRA deployments)
   - **Example Error**: `Error: authorization failed: The client 'user@example.com' with object id 'xxx' does not have authorization to perform action 'Microsoft.Resources/subscriptions/resourceGroups/write'`
   - [ ] Identify key information: action being attempted, resource type, missing permission
   - **Pro tip**: Terraform errors include the exact Azure RBAC action that failed - this tells you what permission is missing

2. **Check** current role assignments
   - [ ] Run: `az role assignment list --all --assignee $(az ad signed-in-user show --query id -o tsv) -o table`
   - [ ] Look for your current roles on the subscription
   - [ ] Verify you have BOTH: `Contributor` AND `User Access Administrator` (CAIRA requires both), OR the `Owner` role (which includes both)
   - **Pro tip**: Using object ID instead of email works reliably for all user types (including guest users)
   - **Validation checkpoint**: Do you see the required roles in the output?
   - [ ] **Expected result**: Table showing role assignments including Owner OR (Contributor + User Access Administrator)

3. **Diagnose** permission scope issues
   - [ ] Review the Scope column in your role assignments - look for `/subscriptions/...` (subscription-level) vs longer paths (resource group or resource level)
   - [ ] Identify if your roles are scoped at subscription level or only at resource group level
   - **Pro tip**: CAIRA deployments creating new resource groups require subscription-level permissions (Owner or Contributor role)
   - [ ] **Expected result**: Understanding of where your permissions are scoped and whether they're sufficient for CAIRA deployment

4. **Resolve** permission issues
   - [ ] Document the missing role and scope needed
   - [ ] Contact your Azure subscription administrator with specific request: "Please assign [Role Name] at [Subscription/RG] scope"
   - [ ] Include the error message and action that failed in your request
   - **Success check**: Clear documentation of permission issue and resolution path

### Task 2: Resolve Quota and Capacity Errors (10 minutes)

<!-- AI_COACH: Quota limits protect Azure subscriptions from runaway costs but can block legitimate deployments. If learners encounter quota issues, ask "What do you think the difference is between per-region and per-subscription limits?" Encourage them to explore: "What alternatives might you consider before requesting a quota increase?" Guide discovery of workarounds like deploying to different regions or cleaning up unused resources. -->

**What You'll Do**: Diagnose Azure subscription quota limits and capacity constraints that block resource deployment, then learn how to check quotas and request increases.

**Steps**:

1. **Recognize** quota exceeded error patterns
   - [ ] Review this simulated error pattern
   - **Example Error**: `Error: creating AI Services Account: resources.AccountsClient#Create: Failure responding to request: StatusCode=409 -- Original Error: Code="QuotaExceeded" Message="The subscription has reached its quota of X Cognitive Services accounts"`
   - [ ] Identify: resource type, current quota limit, region
   - **Validation checkpoint**: Can you identify which resource hit the quota limit?

2. **Check** current quota usage
   - [ ] Run: `az cognitiveservices account list-skus --location eastus -o table` (check AI Services availability)
   - [ ] Run: `az cognitiveservices account list -o table` (list existing AI Services accounts)
   - [ ] Run: `az resource list --resource-type Microsoft.Search/searchServices -o table` (check AI Search services across subscription)
   - [ ] Count existing CAIRA resources in your subscription
   - **Pro tip**: Some quota limits are per-region, some are per-subscription - error message specifies which
   - [ ] **Expected result**: List of existing resources counting toward quota

3. **Understand** quota types and where to check them
   - [ ] Recognize two types of quotas: **Account-level** (number of AI Services accounts, checked via CLI) and **Model-level** (tokens per minute for deployments, checked in AI Foundry portal)
   - [ ] Note: The CLI commands in Step 2 checked account-level quotas - you've already completed the essential quota diagnostics
   - [ ] **Optional exploration**: Navigate to Azure AI Foundry portal (https://ai.azure.com) → Management center → Quota to see model deployment quotas (TPM - Tokens Per Minute)
   - [ ] **Optional**: Review quota hierarchy in portal: Quota types (GlobalStandard, Standard) → Model types (gpt-4o-mini, text-embedding-3-large) → Regions → Quota values
   - [ ] **Optional**: Explore "Request quota" functionality for model-level quota increases
   - **Pro tip**: For production endpoints, request dedicated model quota; shared quota pool is for temporary testing only
   - **Reference**: [AI Foundry quota documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/quota)
   - **Success check**: You understand the difference between account-level and model-level quotas, and know where to check each

4. **Implement** workaround strategies
   - [ ] Document alternative approaches when hitting quota limits
   - [ ] Option 1: Deploy to different region with available quota (update terraform.tfvars location)
   - [ ] Option 2: Delete unused CAIRA deployments to free quota in desired region
   - [ ] Option 3: Request quota increase from Azure support (can take 1-3 business days)
   - [ ] For this kata: With 3 accounts deployed, you likely have room for more in a standard subscription
   - **Expected result**: Clear strategy for handling quota constraints in production scenarios

### Task 3: Fix Naming Conflicts and Uniqueness Errors (8 minutes)

<!-- AI_COACH: Naming conflicts occur because some Azure resources require globally unique names across all customers. If learners seem confused about naming conflicts, consider asking "Why do you think some Azure resources require globally unique names?" and "What happens when millions of customers are creating storage accounts?" Encourage exploration of consistent naming strategies by asking "What pattern could you use to ensure uniqueness without random suffixes?" -->

**What You'll Do**: Resolve globally unique resource naming conflicts (storage accounts, AI Search) by understanding Azure naming requirements and implementing unique naming strategies.

**Steps**:

1. **Identify** naming conflict errors
   - [ ] Review simulated naming error pattern
   - **Example Error**: `Error: creating Storage Account "cairabasicstorage": storage.AccountsClient#Create: Failure responding to request: StatusCode=409 -- Original Error: Code="StorageAccountAlreadyTaken" Message="The storage account named cairabasicstorage is already taken"`
   - [ ] Note which resource types require globally unique names: Storage Accounts, AI Search services, some Azure App Services
   - **Validation checkpoint**: Do you understand why the name must be globally unique?

2. **Check** name availability before deployment
   - [ ] Run: `az storage account check-name --name myaccount`
   - [ ] Observe the JSON output with `"nameAvailable": false` and reason message explaining the name is taken
   - [ ] Try with a more unique name (e.g., your initials + numbers) to see the difference
   - **Pro tip**: Always check name availability for globally unique resources before deploying
   - [ ] **Expected result**: Understanding of how to verify name availability and interpret unavailable vs available responses

3. **Implement** unique naming strategy
   - [ ] Add random suffix to resource names in terraform.tfvars (e.g., append your initials + random numbers)
   - [ ] Example: `storage_account_name = "cairabasic${random_string}"` pattern
   - [ ] Verify new name meets Azure requirements: lowercase, alphanumeric, 3-24 characters for storage
   - **Success check**: Generated unique name that passes availability check

4. **Prevent** future naming conflicts
   - [ ] Document naming convention in troubleshooting runbook
   - [ ] Note: CAIRA modules auto-generate unique names by default - only override when necessary
   - [ ] Consider using `random_id` Terraform resource for guaranteed uniqueness
   - **Expected result**: Documented naming strategy for team consistency

### Task 4: Debug State File Locking Issues (8 minutes)

<!-- AI_COACH: State locking prevents concurrent modifications that could corrupt Terraform state. If learners want to force unlock immediately, ask "What might happen if you force unlock while another operation is still running?" and "How could you verify no other process is actually using the lock?" Guide them to think about prevention by asking "What team practices could help avoid lock conflicts in the first place?" Focus on discovery rather than prescribing solutions. -->

**What You'll Do**: Diagnose and safely resolve Terraform state locking conflicts that occur when multiple operations attempt to modify state simultaneously.

**Steps**:

1. **Understand** state locking error patterns
   - [ ] Review simulated state lock error
   - **Example Error**: `Error: Error acquiring the state lock. Lock Info: ID: xxx-xxx-xxx, Path: terraform.tfstate, Operation: OperationTypeApply, Who: user@hostname, Created: 2025-12-05 10:30:00`
   - [ ] Identify: Lock ID, who holds the lock, when it was created, what operation
   - **Validation checkpoint**: Can you determine who locked the state and when?

2. **Investigate** if lock is legitimate
   - [ ] Check if another Terraform process is actually running: `ps aux | grep terraform`
   - [ ] If working in a team, ask teammates if they're running Terraform operations
   - [ ] Check lock timestamp - if recent (< 30 minutes), likely legitimate operation in progress
   - **Pro tip**: NEVER force unlock while another operation is running - causes state corruption
   - [ ] **Expected result**: Determination of whether lock is legitimate or stale

3. **Safely** resolve stale locks
   - [ ] If lock is stale (operation crashed, process killed), note the Lock ID from error
   - [ ] Run: `terraform force-unlock <LOCK_ID>` (only if certain no operation is running)
   - [ ] Confirm the unlock operation when prompted
   - **Success check**: State unlocked and subsequent Terraform commands succeed

4. **Prevent** state locking conflicts
   - [ ] Document team coordination strategy: communicate before running apply operations
   - [ ] Consider using remote state with automatic locking (Azure Storage backend)
   - [ ] Note in runbook: Always let Terraform operations complete, don't force-quit
   - **Expected result**: Documented prevention strategies for state lock conflicts

### Task 5: Resolve Provider Version Compatibility (7 minutes)

<!-- AI_COACH: Provider version constraints ensure compatibility between Terraform and cloud providers. If learners struggle with version syntax, ask "What do you think the ~> symbol means in version constraints?" and "How might major vs minor version updates differ in their impact?" When upgrading providers, prompt them to consider "What information should you check before upgrading a provider version?" Guide them toward discovering the importance of changelogs. -->

**What You'll Do**: Diagnose and fix Terraform provider version conflicts by understanding version constraints, updating provider configurations, and re-initializing Terraform.

**Steps**:

1. **Recognize** provider version errors
   - [ ] Review simulated provider version error pattern
   - **Example Error**: `Error: Incompatible provider version. Provider registry.terraform.io/hashicorp/azurerm v3.50.0 does not satisfy the configured version constraint ~> 4.0`
   - [ ] Identify: provider name, current version, required constraint
   - **Validation checkpoint**: Can you identify which provider has the version mismatch?

2. **Check** current provider versions
   - [ ] Navigate to `reference_architectures/foundry_basic` directory
   - [ ] Open `terraform.tf` file
   - [ ] Review the `required_providers` block and version constraints
   - [ ] Run: `terraform version` to see currently initialized provider versions
   - **Expected result**: Understanding of configured vs installed provider versions

3. **Update** provider configuration
   - [ ] If provider version is too old, update version constraint in `terraform.tf`
   - [ ] Example: Change `version = "~> 3.0"` to `version = "~> 4.0"`
   - [ ] Run: `terraform init -upgrade` to download updated providers
   - [ ] Verify: `terraform version` shows updated provider versions
   - **Pro tip**: `-upgrade` flag tells Terraform to check for newer provider versions
   - [ ] **Expected result**: Providers updated to compatible versions

4. **Document** provider version management
   - [ ] Note in runbook: Provider updates can include breaking changes - review changelogs
   - [ ] Document current working provider versions for CAIRA deployments
   - [ ] Add to checklist: Run `terraform init -upgrade` periodically to stay current
   - **Success check**: Documented provider version management strategy

### Task 6: Use Azure Activity Log for Root Cause Analysis (10 minutes)

<!-- AI_COACH: Azure Activity Log provides detailed Azure Resource Manager-level information that Terraform may truncate or summarize. If learners can't locate relevant errors, ask "When searching for a specific failure, would you start with narrow or broad filters?" and "How might you progressively narrow down results?" Help them discover the value of correlation IDs by asking "How could you connect related operations in a complex deployment timeline?" -->

**What You'll Do**: Learn to use Azure Activity Log to investigate deployment failures, trace resource creation attempts, and identify root causes that aren't always clear in Terraform output.

**Steps**:

1. **Access** Azure Activity Log
   - [ ] Navigate to Azure Portal → Monitor → Activity Log
   - [ ] Set time range to cover your recent deployment attempt
   - [ ] Filter by subscription where CAIRA deployment occurred
   - [ ] Click "Add filter" → Timespan: Last 4 hours
   - **Expected result**: Activity Log showing recent Azure operations

2. **Filter** for deployment failures
   - [ ] Add filter: Event severity = Error
   - [ ] Add filter: Resource type = All (or specific type like "Storage Account")
   - [ ] Review failed operations in the list
   - [ ] Click on a failed operation to see detailed error message
   - **Pro tip**: Activity Log shows Azure ARM-level errors that Terraform may summarize
   - [ ] **Expected result**: Detailed Azure error messages for failed operations

3. **Trace** resource creation timeline
   - [ ] Remove severity filter to see all operations (successful and failed)
   - [ ] Find the sequence of resource creation attempts
   - [ ] Identify which resources succeeded before failure occurred
   - [ ] Note the caller (your user identity) and correlation ID for tracking related operations
   - **Validation checkpoint**: Can you identify the sequence of events leading to failure?
   - [ ] **Expected result**: Complete timeline of deployment operations

4. **Extract** actionable diagnostic information
   - [ ] Click on failed operation → JSON tab to see complete error details
   - [ ] Note: Status code, error code, error message, and properties
   - [ ] Copy correlation ID for support tickets if needed
   - [ ] Document the root cause in your troubleshooting runbook
   - **Success check**: Complete diagnostic information documented for troubleshooting runbook

## Completion Check

**You've Succeeded When**:

- [ ] Successfully diagnosed all 6 troubleshooting scenarios with root cause identified
- [ ] Can read Terraform error messages and extract key diagnostic information
- [ ] Know how to check Azure RBAC roles, quotas, and naming availability
- [ ] Understand when it's safe to force-unlock Terraform state
- [ ] Can use Azure Activity Log to trace deployment failures
- [ ] Built personal troubleshooting runbook with solutions and prevention strategies
- [ ] Documented at least 6 common issues with resolution steps

**Next Steps**: Build on your troubleshooting skills with **Kata 350: Validating CAIRA with Sample AI Application** to learn end-to-end validation techniques, or continue to **Kata 400: Customizing CAIRA for Your Requirements** for advanced configuration.

---

## Reference Appendix

### Help Resources

- **Azure Activity Log**: Portal → Monitor → Activity Log for detailed deployment failure information
- **CAIRA Troubleshooting Guide**: `docs/troubleshooting.md` in CAIRA repository
- **Terraform Debugging**: Set `TF_LOG=DEBUG` environment variable for verbose output
- **Azure CLI Help**: Run `az [command] --help` for detailed command documentation

### Professional Tips

- Always read the complete error message - key diagnostic information is often at the end
- Check Azure Activity Log for detailed errors that Terraform may truncate or summarize
- Document solutions in a searchable runbook - you'll encounter similar issues again
- Prevention is better than troubleshooting - implement guardrails and validation checks

### Troubleshooting

**Issue**: Error messages are truncated or unclear

- **Quick Fix**: Set `TF_LOG=DEBUG` before running Terraform commands for verbose output
- **Alternative**: Check Azure Activity Log in Portal for complete ARM error messages

**Issue**: Can't find the failed operation in Activity Log

- **Quick Fix**: Expand time range to Last 24 hours and remove all filters
- **Check**: Verify you're viewing the correct subscription in the filter

**Issue**: Force unlock doesn't work

- **Quick Fix**: Ensure you're using the exact Lock ID from the error message (copy-paste)
- **Verify**: No Terraform process is actually running (`ps aux | grep terraform`)

**Issue**: Provider version conflict persists after update

- **Quick Fix**: Delete `.terraform` directory and `.terraform.lock.hcl`, then run `terraform init`
- **Verify**: Check `terraform.tf` has correct version constraints

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->

<!-- Reference Links -->
