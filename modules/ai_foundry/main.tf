# AI Foundry Resource Configuration

resource "azapi_resource" "ai_foundry" {
  type                      = "Microsoft.CognitiveServices/accounts@2025-06-01"
  name                      = var.ai_foundry_name
  parent_id                 = var.resource_group_id
  location                  = var.location
  schema_validation_enabled = false
  tags                      = var.tags

  body = {
    kind = "AIServices"
    sku = {
      name = var.sku
    }
    identity = {
      type = "SystemAssigned" # For now, only supporting SystemAssigned identity
    }

    properties = {
      # Support both Entra ID and API Key authentication for Cognitive Services account
      disableLocalAuth = false


      # Specifies that this is an AI Foundry resourceyes
      allowProjectManagement = true

      # Set subdomain name
      customSubDomainName = var.ai_foundry_name
    }
  }
}


## For each configured model, create a deployment
locals {
  model_deployments = {
    for model in var.model_deployments : model.name => model
  }
}

resource "azurerm_cognitive_deployment" "model_deployments" {
  for_each = local.model_deployments

  depends_on = [
    azapi_resource.ai_foundry
  ]

  name                 = each.value.name
  cognitive_account_id = azapi_resource.ai_foundry.id

  sku {
    name     = each.value.sku.name
    capacity = each.value.sku.capacity
  }

  model {
    format  = each.value.format
    name    = each.value.name
    version = each.value.version
  }
}

## Create AI Foundry project
##
resource "azapi_resource" "ai_foundry_project" {
  type                      = "Microsoft.CognitiveServices/accounts/projects@2025-06-01"
  name                      = var.project_name
  parent_id                 = azapi_resource.ai_foundry.id
  location                  = var.location
  schema_validation_enabled = false

  body = {
    sku = {
      name = var.sku
    }
    identity = {
      type = "SystemAssigned"
    }

    properties = {
      displayName = var.project_display_name
      description = var.project_description
    }
  }

  response_export_values = [
    "identity.principalId",
    "properties.internalId"
  ]
}

## Wait 10 seconds for the AI Foundry project system-assigned managed identity to be created
resource "time_sleep" "wait_project_identities" {
  depends_on = [
    azapi_resource.ai_foundry_project
  ]
  create_duration = "10s"
}
