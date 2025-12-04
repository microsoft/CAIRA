# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# =============================================================================
# Foundry Standard Private Reference Architecture - Integration Tests
# =============================================================================
# These tests validate the complete foundry_standard_private deployment by applying the
# configuration and verifying that all Azure resources are created correctly
# with the expected properties, private networking configurations, and existing
# capability host resource integrations.
#
# APPROACH: Uses data sources to lookup durable infrastructure pool and sets up ephemeral
# agent subnet for isolated test runs.
#
# ENVIRONMENT VARIABLES REQUIRED (set via TF_VAR_ prefix):
# - TF_VAR_fsp_cosmosdb_account_name: Cosmos DB account name (e.g., cosmos-fstdprv-durable)
# - TF_VAR_fsp_storage_account_name : Storage account name (e.g., stfstdprvdurable)
# - TF_VAR_fsp_search_service_name  : AI Search service name (e.g., srch-fstdprv-durable)
# =============================================================================

provider "azurerm" {
  storage_use_azuread = true
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Lookup the durable infrastructure pool (plan-only, fast lookup)
run "setup_data" {
  command = plan

  module {
    source = "./tests/integration/data"
  }
}

# Create ephemeral agent subnet for this test run
run "setup_agent" {
  command = apply

  module {
    source = "./tests/integration/setup_ephemeral"
  }

  variables {
    test_run_id         = formatdate("YYYYMMDDHHmmss", timestamp())
    vnet_name           = run.setup_data.virtual_network_id != null ? split("/", run.setup_data.virtual_network_id)[8] : ""
    vnet_resource_group = run.setup_data.resource_group_name
  }
}

run "testint_foundry_standard_private_comprehensive" {
  command = apply

  variables {
    foundry_subnet_id                          = run.setup_data.connection.id
    agents_subnet_id                           = run.setup_agent.agent_subnet_id
    existing_capability_host_resource_group_id = run.setup_data.resource_group_id
    existing_cosmosdb_account_name             = run.setup_data.cosmosdb_account_name
    existing_storage_account_name              = run.setup_data.storage_account_name
    existing_search_service_name               = run.setup_data.search_service_name
    tags = {
      environment      = "test"
      purpose          = "terraform-test"
      architecture     = "foundry-standard-private"
      created_by       = "terraform-test"
      test_type        = "integration"
      networking_type  = "private"
      capability_hosts = "existing"
    }
  }

  # ==========================================================================
  # RESOURCE GROUP VALIDATION
  # ==========================================================================

  assert {
    condition     = azurerm_resource_group.this[0].location == "swedencentral"
    error_message = "Resource group location should match the specified location"
  }

  # Verify naming pattern follows Azure naming conventions for standard private architecture
  assert {
    condition     = length(regexall("^rg-standard-private-[a-z0-9]{5}$", azurerm_resource_group.this[0].name)) > 0
    error_message = "Resource group name should follow pattern: rg-standard-private-{5 random chars}"
  }

  # Verify tags are properly applied to resource group
  assert {
    condition     = azurerm_resource_group.this[0].tags.environment == "test"
    error_message = "Resource group should have the environment tag applied"
  }

  assert {
    condition     = azurerm_resource_group.this[0].tags.architecture == "foundry-standard-private"
    error_message = "Resource group should have the architecture tag applied"
  }

  assert {
    condition     = azurerm_resource_group.this[0].tags.networking_type == "private"
    error_message = "Resource group should have the networking_type tag indicating private networking"
  }

  assert {
    condition     = azurerm_resource_group.this[0].tags.capability_hosts == "existing"
    error_message = "Resource group should have the capability_hosts tag indicating existing resources"
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

  # Verify AI Foundry name follows expected pattern for standard private architecture
  assert {
    condition     = module.ai_foundry.ai_foundry_name != null && length(module.ai_foundry.ai_foundry_name) > 0
    error_message = "AI Foundry name should not be empty"
  }

  assert {
    condition     = length(regexall("^cog-standard-private-[a-z0-9]{5}$", module.ai_foundry.ai_foundry_name)) > 0
    error_message = "AI Foundry name should follow expected naming pattern: cog-standard-private-{5 random chars}"
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
  # CAPABILITY HOST RESOURCES VALIDATION (EXISTING RESOURCES)
  # ==========================================================================

  # Verify agent capability host connections are configured
  assert {
    condition     = output.agent_capability_host_connections != null
    error_message = "Agent capability host connections should be available"
  }

  # Verify Cosmos DB connection is configured (referencing existing resource)
  assert {
    condition     = output.agent_capability_host_connections.cosmos_db != null
    error_message = "Cosmos DB connection should be configured for capability host"
  }

  # Validate Cosmos DB resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.DocumentDB/databaseAccounts/.*", output.agent_capability_host_connections.cosmos_db.resource_id)) > 0
    error_message = "Cosmos DB resource ID should be valid"
  }

  # Verify Cosmos DB endpoint is available
  assert {
    condition     = output.agent_capability_host_connections.cosmos_db.endpoint != null && length(output.agent_capability_host_connections.cosmos_db.endpoint) > 0
    error_message = "Cosmos DB endpoint should be available"
  }

  # Validate Cosmos DB endpoint URL format
  assert {
    condition     = length(regexall("^https://.*\\.documents\\.azure\\.com:443/$", output.agent_capability_host_connections.cosmos_db.endpoint)) > 0
    error_message = "Cosmos DB endpoint should follow correct Azure Cosmos DB URL pattern"
  }

  # Verify Cosmos DB is in the setup resource group (existing resource)
  assert {
    condition     = strcontains(output.agent_capability_host_connections.cosmos_db.resource_id, run.setup_data.resource_group_name)
    error_message = "Cosmos DB should be in the setup resource group (existing resource)"
  }

  # Verify Storage Account connection is configured (referencing existing resource)
  assert {
    condition     = output.agent_capability_host_connections.storage_account != null
    error_message = "Storage Account connection should be configured for capability host"
  }

  # Validate Storage Account resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.Storage/storageAccounts/.*", output.agent_capability_host_connections.storage_account.resource_id)) > 0
    error_message = "Storage Account resource ID should be valid"
  }

  # Verify Storage Account blob endpoint is available
  assert {
    condition     = output.agent_capability_host_connections.storage_account.primary_blob_endpoint != null && length(output.agent_capability_host_connections.storage_account.primary_blob_endpoint) > 0
    error_message = "Storage Account primary blob endpoint should be available"
  }

  # Validate Storage Account blob endpoint URL format
  assert {
    condition     = length(regexall("^https://.*\\.blob\\.core\\.windows\\.net/$", output.agent_capability_host_connections.storage_account.primary_blob_endpoint)) > 0
    error_message = "Storage Account blob endpoint should follow correct Azure Blob Storage URL pattern"
  }

  # Verify Storage Account is in the setup resource group (existing resource)
  assert {
    condition     = strcontains(output.agent_capability_host_connections.storage_account.resource_id, run.setup_data.resource_group_name)
    error_message = "Storage Account should be in the setup resource group (existing resource)"
  }

  # Verify AI Search connection is configured (referencing existing resource)
  assert {
    condition     = output.agent_capability_host_connections.ai_search != null
    error_message = "AI Search connection should be configured for capability host"
  }

  # Validate AI Search resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.Search/searchServices/.*", output.agent_capability_host_connections.ai_search.resource_id)) > 0
    error_message = "AI Search resource ID should be valid"
  }

  # Verify AI Search is in the setup resource group (existing resource)
  assert {
    condition     = strcontains(output.agent_capability_host_connections.ai_search.resource_id, run.setup_data.resource_group_name)
    error_message = "AI Search should be in the setup resource group (existing resource)"
  }

  # Verify capability host resource names match the setup outputs
  assert {
    condition     = strcontains(output.agent_capability_host_connections.cosmos_db.resource_id, run.setup_data.cosmosdb_account_name)
    error_message = "Cosmos DB resource ID should contain the setup Cosmos DB account name"
  }

  assert {
    condition     = strcontains(output.agent_capability_host_connections.storage_account.resource_id, run.setup_data.storage_account_name)
    error_message = "Storage Account resource ID should contain the setup Storage Account name"
  }

  assert {
    condition     = strcontains(output.agent_capability_host_connections.ai_search.resource_id, run.setup_data.search_service_name)
    error_message = "AI Search resource ID should contain the setup AI Search service name"
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
    condition     = output.ai_foundry_project_id == module.default_project.ai_foundry_project_id
    error_message = "Output ai_foundry_project_id should match module output"
  }

  assert {
    condition     = output.ai_foundry_project_name == module.default_project.ai_foundry_project_name
    error_message = "Output ai_foundry_project_name should match module output"
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

  # Verify this is the foundry_standard_private architecture
  assert {
    condition     = length(regexall("standard-private", azurerm_resource_group.this[0].name)) > 0
    error_message = "Resource group name should contain 'standard-private' indicating this is the private access architecture with capability host"
  }

  # Note: AI Foundry endpoint is handled through private endpoints in this architecture
  # Private access is validated through the private endpoint resource existence

  # ==========================================================================
  # VARIABLE CONFIGURATION VALIDATION
  # ==========================================================================

  # Verify configured variables are properly applied
  assert {
    condition     = var.location == "swedencentral"
    error_message = "Location variable should be properly applied"
  }

  assert {
    condition     = var.sku == "S0"
    error_message = "SKU variable should be properly applied"
  }

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
    condition     = run.setup_data.resource_group_name != azurerm_resource_group.this[0].name
    error_message = "Setup resources should be in a separate resource group from the main deployment"
  }

  # Verify setup virtual network is properly referenced in subnet IDs
  assert {
    condition     = length(regexall(run.setup_data.resource_group_name, var.foundry_subnet_id)) > 0
    error_message = "Foundry subnet ID should reference the setup resource group"
  }

  assert {
    condition     = length(regexall(run.setup_data.resource_group_name, var.agents_subnet_id)) > 0
    error_message = "Agents subnet ID should reference the setup resource group"
  }

  # Verify capability host resources are in setup resource group
  assert {
    condition     = strcontains(var.existing_capability_host_resource_group_id, run.setup_data.resource_group_name)
    error_message = "Existing capability host resource group ID should reference the setup resource group"
  }
}
