# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

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
    condition     = output.ai_foundry_endpoint != null
    error_message = "foundry_basic AI Foundry endpoint should be created"
  }

  assert {
    condition     = output.ai_foundry_project_id != null
    error_message = "foundry_basic AI Foundry project should be created"
  }

  assert {
    condition     = output.ai_foundry_project_name != null
    error_message = "foundry_basic AI Foundry project name should be created"
  }

  assert {
    condition     = output.application_insights_id != null
    error_message = "foundry_basic Application Insights should be created"
  }
}

# Step 2: Test function deployment using foundry_basic outputs
run "test_function_deployment" {
  command = apply

  variables {
    # Use outputs from the setup_foundry_basic run
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    # Function-specific configuration
    project_name      = "inttest"
    function_sku_size = "B1"
    tags = {
      Environment = "test"
      Purpose     = "integration-testing"
      Temporary   = "true"
    }
  }

  # Test that function resources are created using native Terraform resources
  assert {
    condition     = azurerm_linux_function_app.main.id != null
    error_message = "Function App resource should be created"
  }

  assert {
    condition     = azurerm_linux_function_app.main.default_hostname != null && azurerm_linux_function_app.main.default_hostname != ""
    error_message = "Function App should have a hostname"
  }

  assert {
    condition     = azurerm_storage_account.function.id != null
    error_message = "Storage account resource should be created"
  }

  assert {
    condition     = azurerm_storage_account.function.name != null && azurerm_storage_account.function.name != ""
    error_message = "Storage account should exist in Azure"
  }

  assert {
    condition     = azurerm_service_plan.function.id != null
    error_message = "App Service Plan should be created"
  }

  assert {
    condition     = azurerm_linux_function_app.main.identity[0].principal_id != null && azurerm_linux_function_app.main.identity[0].principal_id != ""
    error_message = "Function App managed identity should be created"
  }

  # Validate parsing worked correctly by comparing with foundry_basic outputs
  assert {
    condition     = local.foundry_resource_group_name == run.setup_foundry_basic.resource_group_name
    error_message = "Parsed resource group name should match foundry_basic output"
  }

  assert {
    condition     = local.ai_foundry_name == run.setup_foundry_basic.ai_foundry_name
    error_message = "Parsed AI Foundry name should match foundry_basic output"
  }

  assert {
    condition     = local.ai_foundry_endpoint == run.setup_foundry_basic.ai_foundry_endpoint
    error_message = "Discovered AI Foundry endpoint should match foundry_basic output"
  }

  assert {
    condition     = local.ai_foundry_project_name == run.setup_foundry_basic.ai_foundry_project_name
    error_message = "Project name from variable should match foundry_basic output"
  }

  # Validate Application Insights ID parsing worked
  assert {
    condition     = local.app_insights_name != null && local.app_insights_name != ""
    error_message = "Should successfully parse Application Insights name from resource ID"
  }

  assert {
    condition     = local.app_insights_resource_group != null && local.app_insights_resource_group != ""
    error_message = "Should successfully parse resource group from Application Insights ID"
  }
}

# Step 3: Test connectivity between function and foundry resources
run "test_connectivity" {
  command = apply

  variables {
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    project_name = "inttest"
  }

  # Test connectivity and configuration
  assert {
    condition     = data.azurerm_cognitive_account.ai_foundry.endpoint != null
    error_message = "Should be able to retrieve AI Foundry endpoint from data source"
  }

  assert {
    condition     = data.azurerm_application_insights.this.connection_string != null
    error_message = "Should be able to retrieve Application Insights connection"
  }

  assert {
    condition     = local.ai_foundry_endpoint == data.azurerm_cognitive_account.ai_foundry.endpoint
    error_message = "AI Foundry endpoint should be configured correctly"
  }

  assert {
    condition     = local.ai_foundry_project_name != null && local.ai_foundry_project_name != ""
    error_message = "Project name should be available from variable"
  }

  assert {
    condition     = local.ai_foundry_project_name == run.setup_foundry_basic.ai_foundry_project_name
    error_message = "Project name should match foundry_basic output"
  }

  assert {
    condition     = azurerm_monitor_diagnostic_setting.function.id != null
    error_message = "Diagnostic settings should be configured"
  }

  # Test app settings are properly configured with discovered values
  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_ENDPOINT"] == local.ai_foundry_endpoint
    error_message = "Function App should have AI Foundry endpoint configured from data source"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_PROJECT_NAME"] == local.ai_foundry_project_name
    error_message = "Function App should have project name configured"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AzureWebJobsStorage__credential"] == "managedidentity"
    error_message = "Function App should be configured to use managed identity for storage"
  }
}

# Step 4: Test role assignments
run "test_role_assignments" {
  command = apply

  variables {
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    project_name = "inttest"
  }

  # Test role assignments
  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.id != null
    error_message = "Cognitive Services User role assignment resource should exist"
  }

  # Verify the identity being used for role assignments
  assert {
    condition     = azurerm_linux_function_app.main.identity[0].principal_id != null && azurerm_linux_function_app.main.identity[0].principal_id != ""
    error_message = "Function App identity should be available for role assignments"
  }

  # Verify role assignments are using the correct principal
  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.principal_id == azurerm_linux_function_app.main.identity[0].principal_id
    error_message = "AI Foundry User role should be assigned to Function App identity"
  }
}

# Step 5: Test security settings and validate outputs
run "test_security" {
  command = apply

  variables {
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    project_name = "inttest"
  }

  # Test security configurations
  assert {
    condition     = azurerm_storage_account.function.shared_access_key_enabled == false
    error_message = "Storage account should have shared access keys disabled"
  }

  assert {
    condition     = azurerm_storage_account.function.min_tls_version == "TLS1_2"
    error_message = "Storage account should enforce minimum TLS 1.2"
  }

  assert {
    condition     = azurerm_linux_function_app.main.storage_uses_managed_identity == true
    error_message = "Function App should use managed identity for storage access"
  }

  assert {
    condition     = azurerm_linux_function_app.main.site_config[0].ftps_state == "Disabled"
    error_message = "Function App should have FTPS disabled for security"
  }

  assert {
    condition     = azurerm_linux_function_app.main.site_config[0].minimum_tls_version == "1.2"
    error_message = "Function App should enforce minimum TLS 1.2"
  }

  assert {
    condition     = azurerm_linux_function_app.main.identity[0].type == "SystemAssigned"
    error_message = "Function App should use System Assigned managed identity"
  }

  # Validate deployment-related outputs exist
  assert {
    condition     = output.function_app_name != null && output.function_app_name != ""
    error_message = "Should output function app name for deployment"
  }

  assert {
    condition     = output.function_app_url != null && output.function_app_url != ""
    error_message = "Should output function app URL for testing"
  }

  assert {
    condition     = output.resource_group_name != null && output.resource_group_name != ""
    error_message = "Should output resource group name for deployment context"
  }

  # Validate local development outputs exist and match foundry_basic
  assert {
    condition     = output.ai_foundry_endpoint == run.setup_foundry_basic.ai_foundry_endpoint
    error_message = "AI Foundry endpoint output should match foundry_basic"
  }

  assert {
    condition     = output.ai_foundry_project_name != null && output.ai_foundry_project_name != ""
    error_message = "Should output AI Foundry project name for local development"
  }

  assert {
    condition     = output.ai_foundry_project_name == run.setup_foundry_basic.ai_foundry_project_name
    error_message = "AI Foundry project name output should match foundry_basic"
  }

  assert {
    condition     = output.ai_foundry_project_id == run.setup_foundry_basic.ai_foundry_project_id
    error_message = "AI Foundry project ID output should match input variable"
  }

  assert {
    condition     = output.foundry_resource_group_name == run.setup_foundry_basic.resource_group_name
    error_message = "Foundry resource group output should match foundry_basic"
  }

  assert {
    condition     = output.subscription_id != null && output.subscription_id != ""
    error_message = "Should output subscription ID for local development"
  }
}
