locals {
  resource_group_name = provider::azapi::parse_resource_id("Microsoft.Resources/resourceGroups", var.resource_group_resource_id).resource_group_name
}

## Existing resources lookups

# Cosmos DB Account (existing)
data "azurerm_cosmosdb_account" "cosmosdb" {
  name                = var.cosmosdb_account_name
  resource_group_name = local.resource_group_name
}

# Storage Account (existing)
data "azurerm_storage_account" "storage_account" {
  name                = var.storage_account_name
  resource_group_name = local.resource_group_name
}

# AI Search (existing)
data "azapi_resource" "ai_search" {
  type      = "Microsoft.Search/searchServices@2025-05-01"
  name      = var.search_service_name
  parent_id = var.resource_group_resource_id
}
