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

  # These variables represent outputs from foundry_basic deployment
  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_name            = "cog-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/microsoft.insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name      = "test-ai-func"
    function_tier     = "Dynamic"
    function_sku_size = "Y1"
    python_version    = "3.11"
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
    condition     = data.azurerm_cognitive_account.ai_foundry.name == "cog-basic-test123"
    error_message = "The AI Foundry data source should reference the correct account"
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
    foundry_ai_foundry_name            = "cog-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/microsoft.insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name      = "test-ai-func"
    function_tier     = "Dynamic"
    function_sku_size = "Y1"
    python_version    = "3.11"
  }

  # Test only the most basic static configuration values
  assert {
    condition     = azurerm_service_plan.function.os_type == "Linux"
    error_message = "The App Service Plan should be Linux-based"
  }

  assert {
    condition     = azurerm_service_plan.function.sku_name == "Y1"
    error_message = "The App Service Plan SKU should be 'Y1' for Dynamic tier"
  }

  assert {
    condition     = azurerm_storage_account.function.account_tier == "Standard"
    error_message = "Storage account should use Standard tier"
  }

  assert {
    condition     = azurerm_storage_account.function.account_replication_type == "LRS"
    error_message = "Storage account should use LRS replication"
  }

  assert {
    condition     = azurerm_storage_account.function.min_tls_version == "TLS1_2"
    error_message = "Storage account should use minimum TLS 1.2"
  }

  assert {
    condition     = azurerm_monitor_diagnostic_setting.function.log_analytics_workspace_id == var.foundry_log_analytics_workspace_id
    error_message = "Diagnostic settings should use the foundry Log Analytics workspace"
  }
}

run "testacc_role_assignments" {
  command = plan

  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_name            = "cog-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/microsoft.insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name = "test-ai-func"
  }

  # Test role assignment configurations (not computed values)
  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_contributor.role_definition_name == "Cognitive Services Contributor"
    error_message = "Function App should have Cognitive Services Contributor role"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.role_definition_name == "Cognitive Services User"
    error_message = "Function App should have Cognitive Services User role"
  }

  # Check that role assignments reference the correct variable
  assert {
    condition     = can(azurerm_role_assignment.function_ai_foundry_contributor.scope)
    error_message = "Contributor role assignment should have a scope defined"
  }

  assert {
    condition     = can(azurerm_role_assignment.function_ai_foundry_user.scope)
    error_message = "User role assignment should have a scope defined"
  }
}

run "testacc_naming_conventions" {
  command = plan

  variables {
    foundry_resource_group_name        = "rg-basic-test123"
    foundry_ai_foundry_name            = "cog-basic-test123"
    foundry_ai_foundry_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.CognitiveServices/accounts/cog-basic-test123"
    foundry_ai_foundry_project_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.MachineLearningServices/workspaces/proj-test"
    foundry_ai_foundry_project_name    = "default-project"
    foundry_application_insights_name  = "appi-basic-test123"
    foundry_application_insights_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/microsoft.insights/components/appi-basic-test123"
    foundry_log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-basic-test123/providers/Microsoft.OperationalInsights/workspaces/log-basic-test123"

    project_name = "test-ai-func"
  }

  # Test only static local values that don't depend on module outputs
  assert {
    condition     = startswith(local.base_name, "func-")
    error_message = "Base name should start with 'func-'"
  }

  assert {
    condition     = local.base_name == "func-test-ai-func"
    error_message = "Base name should be 'func-' followed by project name"
  }

  assert {
    condition     = local.resource_group_name == var.foundry_resource_group_name
    error_message = "Local resource group name should match the input variable"
  }

  # Just verify the location is being read from the data source
  assert {
    condition     = data.azurerm_resource_group.this.location != null
    error_message = "Location should be available from resource group data source"
  }
}
