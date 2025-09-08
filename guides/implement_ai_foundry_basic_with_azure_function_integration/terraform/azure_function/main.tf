# main.tf - Azure Function Configuration

# Data source for current Azure configuration
data "azurerm_client_config" "current" {}

# Data source to get existing resource group from AI Hub deployment
data "azurerm_resource_group" "main" {
  name = var.ai_hub_resource_group
}

# Data source to get existing AI Hub
data "azurerm_machine_learning_workspace" "ai_hub" {
  name                = var.ai_hub_name
  resource_group_name = var.ai_hub_resource_group
}

# Data source to get existing AI Project
data "azurerm_machine_learning_workspace" "ai_project" {
  name                = var.ai_project_name
  resource_group_name = var.ai_hub_resource_group
}

# Data source to get existing Key Vault
data "azurerm_key_vault" "ai_hub" {
  name                = var.key_vault_name
  resource_group_name = var.ai_hub_resource_group
}

# Data source to get existing Application Insights
data "azurerm_application_insights" "main" {
  name                = var.application_insights_name
  resource_group_name = var.ai_hub_resource_group
}

# Data source to get existing AI Hub Storage Account
data "azurerm_storage_account" "ai_hub" {
  name                = var.ai_hub_storage_account_name
  resource_group_name = var.ai_hub_resource_group
}

# Random suffix for unique naming (or use provided suffix from AI Hub)
resource "random_string" "suffix" {
  count   = var.use_existing_suffix ? 0 : 1
  length  = 8
  special = false
  upper   = false
}

# Storage Account for Function App
resource "azurerm_storage_account" "function_app" {
  name                     = local.function_storage_account_name
  resource_group_name      = data.azurerm_resource_group.main.name
  location                 = data.azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  # NOTE: Function Apps require storage keys to be enabled
  # You may need to adjust your Azure Policy or use an exemption for this storage account
  shared_access_key_enabled = true

  tags = local.tags
}

# App Service Plan for Function App
resource "azurerm_service_plan" "main" {
  name                = local.app_service_plan_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.function_app_sku

  tags = local.tags
}

# Function App with System-Assigned Managed Identity
resource "azurerm_linux_function_app" "main" {
  name                = local.function_app_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  storage_account_name       = azurerm_storage_account.function_app.name
  storage_account_access_key = azurerm_storage_account.function_app.primary_access_key

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      python_version = "3.11"
    }

    cors {
      allowed_origins = var.cors_allowed_origins
    }

    application_insights_connection_string = data.azurerm_application_insights.main.connection_string
    application_insights_key               = data.azurerm_application_insights.main.instrumentation_key

    # IP restrictions if specified
    dynamic "ip_restriction" {
      for_each = local.ip_restrictions
      content {
        name                      = ip_restriction.value.name
        ip_address                = ip_restriction.value.ip_address
        virtual_network_subnet_id = ip_restriction.value.virtual_network_subnet_id
        service_tag               = ip_restriction.value.service_tag
        priority                  = ip_restriction.value.priority
        action                    = ip_restriction.value.action
      }
    }
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME" = "python"
    "AzureWebJobsFeatureFlags" = "EnableWorkerIndexing"

    # AI Foundry Configuration
    "AI_HUB_NAME"        = data.azurerm_machine_learning_workspace.ai_hub.name
    "AI_PROJECT_NAME"    = data.azurerm_machine_learning_workspace.ai_project.name
    "AI_RESOURCE_GROUP"  = data.azurerm_resource_group.main.name
    "AI_SUBSCRIPTION_ID" = data.azurerm_client_config.current.subscription_id
    "AI_HUB_ENDPOINT"    = data.azurerm_machine_learning_workspace.ai_hub.discovery_url
  }

  tags = local.tags
}

# ========================================
# ROLE ASSIGNMENTS FOR FUNCTION APP
# ========================================

# Contributor role on AI Hub for Function App
resource "azurerm_role_assignment" "function_ai_hub_contributor" {
  scope                = data.azurerm_machine_learning_workspace.ai_hub.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}

# Contributor role on AI Project for Function App
resource "azurerm_role_assignment" "function_ai_project_contributor" {
  scope                = data.azurerm_machine_learning_workspace.ai_project.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}

# Key Vault access for Function App
resource "azurerm_key_vault_access_policy" "function_app" {
  key_vault_id = data.azurerm_key_vault.ai_hub.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_function_app.main.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]

  key_permissions = [
    "Get",
    "List"
  ]
}

# Storage Blob Data Contributor for Function App on AI Hub storage
resource "azurerm_role_assignment" "function_storage_contributor" {
  scope                = data.azurerm_storage_account.ai_hub.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
