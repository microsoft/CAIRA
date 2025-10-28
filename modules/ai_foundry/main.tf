# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# AI Foundry Resource Configuration

resource "azapi_resource" "ai_foundry" {
  type                      = "Microsoft.CognitiveServices/accounts@2025-06-01"
  name                      = var.name
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
      customSubDomainName = var.name

      # Network access configuration
      publicNetworkAccess = var.foundry_subnet_id != null ? "Disabled" : "Enabled"
      networkAcls = var.foundry_subnet_id != null ? {
        # Keep defaultAction Allow to support Trusted Azure Services style allow-listing while PNA is Disabled
        defaultAction = "Allow"
      } : null

      # VNet injection for Standard Agents when subnet and agent capability host connections are provided
      networkInjections = var.agents_subnet_id != null ? [
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
  resource_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/providers/Microsoft.CognitiveServices/locations/${var.location}/resourceGroups/${local.resource_group_name}/deletedAccounts/${var.name}"
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

# Wait before deleting capability host to ensure dependent resources are properly cleaned up
resource "time_sleep" "wait_before_delete_capability_host" {
  destroy_duration = "60s"

  depends_on = [azapi_resource.ai_foundry_capability_host]
}

resource "azapi_resource" "ai_foundry_capability_host" {
  # Only create account-level capability host if there are connections but no agent subnet is provided
  count = var.agents_subnet_id == null ? 1 : 0

  type                      = "Microsoft.CognitiveServices/accounts/capabilityHosts@2025-04-01-preview"
  name                      = "${azapi_resource.ai_foundry.name}-agents-capability-host"
  parent_id                 = azapi_resource.ai_foundry.id
  schema_validation_enabled = false

  body = {
    properties = {
      capabilityHostKind = "Agents"
    }
  }
}

# Connection to Application Insights
resource "azapi_resource" "appinsights_connection" {
  count = var.application_insights != null ? 1 : 0

  type                      = "Microsoft.CognitiveServices/accounts/connections@2025-06-01"
  name                      = var.application_insights.name
  parent_id                 = azapi_resource.ai_foundry.id
  schema_validation_enabled = false


  body = {
    name = var.application_insights.name
    properties = {
      category      = "AppInsights"
      target        = var.application_insights.resource_id
      authType      = "ApiKey"
      isSharedToAll = true
      credentials = {
        key = var.application_insights.connection_string
      }
      metadata = {
        ApiType    = "Azure"
        ResourceId = var.application_insights.resource_id
      }
    }
  }

  depends_on = [
    azapi_resource.ai_foundry
  ]
}

