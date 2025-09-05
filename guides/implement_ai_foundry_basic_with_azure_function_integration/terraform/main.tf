# main.tf - AI Foundry Basic with Azure Function Integration

# Data source for current Azure configuration
data "azurerm_client_config" "current" {}

# Random suffix for unique naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags
}

# Storage Account for AI Hub
resource "azurerm_storage_account" "ai_hub" {
  name                     = local.storage_account_name
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  tags = local.tags
}

# Key Vault for AI Hub
resource "azurerm_key_vault" "ai_hub" {
  name                       = local.key_vault_name
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = false
  soft_delete_retention_days = 7

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge", "Recover"
    ]

    key_permissions = [
      "Get", "List", "Create", "Delete", "Purge", "Recover"
    ]
  }

  tags = local.tags
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = local.app_insights_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"

  tags = local.tags
}

# AI Hub (Machine Learning Workspace)
resource "azurerm_machine_learning_workspace" "ai_hub" {
  name                          = local.ai_hub_name
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  application_insights_id       = azurerm_application_insights.main.id
  key_vault_id                  = azurerm_key_vault.ai_hub.id
  storage_account_id            = azurerm_storage_account.ai_hub.id
  kind                          = "Hub"
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags
}

# AI Project (connected to Hub)
resource "azurerm_machine_learning_workspace" "ai_project" {
  name                          = local.ai_project_name
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  application_insights_id       = azurerm_application_insights.main.id
  key_vault_id                  = azurerm_key_vault.ai_hub.id
  storage_account_id            = azurerm_storage_account.ai_hub.id
  kind                          = "Project"
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags

  depends_on = [azurerm_machine_learning_workspace.ai_hub]
}

# ========================================
# AZURE FUNCTION INTEGRATION ADDITIONS
# ========================================

# Storage Account for Function App
resource "azurerm_storage_account" "function_app" {
  name                     = "stfunc${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = local.tags
}

# App Service Plan for Function App
resource "azurerm_service_plan" "main" {
  name                = local.app_service_plan_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.function_app_sku # Y1 for consumption, EP1 for premium

  tags = local.tags
}

# Function App with System-Assigned Managed Identity
resource "azurerm_linux_function_app" "main" {
  name                = local.function_app_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
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
      allowed_origins = ["*"]
    }

    application_insights_connection_string = azurerm_application_insights.main.connection_string
    application_insights_key               = azurerm_application_insights.main.instrumentation_key

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
    "AI_HUB_NAME"        = azurerm_machine_learning_workspace.ai_hub.name
    "AI_PROJECT_NAME"    = azurerm_machine_learning_workspace.ai_project.name
    "AI_RESOURCE_GROUP"  = azurerm_resource_group.main.name
    "AI_SUBSCRIPTION_ID" = data.azurerm_client_config.current.subscription_id
    "AI_HUB_ENDPOINT"    = azurerm_machine_learning_workspace.ai_hub.discovery_url

    # Enable managed identity for authentication
    "AZURE_CLIENT_ID" = azurerm_linux_function_app.main.identity[0].principal_id
  }

  tags = local.tags
}

# ========================================
# ROLE ASSIGNMENTS FOR FUNCTION APP
# ========================================

# Contributor role on AI Hub for Function App
resource "azurerm_role_assignment" "function_ai_hub_contributor" {
  scope                = azurerm_machine_learning_workspace.ai_hub.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}

# Contributor role on AI Project for Function App
resource "azurerm_role_assignment" "function_ai_project_contributor" {
  scope                = azurerm_machine_learning_workspace.ai_project.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}

# Key Vault access for Function App
resource "azurerm_key_vault_access_policy" "function_app" {
  key_vault_id = azurerm_key_vault.ai_hub.id
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
  scope                = azurerm_storage_account.ai_hub.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
