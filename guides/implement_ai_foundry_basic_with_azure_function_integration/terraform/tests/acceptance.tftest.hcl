# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# Acceptance tests for Azure Functions Integration Layer

# Mock provider configuration for testing
mock_provider "azurerm" {
  mock_data "azurerm_resource_group" {
    defaults = {
      id       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123"
      name     = "rg-basic-test123"
      location = "swedencentral"
    }
  }

  mock_data "azurerm_cognitive_account" {
    defaults = {
      id                 = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
      name               = "cog-basic-test123"
      endpoint           = "https://cog-basic-test123.cognitiveservices.azure.com/"
      primary_access_key = "mock-key-123"
    }
  }

  mock_data "azurerm_application_insights" {
    defaults = {
      id                  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/microsoft.insights/components/appi-basic-test123"
      name                = "appi-basic-test123"
      connection_string   = "InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://swedencentral-1.in.applicationinsights.azure.com/"
      instrumentation_key = "00000000-0000-0000-0000-000000000000"
    }
  }
}

run "testacc_prerequisites" {
  command = plan

  variables {
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123/projects/default-project"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.Insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name      = "test-ai-func"
    function_sku_size = "B1"
    tags = {
      Environment = "test"
      Purpose     = "acceptance"
    }
  }

  # Validate ID parsing logic
  assert {
    condition     = local.foundry_resource_group_name == "rg-basic-test123"
    error_message = "Should correctly parse resource group name from AI Foundry ID"
  }

  assert {
    condition     = local.ai_foundry_name == "cog-basic-test123"
    error_message = "Should correctly parse AI Foundry name from resource ID"
  }

  assert {
    condition     = local.ai_foundry_project_name == "default-project"
    error_message = "Should correctly use project name from variable"
  }

  assert {
    condition     = local.app_insights_name == "appi-basic-test123"
    error_message = "Should correctly parse Application Insights name from resource ID"
  }

  assert {
    condition     = local.ai_foundry_endpoint == "https://cog-basic-test123.cognitiveservices.azure.com/"
    error_message = "Should discover AI Foundry endpoint from data source"
  }
}

run "testacc_function_app_configuration" {
  command = plan

  variables {
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123/projects/default-project"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.Insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name      = "test-ai-func"
    function_sku_size = "B1"
  }

  # Test the native Terraform-managed resources
  assert {
    condition     = azurerm_service_plan.function.os_type == "Linux"
    error_message = "The App Service Plan should be Linux-based"
  }

  assert {
    condition     = azurerm_service_plan.function.sku_name == "B1"
    error_message = "The App Service Plan SKU should be 'B1' for Dedicated tier"
  }

  assert {
    condition     = azurerm_storage_account.function.account_tier == "Standard"
    error_message = "Storage account should be Standard tier"
  }

  assert {
    condition     = azurerm_storage_account.function.shared_access_key_enabled == false
    error_message = "Storage account should have shared access keys disabled for security"
  }

  assert {
    condition     = azurerm_linux_function_app.main.storage_uses_managed_identity == true
    error_message = "Function app should use managed identity for storage access"
  }

  assert {
    condition     = azurerm_linux_function_app.main.functions_extension_version == "~4"
    error_message = "Function app should use Functions runtime version 4"
  }

  assert {
    condition     = azurerm_linux_function_app.main.identity[0].type == "SystemAssigned"
    error_message = "Function app should have System Assigned managed identity"
  }
}

run "testacc_role_assignments" {
  command = plan

  variables {
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123/projects/default-project"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.Insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name = "test-ai-func"
  }

  # Test role assignments
  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.role_definition_name == "Cognitive Services User"
    error_message = "Cognitive Services User role assignment should exist"
  }
}

run "testacc_security_configuration" {
  command = plan

  variables {
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123/projects/default-project"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.Insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name = "test-ai-func"
  }

  # Test security configurations
  assert {
    condition     = azurerm_storage_account.function.min_tls_version == "TLS1_2"
    error_message = "Storage account should use minimum TLS 1.2"
  }

  assert {
    condition     = azurerm_storage_account.function.https_traffic_only_enabled == true
    error_message = "Storage account should only allow HTTPS traffic"
  }

  assert {
    condition     = azurerm_storage_account.function.allow_nested_items_to_be_public == false
    error_message = "Storage account should not allow public blob access"
  }

  assert {
    condition     = azurerm_linux_function_app.main.site_config[0].ftps_state == "Disabled"
    error_message = "Function app should have FTPS disabled"
  }

  assert {
    condition     = azurerm_linux_function_app.main.site_config[0].minimum_tls_version == "1.2"
    error_message = "Function app should use minimum TLS 1.2"
  }
}
