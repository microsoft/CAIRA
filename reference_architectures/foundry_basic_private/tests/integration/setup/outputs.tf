# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "connection" {
  value       = azurerm_subnet.connection
  description = "The subnet used for the connection"
}

output "resource_group_name" {
  value       = azurerm_resource_group.this.name
  description = "The name of the resource group containing the networking resources"
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
