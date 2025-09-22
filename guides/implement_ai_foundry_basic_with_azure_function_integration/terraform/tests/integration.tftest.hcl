# Integration tests for Azure Functions Integration Layer with AI Foundry Basic
# Self-contained integration tests that create all required resources
# No external setup needed - creates foundry_basic, tests functions, then cleans up

# Step 1: Deploy foundry_basic infrastructure
run "setup_foundry_basic" {
  command = apply

  # Point to the foundry_basic module
  module {
    source = "../../../reference_architectures/foundry_basic"
  }

  variables {
    location             = "swedencentral"
    project_name         = "inttest"
    project_display_name = "Integration Test Project"
    project_description  = "Temporary project for integration testing"
    sku                  = "S0"
    tags = {
      Environment = "test"
      Purpose     = "integration-testing"
      Temporary   = "true"
    }
  }

  # Verify foundry_basic was created successfully
  assert {
    condition     = output.resource_group_name != null
    error_message = "foundry_basic resource group should be created"
  }

  assert {
    condition     = output.ai_foundry_name != null
    error_message = "foundry_basic AI Foundry should be created"
  }

  assert {
    condition     = output.ai_foundry_project_id != null
    error_message = "foundry_basic AI Foundry project should be created"
  }
}

# Step 2: Test function deployment using foundry_basic outputs
run "test_function_deployment" {
  command = apply

  variables {
    # Use outputs from the setup_foundry_basic run
    foundry_resource_group_name     = run.setup_foundry_basic.resource_group_name
    foundry_ai_foundry_name         = run.setup_foundry_basic.ai_foundry_name
    foundry_ai_foundry_id           = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id   = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name = run.setup_foundry_basic.ai_foundry_project_name
    # Extract Application Insights name from its ID (last segment after /)
    foundry_application_insights_name  = element(split("/", run.setup_foundry_basic.application_insights_id), length(split("/", run.setup_foundry_basic.application_insights_id)) - 1)
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    # Function-specific configuration
    project_name      = "inttest-func"
    function_tier     = "Dynamic"
    function_sku_size = "Y1"
    python_version    = "3.11"
    tags = {
      Environment = "test"
      Purpose     = "integration-testing"
      Temporary   = "true"
    }
  }

  # Test that function resources are created
  assert {
    condition     = azurerm_linux_function_app.this.id != null
    error_message = "Function App should be created"
  }

  assert {
    condition     = azurerm_linux_function_app.this.default_hostname != null
    error_message = "Function App should have a hostname"
  }

  assert {
    condition     = azurerm_storage_account.function.id != null
    error_message = "Storage account should be created"
  }

  assert {
    condition     = azurerm_service_plan.function.id != null
    error_message = "App Service Plan should be created"
  }

  assert {
    condition     = azurerm_linux_function_app.this.identity[0].principal_id != null
    error_message = "Function App managed identity should be created"
  }
}

# Step 3: Test connectivity between function and foundry resources
run "test_connectivity" {
  command = apply

  variables {
    foundry_resource_group_name        = run.setup_foundry_basic.resource_group_name
    foundry_ai_foundry_name            = run.setup_foundry_basic.ai_foundry_name
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_name  = element(split("/", run.setup_foundry_basic.application_insights_id), length(split("/", run.setup_foundry_basic.application_insights_id)) - 1)
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    project_name = "inttest-func"
  }

  # Test connectivity and configuration
  assert {
    condition     = data.azurerm_cognitive_account.ai_foundry.endpoint != null
    error_message = "Should be able to retrieve AI Foundry endpoint"
  }

  assert {
    condition     = data.azurerm_application_insights.this.connection_string != null
    error_message = "Should be able to retrieve Application Insights connection"
  }

  assert {
    condition     = azurerm_linux_function_app.this.app_settings["AZURE_AI_FOUNDRY_ENDPOINT"] == data.azurerm_cognitive_account.ai_foundry.endpoint
    error_message = "Function App should have correct AI Foundry endpoint"
  }

  assert {
    condition     = azurerm_linux_function_app.this.app_settings["AZURE_AI_FOUNDRY_KEY"] != null
    error_message = "Function App should have AI Foundry key configured"
  }

  assert {
    condition     = azurerm_linux_function_app.this.app_settings["AZURE_AI_FOUNDRY_PROJECT_NAME"] != null
    error_message = "Function App should have project name configured"
  }

  assert {
    condition     = azurerm_monitor_diagnostic_setting.function.log_analytics_workspace_id == run.setup_foundry_basic.log_analytics_workspace_id
    error_message = "Diagnostic settings should use the foundry Log Analytics workspace"
  }
}

# Step 4: Test role assignments
run "test_role_assignments" {
  command = apply

  variables {
    foundry_resource_group_name        = run.setup_foundry_basic.resource_group_name
    foundry_ai_foundry_name            = run.setup_foundry_basic.ai_foundry_name
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_name  = element(split("/", run.setup_foundry_basic.application_insights_id), length(split("/", run.setup_foundry_basic.application_insights_id)) - 1)
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    project_name = "inttest-func"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_contributor.id != null
    error_message = "Cognitive Services Contributor role should be assigned"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.id != null
    error_message = "Cognitive Services User role should be assigned"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_contributor.principal_id == azurerm_linux_function_app.this.identity[0].principal_id
    error_message = "Contributor role should use Function App's managed identity"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.principal_id == azurerm_linux_function_app.this.identity[0].principal_id
    error_message = "User role should use Function App's managed identity"
  }
}

# Step 5: Test outputs
run "test_outputs" {
  command = apply

  variables {
    foundry_resource_group_name        = run.setup_foundry_basic.resource_group_name
    foundry_ai_foundry_name            = run.setup_foundry_basic.ai_foundry_name
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_name  = element(split("/", run.setup_foundry_basic.application_insights_id), length(split("/", run.setup_foundry_basic.application_insights_id)) - 1)
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    project_name = "inttest-func"
  }

  # Test all outputs contain valid values
  assert {
    condition     = output.function_app_id != null && startswith(output.function_app_id, "/subscriptions/")
    error_message = "Function App ID should be a valid Azure resource ID"
  }

  assert {
    condition     = output.function_app_name != null && length(output.function_app_name) > 0
    error_message = "Function App name should not be empty"
  }

  assert {
    condition     = output.function_app_url != null && can(regex("^https://.*\\.azurewebsites\\.net$", output.function_app_url))
    error_message = "Function App URL should be valid"
  }

  assert {
    condition     = output.function_app_identity_principal_id != null
    error_message = "Function App managed identity principal ID should be available"
  }

  assert {
    condition     = length(output.function_app_outbound_ip_addresses) > 0
    error_message = "Function App should have outbound IP addresses"
  }

  assert {
    condition     = output.storage_account_name != null
    error_message = "Storage account name should be available"
  }

  assert {
    condition     = output.service_plan_id != null
    error_message = "Service plan ID should be available"
  }
}
