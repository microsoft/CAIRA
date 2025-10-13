# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

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
      # Only support Entra ID authentication for Cognitive Services account
      disableLocalAuth = true

      # Specifies that this is an AI Foundry resource
      allowProjectManagement = true

      # Set subdomain name
      customSubDomainName = var.ai_foundry_name

      # Network access configuration
      publicNetworkAccess = var.foundry_subnet_id != null ? "Disabled" : "Enabled"
      networkAcls = var.foundry_subnet_id != null ? {
        # Keep defaultAction Allow to support Trusted Azure Services style allow-listing while PNA is Disabled
        defaultAction = "Allow"
      } : null

      # VNet injection for Standard Agents when subnet and agent capability host connections are provided
      networkInjections = var.agents_subnet_id != null && var.agent_capability_host_connections != null ? [
        {
          scenario                   = "agent"
          subnetArmId                = var.agents_subnet_id
          useMicrosoftManagedNetwork = false
        }
      ] : null
    }
  }

  depends_on = [time_sleep.wait_before_purge]
}

locals {
  resource_group_name = provider::azapi::parse_resource_id("Microsoft.Resources/resourceGroups", var.resource_group_id).resource_group_name
}

## Optional timed delay after deletion before purge to avoid 404 (soft-delete not yet visible)
resource "time_sleep" "wait_before_purge" {
  destroy_duration = "60s"

  depends_on = [azapi_resource_action.purge_ai_foundry]
}

## Purge soft-deleted Cognitive account AFTER account deletion (and optional delay).
## By having the module depend on this action, Terraform will destroy the module (account) first, then issue the purge.
resource "azapi_resource_action" "purge_ai_foundry" {
  method      = "DELETE"
  resource_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/providers/Microsoft.CognitiveServices/locations/${var.location}/resourceGroups/${local.resource_group_name}/deletedAccounts/${var.ai_foundry_name}"
  type        = "Microsoft.Resources/resourceGroups/deletedAccounts@2021-04-30"
  when        = "destroy"
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
    azapi_resource.ai_foundry_project_capability_host
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
  depends_on = [
    azapi_resource.ai_foundry,
    azurerm_private_endpoint.ai_foundry_pe
  ]

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
