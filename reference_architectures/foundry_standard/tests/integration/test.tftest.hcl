# =============================================================================
# Foundry Standard Reference Architecture - Integration Tests
# =============================================================================
# These tests validate the complete foundry_standard deployment by applying the
# configuration and verifying that all Azure resources are created correctly
# with the expected properties and configurations.
#
# EFFICIENCY NOTE: This uses a single apply operation to minimize cost and time

run "testint_foundry_standard_comprehensive" {
  command = apply

  variables {
    location             = "swedencentral"
    project_name         = "integration-test-project"
    project_display_name = "Integration Test Project"
    project_description  = "Project created for integration testing validation"
    sku                  = "S0"
    tags = {
      environment  = "test"
      purpose      = "terraform-test"
      architecture = "foundry-standard"
      created_by   = "terraform-test"
      test_type    = "integration"
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
    error_message = "Resource group location should match the specified location"
  }

  # Verify naming pattern follows Azure naming conventions
  assert {
    condition     = length(regexall("^rg-standard-[a-z0-9]{5}$", azurerm_resource_group.this[0].name)) > 0
    error_message = "Resource group name should follow pattern: rg-standard-{5 random chars}"
  }

  # Verify tags are properly applied to resource group
  assert {
    condition     = azurerm_resource_group.this[0].tags.environment == "test"
    error_message = "Resource group should have the environment tag applied"
  }

  assert {
    condition     = azurerm_resource_group.this[0].tags.architecture == "foundry-standard"
    error_message = "Resource group should have the architecture tag applied"
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

  # Verify AI Foundry name follows expected pattern
  assert {
    condition     = module.ai_foundry.ai_foundry_name != null && length(module.ai_foundry.ai_foundry_name) > 0
    error_message = "AI Foundry name should not be empty"
  }

  assert {
    condition     = length(regexall("^cog-standard-[a-z0-9]{5}$", module.ai_foundry.ai_foundry_name)) > 0
    error_message = "AI Foundry name should follow expected naming pattern: cog-standard-{5 random chars}"
  }

  # ==========================================================================
  # AI FOUNDRY PROJECT VALIDATION
  # ==========================================================================

  # Verify AI Foundry project creation and properties
  assert {
    condition     = module.ai_foundry.ai_foundry_project_id != null
    error_message = "AI Foundry project ID should not be null"
  }

  # Validate project resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/.*", module.ai_foundry.ai_foundry_project_id)) > 0
    error_message = "AI Foundry project ID should be a valid Azure resource ID"
  }

  # Verify project name matches configuration
  assert {
    condition     = module.ai_foundry.ai_foundry_project_name == "integration-test-project"
    error_message = "AI Foundry project name should match the configured project_name variable"
  }

  # ==========================================================================
  # MODEL DEPLOYMENT VALIDATION
  # ==========================================================================

  # Verify model deployments are created
  assert {
    condition     = module.ai_foundry.ai_foundry_model_deployments_ids != null && length(module.ai_foundry.ai_foundry_model_deployments_ids) > 0
    error_message = "There should be at least one AI Model Deployment"
  }

  # Verify specific number of model deployments (gpt-4, o4-mini, text-embedding-3-large)
  assert {
    condition     = length(module.ai_foundry.ai_foundry_model_deployments_ids) == 3
    error_message = "Should have exactly 3 model deployments (gpt-4, o4-mini, text-embedding-3-large)"
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
    condition     = module.ai_foundry.ai_foundry_project_identity_principal_id != null
    error_message = "AI Foundry project identity principal ID should be available"
  }

  # Validate GUID format for principal ID
  assert {
    condition     = length(regexall("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", module.ai_foundry.ai_foundry_project_identity_principal_id)) > 0
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
  # CAPABILITY HOST RESOURCES VALIDATION (FOUNDRY STANDARD SPECIFIC)
  # ==========================================================================

  # Verify agent capability host connections are created
  assert {
    condition     = output.agent_capability_host_connections != null
    error_message = "Agent capability host connections should be available"
  }

  # Verify Cosmos DB connection is configured
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

  # Verify Storage Account connection is configured
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

  # Verify AI Search connection is configured
  assert {
    condition     = output.agent_capability_host_connections.ai_search != null
    error_message = "AI Search connection should be configured for capability host"
  }

  # Validate AI Search resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.Search/searchServices/.*", output.agent_capability_host_connections.ai_search.resource_id)) > 0
    error_message = "AI Search resource ID should be valid"
  }

  # Verify all capability host resources are in the same resource group
  assert {
    condition     = strcontains(output.agent_capability_host_connections.cosmos_db.resource_id, azurerm_resource_group.this[0].name)
    error_message = "Cosmos DB should be created in the same resource group"
  }

  assert {
    condition     = strcontains(output.agent_capability_host_connections.storage_account.resource_id, azurerm_resource_group.this[0].name)
    error_message = "Storage Account should be created in the same resource group"
  }

  assert {
    condition     = strcontains(output.agent_capability_host_connections.ai_search.resource_id, azurerm_resource_group.this[0].name)
    error_message = "AI Search should be created in the same resource group"
  }

  # ==========================================================================
  # PUBLIC ACCESS CONFIGURATION VALIDATION
  # ==========================================================================

  # Verify this is the foundry_standard (public access) architecture
  assert {
    condition     = length(regexall("standard", azurerm_resource_group.this[0].name)) > 0
    error_message = "Resource group name should contain 'standard' indicating this is the public access foundry_standard architecture"
  }

  # Verify AI Foundry endpoint is properly constructed for public access
  assert {
    condition     = output.ai_foundry_endpoint != null
    error_message = "AI Foundry endpoint should be available for public access"
  }

  # Validate endpoint URL format follows Azure Cognitive Services pattern
  assert {
    condition     = length(regexall("^https://.*\\.cognitiveservices\\.azure\\.com/$", output.ai_foundry_endpoint)) > 0
    error_message = "AI Foundry endpoint should follow the correct Azure Cognitive Services URL pattern"
  }

  # Verify endpoint contains the AI Foundry name as subdomain (custom domain)
  assert {
    condition     = length(regexall(output.ai_foundry_name, output.ai_foundry_endpoint)) > 0
    error_message = "AI Foundry endpoint should contain the AI Foundry name as the subdomain"
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
    condition     = output.ai_foundry_project_id == module.ai_foundry.ai_foundry_project_id
    error_message = "Output ai_foundry_project_id should match module output"
  }

  assert {
    condition     = output.ai_foundry_project_name == module.ai_foundry.ai_foundry_project_name
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
  # VARIABLE CONFIGURATION VALIDATION
  # ==========================================================================

  # Verify configured variables are properly applied
  assert {
    condition     = var.location == "swedencentral"
    error_message = "Location variable should be properly applied"
  }

  assert {
    condition     = var.project_name == "integration-test-project"
    error_message = "Project name variable should be properly applied"
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

  assert {
    condition     = strcontains(module.ai_foundry.ai_foundry_project_id, azurerm_resource_group.this[0].name)
    error_message = "AI Foundry project should be created in the same resource group"
  }

  # Verify Application Insights is in the same resource group
  assert {
    condition     = strcontains(output.application_insights_id, azurerm_resource_group.this[0].name)
    error_message = "Application Insights should be created in the same resource group"
  }
}
