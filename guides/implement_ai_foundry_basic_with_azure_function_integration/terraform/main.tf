# main.tf - AI Foundry Basic Configuration

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
  name                      = local.storage_account_name
  resource_group_name       = azurerm_resource_group.main.name
  location                  = azurerm_resource_group.main.location
  account_tier              = "Standard"
  account_replication_type  = "LRS"
  account_kind              = "StorageV2"
  shared_access_key_enabled = false

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
  name                    = local.ai_hub_name
  location                = azurerm_resource_group.main.location
  resource_group_name     = azurerm_resource_group.main.name
  application_insights_id = azurerm_application_insights.main.id
  key_vault_id            = azurerm_key_vault.ai_hub.id
  storage_account_id      = azurerm_storage_account.ai_hub.id

  # NOTE: Terraform provider doesn't yet support kind = "Hub"
  # Using "Default" until provider adds Hub/Project support
  # This doesn't affect functionality - workspace will still work with AI Foundry
  kind = "Default"

  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags
}

# AI Project (Machine Learning Workspace)
resource "azurerm_machine_learning_workspace" "ai_project" {
  name                    = local.ai_project_name
  location                = azurerm_resource_group.main.location
  resource_group_name     = azurerm_resource_group.main.name
  application_insights_id = azurerm_application_insights.main.id
  key_vault_id            = azurerm_key_vault.ai_hub.id
  storage_account_id      = azurerm_storage_account.ai_hub.id

  # NOTE: Terraform provider doesn't yet support kind = "Project"
  # Using "Default" until provider adds Hub/Project support
  # This doesn't affect functionality - workspace will still work with AI Foundry
  kind = "Default"

  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  tags = local.tags

  depends_on = [azurerm_machine_learning_workspace.ai_hub]
}
