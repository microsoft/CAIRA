locals {
  resource_group_id = provider::azapi::parse_resource_id("Microsoft.CognitiveServices/accounts", var.ai_foundry_id).parent_id
}

resource "azapi_resource" "ai_foundry_project" {
  type                      = "Microsoft.CognitiveServices/accounts/projects@2025-06-01"
  name                      = var.project_name
  parent_id                 = var.ai_foundry_id
  location                  = var.location
  schema_validation_enabled = false
  tags                      = var.tags

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

