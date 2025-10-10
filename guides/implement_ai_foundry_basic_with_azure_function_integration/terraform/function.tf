# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Azure Functions Resources
############################################################

# Storage Account for Function App
resource "azurerm_storage_account" "function" {
  name                     = replace(module.naming.storage_account.name_unique, "-", "")
  resource_group_name      = local.resource_group_name
  location                 = local.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  # Security settings
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false

  # Default network rules
  # trivy:ignore:AVD-AZU-0012
  network_rules {
    default_action = "Allow" # Educational simplification - use "Deny" in production
    bypass         = ["AzureServices"]
  }

  # Enable managed identity access
  public_network_access_enabled = true

  tags = var.tags

  depends_on = [azurerm_resource_group.function]
}

# App Service Plan for Function App
resource "azurerm_service_plan" "function" {
  name                = module.naming.app_service_plan.name_unique
  resource_group_name = local.resource_group_name
  location            = local.location
  os_type             = "Linux"
  sku_name            = var.function_sku_size

  tags = var.tags

  depends_on = [azurerm_resource_group.function]
}

# Linux Function App with Managed Identity
resource "azurerm_linux_function_app" "main" {
  name                = local.function_app_name
  resource_group_name = local.resource_group_name
  location            = local.location
  service_plan_id     = azurerm_service_plan.function.id

  # Storage configuration using managed identity
  storage_account_name          = azurerm_storage_account.function.name
  storage_uses_managed_identity = true

  # Runtime configuration
  functions_extension_version = "~4"

  site_config {
    always_on                = false
    ftps_state               = "Disabled"
    http2_enabled            = true
    minimum_tls_version      = "1.2"
    remote_debugging_enabled = false
    use_32_bit_worker        = false
    websockets_enabled       = false

    # Python configuration
    application_stack {
      python_version = "3.11"
    }
  }

  # Managed Identity
  identity {
    type = "SystemAssigned"
  }

  # Application settings
  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"              = "python"
    "AI_FOUNDRY_ENDPOINT"                   = var.foundry_ai_foundry_endpoint
    "AI_FOUNDRY_PROJECT_NAME"               = var.foundry_ai_foundry_project_name
    "AI_FOUNDRY_PROJECT_ID"                 = var.foundry_ai_foundry_project_id
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = data.azurerm_application_insights.this.connection_string
    "AzureWebJobsStorage__accountName"      = azurerm_storage_account.function.name
    "AzureWebJobsStorage__credential"       = "managedidentity"
  }

  tags = var.tags

  depends_on = [
    azurerm_storage_account.function,
    azurerm_service_plan.function
  ]
}

# Role Assignment: Function App -> AI Foundry User
resource "azurerm_role_assignment" "function_ai_foundry_user" {
  scope                = var.foundry_ai_foundry_id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id

  depends_on = [azurerm_linux_function_app.main]
}

# Diagnostic Settings for Function App
resource "azurerm_monitor_diagnostic_setting" "function" {
  name                       = "${local.function_app_name}-diagnostics"
  target_resource_id         = azurerm_linux_function_app.main.id
  log_analytics_workspace_id = var.foundry_log_analytics_workspace_id

  enabled_log {
    category = "FunctionAppLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }

  depends_on = [azurerm_linux_function_app.main]
}
