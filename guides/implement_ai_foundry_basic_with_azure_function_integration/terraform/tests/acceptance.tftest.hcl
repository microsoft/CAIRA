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

  # These variables represent outputs from foundry_basic deployment
  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_endpoint        = "https://cog-basic-test123.cognitiveservices.azure.com/"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name      = "test-ai-func"
    function_sku_size = "B1"
    tags = {
      Environment = "test"
      Purpose     = "acceptance"
    }
  }

  assert {
    condition     = data.azurerm_resource_group.this.name == "rg-basic-test123"
    error_message = "The resource group data source should reference the correct resource group"
  }

  assert {
    condition     = data.azurerm_application_insights.this.name == "appi-basic-test123"
    error_message = "The Application Insights data source should reference the correct instance"
  }
}

run "testacc_function_app_configuration" {
  command = plan

  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_endpoint        = "https://cog-basic-test123.cognitiveservices.azure.com/"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
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

  # Test the new native storage account resource
  assert {
    condition     = azurerm_storage_account.function.account_tier == "Standard"
    error_message = "Storage account should be Standard tier"
  }

  assert {
    condition     = azurerm_storage_account.function.shared_access_key_enabled == false
    error_message = "Storage account should have shared access keys disabled for security"
  }

  # Test the new native function app resource
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

  # Test diagnostic settings
  assert {
    condition     = azurerm_monitor_diagnostic_setting.function != null
    error_message = "Diagnostic settings should be configured"
  }
}

run "testacc_role_assignments" {
  command = plan

  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_endpoint        = "https://cog-basic-test123.cognitiveservices.azure.com/"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name = "test-ai-func"
  }

  # Test role assignments
  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.role_definition_name == "Cognitive Services User"
    error_message = "Cognitive Services User role assignment should exist"
  }
}

run "testacc_naming_conventions" {
  command = plan

  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_endpoint        = "https://cog-basic-test123.cognitiveservices.azure.com/"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name = "test-ai-func"
  }

  # Test that the resource group is created and we can find an existing RG
  assert {
    condition     = azurerm_resource_group.function != null
    error_message = "Function resource group should be created"
  }

  assert {
    condition     = data.azurerm_resource_group.this.name == "rg-basic-test123"
    error_message = "Should be able to reference the foundry resource group"
  }

  # Verify location is available
  assert {
    condition     = data.azurerm_resource_group.this.location != null
    error_message = "Location should be available from resource group data source"
  }

  # Test that naming module is being used
  assert {
    condition     = module.naming != null
    error_message = "Naming module should be referenced"
  }

  # Verify that resources are defined (values are computed at plan time)
  assert {
    condition     = azurerm_storage_account.function != null
    error_message = "Storage account resource should be defined"
  }

  # Verify function app resource is defined
  assert {
    condition     = azurerm_linux_function_app.main != null
    error_message = "Function app resource should be defined"
  }
}

run "testacc_security_configuration" {
  command = plan

  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_endpoint        = "https://cog-basic-test123.cognitiveservices.azure.com/"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
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
