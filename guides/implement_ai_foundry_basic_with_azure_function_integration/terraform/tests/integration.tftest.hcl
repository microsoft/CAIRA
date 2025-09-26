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
    project_name      = "inttest"
    function_tier     = "Dedicated"
    function_sku_size = "B1"
    python_version    = "3.11"
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

    project_name = "inttest"
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
    condition     = local.ai_foundry_endpoint == data.azurerm_cognitive_account.ai_foundry.endpoint
    error_message = "AI Foundry endpoint should be configured correctly"
  }

  assert {
    condition     = var.foundry_ai_foundry_project_name != null && var.foundry_ai_foundry_project_name != ""
    error_message = "Project name should be configured"
  }

  assert {
    condition     = azurerm_monitor_diagnostic_setting.function.id != null
    error_message = "Diagnostic settings should be configured"
  }

  # Test app settings are properly configured
  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AZURE_AI_FOUNDRY_ENDPOINT"] == local.ai_foundry_endpoint
    error_message = "Function App should have AI Foundry endpoint configured"
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
    foundry_resource_group_name        = run.setup_foundry_basic.resource_group_name
    foundry_ai_foundry_name            = run.setup_foundry_basic.ai_foundry_name
    foundry_ai_foundry_id              = run.setup_foundry_basic.ai_foundry_id
    foundry_ai_foundry_project_id      = run.setup_foundry_basic.ai_foundry_project_id
    foundry_ai_foundry_project_name    = run.setup_foundry_basic.ai_foundry_project_name
    foundry_application_insights_name  = element(split("/", run.setup_foundry_basic.application_insights_id), length(split("/", run.setup_foundry_basic.application_insights_id)) - 1)
    foundry_application_insights_id    = run.setup_foundry_basic.application_insights_id
    foundry_log_analytics_workspace_id = run.setup_foundry_basic.log_analytics_workspace_id

    project_name = "inttest"
  }

  # Test that native role assignment resources were created
  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_contributor.id != null
    error_message = "Cognitive Services Contributor role assignment resource should exist"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_user.id != null
    error_message = "Cognitive Services User role assignment resource should exist"
  }

  assert {
    condition     = azurerm_role_assignment.function_storage_blob.id != null
    error_message = "Storage Blob Data Owner role assignment should exist"
  }

  assert {
    condition     = azurerm_role_assignment.function_storage_file.id != null
    error_message = "Storage File Data SMB Share Contributor role assignment should exist"
  }

  assert {
    condition     = azurerm_role_assignment.function_storage_queue.id != null
    error_message = "Storage Queue Data Contributor role assignment should exist"
  }

  # Verify the identity being used for role assignments
  assert {
    condition     = azurerm_linux_function_app.main.identity[0].principal_id != null && azurerm_linux_function_app.main.identity[0].principal_id != ""
    error_message = "Function App identity should be available for role assignments"
  }

  # Verify role assignments are using the correct principal
  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_contributor.principal_id == azurerm_linux_function_app.main.identity[0].principal_id
    error_message = "AI Foundry Contributor role should be assigned to Function App identity"
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

    project_name = "inttest"
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
    condition     = output.function_app_default_hostname != null && length(output.function_app_default_hostname) > 0
    error_message = "Function App hostname should not be empty"
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

# Step 6: Test security settings
run "test_security" {
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
}
