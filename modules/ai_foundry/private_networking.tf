###############################################
# Private Networking for AI Foundry
#
# When a subnet is provided (foundry_network_injection_subnet_id),
# create a Private Endpoints for the Cognitive Services, AI Services and OpenAI accounts
# and a corresponding Private DNS Zones linked to the same VNet.
###############################################

locals {
  target_rg_name = provider::azapi::parse_resource_id("Microsoft.Resources/resourceGroups", var.resource_group_id).resource_group_name
  foundry_subnet = var.foundry_subnet_id != null ? provider::azapi::parse_resource_id("Microsoft.Network/virtualNetworks/subnets", var.foundry_subnet_id) : null

  # This assumes the resource group for the private dns zones is the same as the foundry subnet resource group
  private_dns_zone_rg = local.foundry_subnet != null ? local.foundry_subnet.resource_group_name : null
}

data "azurerm_private_dns_zone" "cognitive" {
  count = var.foundry_subnet_id != null ? 1 : 0

  name                = "privatelink.cognitiveservices.azure.com"
  resource_group_name = local.private_dns_zone_rg
}

data "azurerm_private_dns_zone" "ai_services" {
  count = var.foundry_subnet_id != null ? 1 : 0

  name                = "privatelink.services.ai.azure.com"
  resource_group_name = local.private_dns_zone_rg
}

data "azurerm_private_dns_zone" "openai" {
  count = var.foundry_subnet_id != null ? 1 : 0

  name                = "privatelink.openai.azure.com"
  resource_group_name = local.private_dns_zone_rg
}

# Private Endpoint for the AI Foundry Cognitive Services account
resource "azurerm_private_endpoint" "ai_foundry_pe" {
  count = var.foundry_subnet_id != null ? 1 : 0

  name                = "${var.ai_foundry_name}-pe"
  location            = var.location
  resource_group_name = local.target_rg_name
  subnet_id           = var.foundry_subnet_id
  tags                = var.tags

  private_service_connection {
    name                           = "${var.ai_foundry_name}-pe-conn"
    private_connection_resource_id = azapi_resource.ai_foundry.id
    subresource_names              = ["account"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name = "default"
    private_dns_zone_ids = [
      data.azurerm_private_dns_zone.cognitive[0].id,
      data.azurerm_private_dns_zone.ai_services[0].id,
      data.azurerm_private_dns_zone.openai[0].id
    ]
  }

  depends_on = [
    azapi_resource.ai_foundry
  ]
}
