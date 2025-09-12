# Acceptance tests for AI Foundry Basic with Azure Function Integration

run "testacc_ai_foundry_function_basic" {
  command = plan

  variables {
    location             = "swedencentral"
    project_name         = "test-ai-func"
    project_display_name = "Test AI Functions"
    project_description  = "Test AI Foundry with Functions"
    function_app_sku     = "B1"
    tags = {
      Environment = "test"
      Purpose     = "acceptance"
    }
  }

  assert {
    condition     = azurerm_service_plan.function.location == "swedencentral"
    error_message = "The App Service Plan location should be 'swedencentral'"
  }

  assert {
    condition     = azurerm_service_plan.function.sku_name == "B1"
    error_message = "The App Service Plan SKU should be 'B1'"
  }

  assert {
    condition     = azurerm_linux_function_app.main.location == "swedencentral"
    error_message = "The Function App location should be 'swedencentral'"
  }

  assert {
    condition     = azurerm_linux_function_app.main.identity[0].type == "SystemAssigned"
    error_message = "Function App should have SystemAssigned managed identity"
  }

  assert {
    condition     = azurerm_linux_function_app.main.site_config[0].application_stack[0].python_version == "3.11"
    error_message = "Function App should use Python 3.11"
  }
}

run "testacc_role_assignments" {
  command = plan

  variables {
    location     = "swedencentral"
    project_name = "test-ai-func"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_foundry_contributor.role_definition_name == "Cognitive Services User"
    error_message = "Function App should have Cognitive Services User role"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_openai_user.role_definition_name == "Cognitive Services OpenAI User"
    error_message = "Function App should have Cognitive Services OpenAI User role"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_contributor.role_definition_name == "Cognitive Services Contributor"
    error_message = "Function App should have Cognitive Services Contributor role"
  }

  assert {
    condition     = azurerm_role_assignment.function_ai_project_contributor.role_definition_name == "Contributor"
    error_message = "Function App should have Contributor role on AI Project"
  }
}

run "testacc_naming_conventions" {
  command = plan

  variables {
    location     = "swedencentral"
    project_name = "test-ai-func"
  }

  assert {
    condition     = can(regex("^asp-", azurerm_service_plan.function.name))
    error_message = "App Service Plan name should start with 'asp-'"
  }

  assert {
    condition     = random_string.suffix.length == 6
    error_message = "Random suffix should be configured for 6 characters"
  }

  assert {
    condition     = random_string.suffix.special == false
    error_message = "Random suffix should not include special characters"
  }

  assert {
    condition     = random_string.suffix.upper == false
    error_message = "Random suffix should not include uppercase letters"
  }
}
