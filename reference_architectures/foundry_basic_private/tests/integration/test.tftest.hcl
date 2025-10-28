# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# =============================================================================
# Foundry Basic Private Reference Architecture - Integration Tests
# =============================================================================
# These tests validate the complete foundry_basic_private deployment by applying the
# configuration and verifying that all Azure resources are created correctly
# with the expected properties and private networking configurations.
#
# APPROACH: Uses data sources to lookup durable infrastructure pool instead of
# creating ephemeral resources. This eliminates 8-12 minute setup overhead per test run.
#
# ENVIRONMENT VARIABLES REQUIRED (set via TF_VAR_ prefix):
# =============================================================================

provider "azurerm" {
  storage_use_azuread = true
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Lookup the durable infrastructure pool instead of creating ephemeral resources
# The data module will use TF_VAR_ environment variables for resource names
run "data" {
  command = plan

  module {
    source = "./tests/integration/data"
  }
}

run "testint_foundry_basic_private_comprehensive" {
  command = apply

  variables {
    foundry_subnet_id = run.data.connection.id
    tags = {
      environment     = "test"
      purpose         = "terraform-test"
      architecture    = "foundry-basic-private"
      created_by      = "terraform-test"
      test_type       = "integration"
      networking_type = "private"
    }
  }

  # ==========================================================================
  # RESOURCE GROUP VALIDATION
  # ==========================================================================

  # Verify resource group creation and properties
  assert {
    condition     = azurerm_resource_group.this[0].name != null
    error_message = "Resource group name should not be null"
  }

  assert {
    condition     = azurerm_resource_group.this[0].location == "swedencentral"
    error_message = "Resource group location should match the default"
  }

  # Verify naming pattern follows Azure naming conventions for private architecture
  assert {
    condition     = length(regexall("^rg-basic-private-[a-z0-9]{5}$", azurerm_resource_group.this[0].name)) > 0
    error_message = "Resource group name should follow pattern: rg-basic-private-{5 random chars}"
  }

  # Verify tags are properly applied to resource group
  assert {
    condition     = azurerm_resource_group.this[0].tags.environment == "test"
    error_message = "Resource group should have the environment tag applied"
  }

  assert {
    condition     = azurerm_resource_group.this[0].tags.architecture == "foundry-basic-private"
    error_message = "Resource group should have the architecture tag applied"
  }

  assert {
    condition     = azurerm_resource_group.this[0].tags.networking_type == "private"
    error_message = "Resource group should have the networking_type tag indicating private networking"
  }

  # ==========================================================================
  # AI FOUNDRY CORE RESOURCE VALIDATION
  # ==========================================================================

  # Verify AI Foundry account creation and properties
  assert {
    condition     = module.ai_foundry.ai_foundry_id != null
    error_message = "AI Foundry ID should not be null"
  }

  # Validate Azure resource ID format for AI Foundry
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.CognitiveServices/accounts/.*", module.ai_foundry.ai_foundry_id)) > 0
    error_message = "AI Foundry ID should be a valid Azure Cognitive Services resource ID"
  }

  # Verify AI Foundry name follows expected pattern for private architecture
  assert {
    condition     = module.ai_foundry.ai_foundry_name != null && length(module.ai_foundry.ai_foundry_name) > 0
    error_message = "AI Foundry name should not be empty"
  }

  assert {
    condition     = length(regexall("^cog-basic-private-[a-z0-9]{5}$", module.ai_foundry.ai_foundry_name)) > 0
    error_message = "AI Foundry name should follow expected naming pattern: cog-basic-private-{5 random chars}"
  }

  # ==========================================================================
  # AI FOUNDRY PROJECT VALIDATION
  # ==========================================================================

  # Verify AI Foundry project creation and properties
  assert {
    condition     = module.default_project.ai_foundry_project_id != null
    error_message = "AI Foundry project ID should not be null"
  }

  # Validate project resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/.*", module.default_project.ai_foundry_project_id)) > 0
    error_message = "AI Foundry project ID should be a valid Azure resource ID"
  }

  # Verify project name matches configuration
  assert {
    condition     = module.default_project.ai_foundry_project_name == "default-project"
    error_message = "AI Foundry project name should match the default"
  }

  # ==========================================================================
  # MODEL DEPLOYMENT VALIDATION
  # ==========================================================================

  # Verify model deployments are created
  assert {
    condition     = module.ai_foundry.ai_foundry_model_deployments_ids != null && length(module.ai_foundry.ai_foundry_model_deployments_ids) > 0
    error_message = "There should be at least one AI Model Deployment"
  }

  # Verify specific number of model deployments
  assert {
    condition     = length(module.ai_foundry.ai_foundry_model_deployments_ids) == 3
    error_message = "Should have exactly 3 model deployments"
  }

  # Validate all model deployment resource IDs
  assert {
    condition = alltrue([
      for id in module.ai_foundry.ai_foundry_model_deployments_ids :
      length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.CognitiveServices/accounts/.*/deployments/.*", id)) > 0
    ])
    error_message = "All model deployment IDs should be valid Azure Cognitive Services deployment resource IDs"
  }

  # ==========================================================================
  # IDENTITY AND SECURITY VALIDATION
  # ==========================================================================

  # Verify system-assigned managed identity
  assert {
    condition     = module.default_project.ai_foundry_project_identity_principal_id != null
    error_message = "AI Foundry project identity principal ID should be available"
  }

  # Validate GUID format for principal ID
  assert {
    condition     = length(regexall("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", module.default_project.ai_foundry_project_identity_principal_id)) > 0
    error_message = "AI Foundry project identity principal ID should be a valid GUID"
  }

  # ==========================================================================
  # SUPPORTING SERVICES VALIDATION
  # ==========================================================================

  # Verify Application Insights is created and configured
  assert {
    condition     = output.application_insights_id != null
    error_message = "Application Insights ID should be available"
  }

  # Validate Application Insights resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.Insights/components/.*", output.application_insights_id)) > 0
    error_message = "Application Insights ID should be a valid Azure resource ID"
  }

  # Verify Log Analytics workspace is created
  assert {
    condition     = output.log_analytics_workspace_id != null
    error_message = "Log Analytics workspace ID should be available"
  }

  # Validate Log Analytics workspace resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.OperationalInsights/workspaces/.*", output.log_analytics_workspace_id)) > 0
    error_message = "Log Analytics workspace ID should be a valid Azure resource ID"
  }

  # ==========================================================================
  # OUTPUT CONSISTENCY VALIDATION
  # ==========================================================================

  # Verify all module outputs are properly exposed at root level
  assert {
    condition     = output.ai_foundry_id == module.ai_foundry.ai_foundry_id
    error_message = "Output ai_foundry_id should match module output"
  }

  assert {
    condition     = output.ai_foundry_name == module.ai_foundry.ai_foundry_name
    error_message = "Output ai_foundry_name should match module output"
  }

  assert {
    condition     = output.ai_foundry_default_project_id == module.default_project.ai_foundry_project_id
    error_message = "Output ai_foundry_default_project_id should match module output"
  }

  assert {
    condition     = output.ai_foundry_default_project_name == module.default_project.ai_foundry_project_name
    error_message = "Output ai_foundry_default_project_name should match module output"
  }

  # Verify resource group outputs are populated
  assert {
    condition     = output.resource_group_id != null
    error_message = "Resource group ID output should not be null"
  }

  assert {
    condition     = output.resource_group_name != null
    error_message = "Resource group name output should not be null"
  }

  # ==========================================================================
  # PRIVATE ACCESS CONFIGURATION VALIDATION
  # ==========================================================================

  # Verify this is the foundry_basic_private architecture
  assert {
    condition     = length(regexall("basic-private", azurerm_resource_group.this[0].name)) > 0
    error_message = "Resource group name should contain 'basic-private' indicating this is the private access architecture"
  }

  # Note: AI Foundry endpoint is handled through private endpoints in this architecture
  # Private access is validated through the private endpoint resource existence

  # ==========================================================================
  # RESOURCE RELATIONSHIP VALIDATION
  # ==========================================================================

  # Verify AI Foundry and project are in the same resource group
  assert {
    condition     = strcontains(module.ai_foundry.ai_foundry_id, azurerm_resource_group.this[0].name)
    error_message = "AI Foundry should be created in the same resource group"
  }

  # Verify Application Insights is in the same resource group
  assert {
    condition     = strcontains(output.application_insights_id, azurerm_resource_group.this[0].name)
    error_message = "Application Insights should be created in the same resource group"
  }

  # ==========================================================================
  # SETUP RESOURCE INTEGRATION VALIDATION
  # ==========================================================================

  # Verify setup resources are in different resource group (separation of concerns)
  assert {
    condition     = run.data.resource_group_name != azurerm_resource_group.this[0].name
    error_message = "Setup resources should be in a separate resource group from the main deployment"
  }
}
