# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "connections" {
  description = "Connections for AI Foundry agents derived from existing resources."
  value = {
    cosmos_db = {
      resource_id         = data.azurerm_cosmosdb_account.cosmosdb.id
      resource_group_name = local.resource_group_name
      name                = data.azurerm_cosmosdb_account.cosmosdb.name
      endpoint            = data.azurerm_cosmosdb_account.cosmosdb.endpoint
      location            = data.azurerm_cosmosdb_account.cosmosdb.location
    }
    ai_search = {
      resource_id = data.azapi_resource.ai_search.id
      name        = var.search_service_name
      location    = var.location
    }
    storage_account = {
      resource_id           = data.azurerm_storage_account.storage_account.id
      name                  = data.azurerm_storage_account.storage_account.name
      primary_blob_endpoint = data.azurerm_storage_account.storage_account.primary_blob_endpoint
      location              = data.azurerm_storage_account.storage_account.location
    }

    create_required_role_assignments = var.create_required_role_assignments
  }
}
