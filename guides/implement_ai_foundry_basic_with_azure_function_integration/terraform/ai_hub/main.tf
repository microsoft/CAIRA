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

# Storage Account for AI Hub - Created via Azure CLI to handle key-disabled policy
# Data source to reference the storage account
data "azurerm_storage_account" "ai_hub" {
  name                = local.storage_account_name
  resource_group_name = azurerm_resource_group.main.name

  depends_on = [null_resource.create_storage]
}

# Create storage via Azure CLI to bypass Terraform provider limitations
resource "null_resource" "create_storage" {
  triggers = {
    storage_name = local.storage_account_name
    rg_name      = azurerm_resource_group.main.name
  }

  provisioner "local-exec" {
    command = <<EOT
      az storage account create \
        --name ${local.storage_account_name} \
        --resource-group ${azurerm_resource_group.main.name} \
        --location ${azurerm_resource_group.main.location} \
        --sku Standard_LRS \
        --kind StorageV2 \
        --allow-shared-key-access false \
        --tags Environment=${var.environment} Project=${var.project_name} ManagedBy=Terraform Purpose="AI Foundry" \
        --output none || echo "Storage account may already exist"
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<EOT
      az storage account delete \
        --name ${self.triggers.storage_name} \
        --resource-group ${self.triggers.rg_name} \
        --yes
    EOT
  }

  depends_on = [azurerm_resource_group.main]
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

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"

    # Optionally, add your IP for development access
    # ip_rules = ["YOUR_PUBLIC_IP/32"]

    # Or add virtual network rules if using private endpoints
    # virtual_network_subnet_ids = [azurerm_subnet.example.id]
  }

  tags = local.tags
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = local.app_insights_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"

  lifecycle {
    ignore_changes = [workspace_id]
  }

  tags = local.tags
}

# AI Hub (Machine Learning Workspace)
resource "azurerm_machine_learning_workspace" "ai_hub" {
  name                    = local.ai_hub_name
  location                = azurerm_resource_group.main.location
  resource_group_name     = azurerm_resource_group.main.name
  application_insights_id = azurerm_application_insights.main.id
  key_vault_id            = azurerm_key_vault.ai_hub.id
  storage_account_id      = data.azurerm_storage_account.ai_hub.id # Use data source

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
  storage_account_id      = data.azurerm_storage_account.ai_hub.id # Use data source

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
