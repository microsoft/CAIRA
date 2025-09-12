# Integration tests for AI Foundry Basic with Azure Function Integration

run "testint_ai_foundry_function_complete" {
  command = apply

  variables {
    location             = "swedencentral"
    project_name         = "tst"
    project_display_name = "Test AI Functions"
    project_description  = "Integration test"
    function_app_sku     = "B1"
    tags = {
      Environment = "test"
      Purpose     = "ci-cd"
    }
  }

  assert {
    condition     = module.foundry_basic.resource_group_name != null
    error_message = "The resource group name should not be null"
  }

  assert {
    condition     = module.foundry_basic.ai_foundry_id != null
    error_message = "The AI Foundry ID should not be null"
  }

  assert {
    condition     = module.foundry_basic.ai_foundry_project_id != null
    error_message = "The AI Foundry project ID should not be null"
  }

  assert {
    condition     = module.foundry_basic.ai_foundry_name != null && length(module.foundry_basic.ai_foundry_name) > 0
    error_message = "The AI Foundry name should not be empty"
  }

  assert {
    condition     = module.foundry_basic.ai_foundry_project_name != null && length(module.foundry_basic.ai_foundry_project_name) > 0
    error_message = "The AI Foundry project name should not be empty"
  }

  assert {
    condition     = azurerm_linux_function_app.main.id != null
    error_message = "The Function App ID should not be null"
  }

  assert {
    condition     = azurerm_linux_function_app.main.name != null && can(regex("^func-", azurerm_linux_function_app.main.name))
    error_message = "The Function App should be created with proper naming convention"
  }

  assert {
    condition     = azurerm_linux_function_app.main.default_hostname != null && length(azurerm_linux_function_app.main.default_hostname) > 0
    error_message = "The Function App should have a valid hostname"
  }

  assert {
    condition     = azurerm_linux_function_app.main.identity[0].principal_id != null
    error_message = "The Function App managed identity principal ID should not be null"
  }

  assert {
    condition     = azurerm_service_plan.function.id != null
    error_message = "The App Service Plan ID should not be null"
  }

  assert {
    condition     = azurerm_service_plan.function.kind == "linux"
    error_message = "The App Service Plan should be Linux-based"
  }

  assert {
    condition     = data.azurerm_storage_account.function.id != null
    error_message = "The Storage Account ID should not be null"
  }

  assert {
    condition     = data.azurerm_storage_account.function.primary_connection_string != null
    error_message = "The Storage Account should have a primary connection string"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_contributor.id != null
    error_message = "The Cognitive Services User role assignment should be created"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_openai_user.id != null
    error_message = "The Cognitive Services OpenAI User role assignment should be created"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_contributor.id != null
    error_message = "The Cognitive Services Contributor role assignment should be created"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_project_contributor.id != null
    error_message = "The AI Project Contributor role assignment should be created"
  }

  assert {
    condition     = module.foundry_basic.application_insights_id != null
    error_message = "Application Insights should be created"
  }

  assert {
    condition     = module.foundry_basic.log_analytics_workspace_id != null
    error_message = "Log Analytics Workspace should be created"
  }
}

run "testint_function_app_configuration" {
  command = apply

  variables {
    location         = "swedencentral"
    project_name     = "tst"
    function_app_sku = "B1"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["FUNCTIONS_WORKER_RUNTIME"] == "python"
    error_message = "Function App should have Python runtime configured"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_ENDPOINT"] != null && can(regex("^https://.*\\.cognitiveservices\\.azure\\.com/$", azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_ENDPOINT"]))
    error_message = "Function App should have valid AI Foundry endpoint configured"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_PROJECT_ID"] != null && length(azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_PROJECT_ID"]) > 0
    error_message = "Function App should have AI Foundry project ID configured"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_PROJECT_NAME"] != null && length(azurerm_linux_function_app.main.app_settings["AI_FOUNDRY_PROJECT_NAME"]) > 0
    error_message = "Function App should have AI Foundry project name configured"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["RESOURCE_GROUP"] != null && length(azurerm_linux_function_app.main.app_settings["RESOURCE_GROUP"]) > 0
    error_message = "Function App should have resource group configured"
  }

  assert {
    condition     = azurerm_linux_function_app.main.app_settings["AZURE_SUBSCRIPTION_ID"] != null && can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", azurerm_linux_function_app.main.app_settings["AZURE_SUBSCRIPTION_ID"]))
    error_message = "Function App should have valid Azure subscription ID configured"
  }

  assert {
    condition     = azurerm_linux_function_app.main.site_config[0].application_stack[0].python_version == "3.11"
    error_message = "Function App should use Python 3.11"
  }

  assert {
    condition     = contains(azurerm_linux_function_app.main.site_config[0].cors[0].allowed_origins, "https://portal.azure.com")
    error_message = "Function App should allow CORS from Azure Portal"
  }
}

run "testint_outputs_validation" {
  command = apply

  variables {
    location     = "swedencentral"
    project_name = "tst"
  }

  assert {
    condition     = output.ai_foundry_id != null && length(output.ai_foundry_id) > 0
    error_message = "The ai_foundry_id output should not be empty"
  }

  assert {
    condition     = output.ai_foundry_name != null && length(output.ai_foundry_name) > 0
    error_message = "The ai_foundry_name output should not be empty"
  }

  assert {
    condition     = output.ai_foundry_endpoint != null && can(regex("^https://.*\\.cognitiveservices\\.azure\\.com/$", output.ai_foundry_endpoint))
    error_message = "The ai_foundry_endpoint output should be a valid Cognitive Services URL"
  }

  assert {
    condition     = output.ai_foundry_project_id != null && length(output.ai_foundry_project_id) > 0
    error_message = "The ai_foundry_project_id output should not be empty"
  }

  assert {
    condition     = output.ai_foundry_project_name != null && length(output.ai_foundry_project_name) > 0
    error_message = "The ai_foundry_project_name output should not be empty"
  }

  assert {
    condition     = output.resource_group_name != null && length(output.resource_group_name) > 0
    error_message = "The resource_group_name output should not be empty"
  }

  assert {
    condition     = output.function_app_name != null && can(regex("^func-", output.function_app_name))
    error_message = "The function_app_name output should follow naming convention"
  }

  assert {
    condition     = output.function_app_url != null && can(regex("^https://.*\\.azurewebsites\\.net$", output.function_app_url))
    error_message = "The function_app_url output should be a valid Azure Function URL"
  }

  assert {
    condition     = output.function_app_identity_principal_id != null && can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", output.function_app_identity_principal_id))
    error_message = "The function_app_identity_principal_id output should be a valid GUID"
  }

  assert {
    condition     = output.application_insights_id != null && length(output.application_insights_id) > 0
    error_message = "The application_insights_id output should not be empty"
  }

  assert {
    condition     = output.log_analytics_workspace_id != null && length(output.log_analytics_workspace_id) > 0
    error_message = "The log_analytics_workspace_id output should not be empty"
  }
}
