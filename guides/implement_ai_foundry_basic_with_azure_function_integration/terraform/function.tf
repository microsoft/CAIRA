# function.tf - Azure Function App Resources, adds serverless compute to AI Foundry

# Storage Account for Function App
resource "azurerm_storage_account" "function" {
  name                     = "st${replace(local.base_name, "-", "")}${random_string.suffix.result}"
  resource_group_name      = local.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = var.tags
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# App Service Plan
resource "azurerm_service_plan" "function" {
  name                = "asp-${local.base_name}"
  resource_group_name = local.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.function_app_sku
  tags                = var.tags
}

# Function App
resource "azurerm_linux_function_app" "main" {
  name                       = "func-${local.base_name}-${random_string.suffix.result}"
  resource_group_name        = local.resource_group_name
  location                   = var.location
  service_plan_id            = azurerm_service_plan.function.id
  storage_account_name       = azurerm_storage_account.function.name
  storage_account_access_key = azurerm_storage_account.function.primary_access_key

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"       = "python"
    "FUNCTIONS_EXTENSION_VERSION"    = "~4"
    "APPINSIGHTS_INSTRUMENTATIONKEY" = module.foundry_basic.application_insights_instrumentation_key
    "AI_FOUNDRY_ENDPOINT"            = module.foundry_basic.ai_foundry_endpoint
    "AI_FOUNDRY_PROJECT_ID"          = module.foundry_basic.ai_foundry_project_id
    "AI_FOUNDRY_PROJECT_NAME"        = module.foundry_basic.ai_foundry_project_name
  }

  site_config {
    python_version = "3.11"

    application_insights_connection_string = module.foundry_basic.application_insights_connection_string
    application_insights_key               = module.foundry_basic.application_insights_instrumentation_key

    cors {
      allowed_origins = ["https://portal.azure.com"]
    }
  }

  tags = var.tags
}

# Role Assignment for Function App to access AI Foundry
resource "azurerm_role_assignment" "function_ai_foundry_contributor" {
  scope                = module.foundry_basic.ai_foundry_id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}

resource "azurerm_role_assignment" "function_ai_project_contributor" {
  scope                = module.foundry_basic.ai_foundry_project_id
  role_definition_name = "Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
