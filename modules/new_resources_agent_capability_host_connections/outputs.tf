# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "connections" {
  description = "Connections for AI Foundry agents derived from newly created resources."
  value = {
    cosmos_db = {
      resource_id         = azurerm_cosmosdb_account.cosmosdb.id
      resource_group_name = local.resource_group_name
      name                = azurerm_cosmosdb_account.cosmosdb.name
      endpoint            = azurerm_cosmosdb_account.cosmosdb.endpoint
      location            = azurerm_cosmosdb_account.cosmosdb.location
    }
    ai_search = {
      resource_id = azapi_resource.ai_search.id
      name        = azapi_resource.ai_search.name
      location    = var.location
    }
    storage_account = {
      resource_id           = azurerm_storage_account.storage_account.id
      name                  = azurerm_storage_account.storage_account.name
      primary_blob_endpoint = azurerm_storage_account.storage_account.primary_blob_endpoint
      location              = azurerm_storage_account.storage_account.location
    }
  }
}
