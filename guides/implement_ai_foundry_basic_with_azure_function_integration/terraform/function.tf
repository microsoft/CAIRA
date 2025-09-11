# function.tf - Azure Function App Resources, adds serverless compute to AI Foundry

# Random suffix for unique naming
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Create storage account using Azure CLI to bypass policy restrictions
resource "null_resource" "create_storage_account" {
  provisioner "local-exec" {
    command = <<-EOT
      az storage account create \
        --name st${replace(local.base_name, "-", "")}${random_string.suffix.result} \
        --resource-group ${local.resource_group_name} \
        --location ${var.location} \
        --sku Standard_LRS \
        --kind StorageV2 \
        --min-tls-version TLS1_2 \
        --allow-shared-key-access true \
        --allow-blob-public-access false \
        --output none
    EOT
  }

  # Ensure this runs after the resource group is created
  depends_on = [module.foundry_basic]

  # Trigger recreation if the storage account name changes
  triggers = {
    storage_account_name = "st${replace(local.base_name, "-", "")}${random_string.suffix.result}"
  }
}

# Data source to reference the storage account created by CLI
data "azurerm_storage_account" "function" {
  name                = "st${replace(local.base_name, "-", "")}${random_string.suffix.result}"
  resource_group_name = local.resource_group_name

  depends_on = [null_resource.create_storage_account]
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
  storage_account_name       = data.azurerm_storage_account.function.name
  storage_account_access_key = data.azurerm_storage_account.function.primary_access_key

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"    = "python"
    "FUNCTIONS_EXTENSION_VERSION" = "~4"
    "AI_FOUNDRY_PROJECT_ID"       = module.foundry_basic.ai_foundry_project_id
    "AI_FOUNDRY_PROJECT_NAME"     = module.foundry_basic.ai_foundry_project_name
    "AI_FOUNDRY_NAME"             = module.foundry_basic.ai_foundry_name
    "RESOURCE_GROUP_NAME"         = local.resource_group_name
    "AZURE_SUBSCRIPTION_ID"       = data.azurerm_client_config.current.subscription_id
  }

  site_config {
    application_stack {
      python_version = "3.11"
    }

    cors {
      allowed_origins = ["https://portal.azure.com"]
    }
  }

  tags = var.tags

  depends_on = [null_resource.create_storage_account]
}

# Get current subscription for configuration
data "azurerm_client_config" "current" {}

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
