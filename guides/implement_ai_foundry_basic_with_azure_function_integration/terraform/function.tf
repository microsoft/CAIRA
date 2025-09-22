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
  min_tls_version          = "TLS1_2"

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }

  tags = var.tags
}

# App Service Plan for Function App
resource "azurerm_service_plan" "function" {
  name                = module.naming.app_service_plan.name_unique
  resource_group_name = local.resource_group_name
  location            = local.location
  os_type             = "Linux"
  sku_name            = var.function_sku_size

  tags = var.tags
}

# Linux Function App with Python runtime
resource "azurerm_linux_function_app" "this" {
  name                = local.function_app_name
  resource_group_name = local.resource_group_name
  location            = local.location
  service_plan_id     = azurerm_service_plan.function.id

  storage_account_name       = azurerm_storage_account.function.name
  storage_account_access_key = azurerm_storage_account.function.primary_access_key

  site_config {
    always_on                              = var.function_tier != "Dynamic"
    application_insights_connection_string = data.azurerm_application_insights.this.connection_string
    application_insights_key               = data.azurerm_application_insights.this.instrumentation_key

    application_stack {
      python_version = var.python_version
    }

    cors {
      allowed_origins = ["https://portal.azure.com"]
    }

    # Enhanced security settings
    ftps_state             = "Disabled"
    http2_enabled          = true
    minimum_tls_version    = "1.2"
    use_32_bit_worker      = false
    vnet_route_all_enabled = var.enable_vnet_integration
    websockets_enabled     = false
  }

  app_settings = {
    # Function runtime settings
    "FUNCTIONS_WORKER_RUNTIME"       = "python"
    "FUNCTIONS_EXTENSION_VERSION"    = "~4"
    "WEBSITE_RUN_FROM_PACKAGE"       = "1"
    "WEBSITE_MOUNT_ENABLED"          = "1"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"

    # Python specific settings
    "PYTHON_ENABLE_WORKER_EXTENSIONS"    = "1"
    "PYTHON_ISOLATE_WORKER_DEPENDENCIES" = "1"

    # AI Foundry connection settings
    "AZURE_AI_FOUNDRY_ENDPOINT"     = local.ai_foundry_endpoint
    "AZURE_AI_FOUNDRY_KEY"          = local.ai_foundry_key
    "AZURE_AI_FOUNDRY_PROJECT_NAME" = var.foundry_ai_foundry_project_name

    # Monitoring
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = data.azurerm_application_insights.this.connection_string
    "APPINSIGHTS_INSTRUMENTATIONKEY"        = data.azurerm_application_insights.this.instrumentation_key

    # Performance settings
    "WEBSITE_ENABLE_SYNC_UPDATE_SITE" = "true"
    "WEBSITE_USE_PLACEHOLDER"         = var.function_tier == "Dynamic" ? "0" : "1"
  }

  identity {
    type = "SystemAssigned"
  }

  lifecycle {
    ignore_changes = [
      app_settings["WEBSITE_RUN_FROM_PACKAGE"],
    ]
  }

  tags = var.tags
}

# Role Assignment: Function App -> AI Foundry Contributor
resource "azurerm_role_assignment" "function_ai_foundry_contributor" {
  scope                = var.foundry_ai_foundry_id
  role_definition_name = "Cognitive Services Contributor"
  principal_id         = azurerm_linux_function_app.this.identity[0].principal_id
}

# Role Assignment: Function App -> AI Foundry User
resource "azurerm_role_assignment" "function_ai_foundry_user" {
  scope                = var.foundry_ai_foundry_id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_function_app.this.identity[0].principal_id
}

# Diagnostic Settings for Function App
resource "azurerm_monitor_diagnostic_setting" "function" {
  name                       = "${local.function_app_name}-diagnostics"
  target_resource_id         = azurerm_linux_function_app.this.id
  log_analytics_workspace_id = var.foundry_log_analytics_workspace_id

  enabled_metric {
    category = "AllMetrics"
  }

  # Function App Logs
  enabled_log {
    category = "FunctionAppLogs"
  }

  lifecycle {
    ignore_changes = [enabled_metric, enabled_log, log_analytics_destination_type]
  }
}
