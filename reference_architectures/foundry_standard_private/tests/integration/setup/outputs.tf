# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "connection" {
  value       = azurerm_subnet.connection
  description = "The subnet used for the connection"
}

output "agent" {
  value       = azurerm_subnet.agent
  description = "The subnet used for the agent"
}

output "resource_group_name" {
  value       = azurerm_resource_group.this.name
  description = "The name of the resource group containing the test infrastructure"
}

output "resource_group_id" {
  value       = azurerm_resource_group.this.id
  description = "The ID of the resource group containing the test infrastructure"
}

output "virtual_network_id" {
  value       = azurerm_virtual_network.this.id
  description = "The ID of the virtual network"
}

output "private_dns_zones" {
  value = {
    cognitive   = azurerm_private_dns_zone.cognitive.name
    ai_services = azurerm_private_dns_zone.ai_services.name
    openai      = azurerm_private_dns_zone.openai.name
  }
  description = "The private DNS zones created for private endpoints"
}

output "cosmosdb_account_name" {
  value       = azurerm_cosmosdb_account.this.name
  description = "The name of the Cosmos DB account for capability host testing"
}

output "storage_account_name" {
  value       = azurerm_storage_account.this.name
  description = "The name of the Storage Account for capability host testing"
}

output "search_service_name" {
  value       = azurerm_search_service.this.name
  description = "The name of the AI Search service for capability host testing"
}
