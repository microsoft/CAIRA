# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Private Endpoints Environment
#
# Provisions:
# - Resource Group
# - Virtual Network with a "connections" subnet
# - Storage Account (Blob)
# - Cosmos DB Account (SQL API)
# - Azure AI Search service
# - Private DNS Zones for each service
# - Private Endpoints for each service into the connections subnet
#
# All services have public network access disabled and are reachable
# only via their Private Endpoints within the VNet.
############################################################

# Consistent naming across resources
module "naming" {
  source        = "Azure/naming/azurerm"
  version       = "0.4.2"
  suffix        = [var.base_name]
  unique-length = 5
}

# Resource Group
resource "azurerm_resource_group" "this" {
  name     = module.naming.resource_group.name_unique
  location = var.location
  tags     = var.tags
}
# Networking - VNet and Subnet for Private Endpoints
resource "azurerm_virtual_network" "this" {
  name                = module.naming.virtual_network.name_unique
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  address_space       = [var.address_space]
  tags                = var.tags
}

resource "azurerm_subnet" "agent" {
  name                 = "agent"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = ["172.16.2.0/24"]
  # Required to allow Private Endpoints in the subnet
  private_endpoint_network_policies = "Disabled"

  delegation {
    name = "Microsoft.App/environments"
    service_delegation {
      name = "Microsoft.App/environments"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action"
      ]
    }
  }
}

resource "azurerm_subnet" "connections" {
  name                 = "connections"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.connections_subnet_prefix]
  # Required to allow Private Endpoints in the subnet
  private_endpoint_network_policies = "Disabled"
}

############################################################
# Core Services with Public Access Disabled
############################################################

# Storage Account (Blob)
resource "azurerm_storage_account" "blob" {
  name                              = module.naming.storage_account.name_unique
  resource_group_name               = azurerm_resource_group.this.name
  location                          = azurerm_resource_group.this.location
  tags                              = var.tags
  account_kind                      = "StorageV2"
  account_tier                      = "Standard"
  account_replication_type          = var.storage_replication_type
  min_tls_version                   = "TLS1_2"
  shared_access_key_enabled         = false
  public_network_access_enabled     = false
  https_traffic_only_enabled        = true
  infrastructure_encryption_enabled = false
  allow_nested_items_to_be_public   = false
  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    ip_rules                   = []
    virtual_network_subnet_ids = []
  }
}

# Cosmos DB Account (SQL API)
resource "azurerm_cosmosdb_account" "cosmos" {
  name                = module.naming.cosmosdb_account.name_unique
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  tags                = var.tags

  kind              = "GlobalDocumentDB"
  offer_type        = "Standard"
  free_tier_enabled = false

  # Security
  local_authentication_disabled = true
  public_network_access_enabled = false

  # Behavior
  automatic_failover_enabled       = false
  multiple_write_locations_enabled = false

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.this.location
    failover_priority = 0
    zone_redundant    = false
  }
}

# Azure AI Search (via AzAPI to use latest API surface)
resource "azapi_resource" "search" {
  type                      = "Microsoft.Search/searchServices@2025-05-01"
  name                      = module.naming.search_service.name_unique
  parent_id                 = azurerm_resource_group.this.id
  location                  = azurerm_resource_group.this.location
  schema_validation_enabled = true

  body = {
    sku      = { name = var.search_sku }
    identity = { type = "SystemAssigned" }
    properties = {
      replicaCount        = 1
      partitionCount      = 1
      hostingMode         = "default"
      semanticSearch      = "disabled"
      disableLocalAuth    = true
      publicNetworkAccess = "Disabled"
    }
  }
}

############################################################
# Private DNS Zones + VNet Links
############################################################

# Private DNS Zone for Cognitive Services, AI Services and OpenAI
resource "azurerm_private_dns_zone" "cognitive" {
  name                = "privatelink.cognitiveservices.azure.com"
  resource_group_name = azurerm_resource_group.this.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "cognitive" {
  name                  = "${module.naming.private_dns_zone.name_unique}-cognitive-link"
  resource_group_name   = azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.cognitive.name
  virtual_network_id    = azurerm_virtual_network.this.id
}

resource "azurerm_private_dns_zone" "ai_services" {
  name                = "privatelink.services.ai.azure.com"
  resource_group_name = azurerm_resource_group.this.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "ai_services" {
  name                  = "${module.naming.private_dns_zone.name_unique}-ai-services-link"
  resource_group_name   = azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.ai_services.name
  virtual_network_id    = azurerm_virtual_network.this.id
}

resource "azurerm_private_dns_zone" "openai" {
  name                = "privatelink.openai.azure.com"
  resource_group_name = azurerm_resource_group.this.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "openai" {
  name                  = "${module.naming.private_dns_zone.name_unique}-openai-link"
  resource_group_name   = azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.openai.name
  virtual_network_id    = azurerm_virtual_network.this.id
}

# Storage Blob private DNS zone
resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.this.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                  = "${module.naming.private_dns_zone.name_unique}-blob-link"
  resource_group_name   = azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.blob.name
  virtual_network_id    = azurerm_virtual_network.this.id
}

# Cosmos DB (SQL) private DNS zone
resource "azurerm_private_dns_zone" "cosmos_sql" {
  name                = "privatelink.documents.azure.com"
  resource_group_name = azurerm_resource_group.this.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "cosmos_sql" {
  name                  = "${module.naming.private_dns_zone.name_unique}-cosmos-sql-link"
  resource_group_name   = azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.cosmos_sql.name
  virtual_network_id    = azurerm_virtual_network.this.id
}

# Azure Cognitive Search private DNS zone
resource "azurerm_private_dns_zone" "search" {
  name                = "privatelink.search.windows.net"
  resource_group_name = azurerm_resource_group.this.name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "search" {
  name                  = "${module.naming.private_dns_zone.name_unique}-search-link"
  resource_group_name   = azurerm_resource_group.this.name
  private_dns_zone_name = azurerm_private_dns_zone.search.name
  virtual_network_id    = azurerm_virtual_network.this.id
}

############################################################
# Private Endpoints (deployed into the "connections" subnet)
############################################################

resource "azurerm_private_endpoint" "sa_blob" {
  name                = "${module.naming.private_endpoint.name_unique}-blob"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  subnet_id           = azurerm_subnet.connections.id
  tags                = var.tags

  private_service_connection {
    name                           = "${module.naming.private_endpoint.name_unique}-blob-psc"
    private_connection_resource_id = azurerm_storage_account.blob.id
    is_manual_connection           = false
    subresource_names              = ["blob"]
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

resource "azurerm_private_endpoint" "cosmos_sql" {
  name                = "${module.naming.private_endpoint.name_unique}-cosmos-sql"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  subnet_id           = azurerm_subnet.connections.id
  tags                = var.tags

  private_service_connection {
    name                           = "${module.naming.private_endpoint.name_unique}-cosmos-sql-psc"
    private_connection_resource_id = azurerm_cosmosdb_account.cosmos.id
    is_manual_connection           = false
    subresource_names              = ["Sql"]
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.cosmos_sql.id]
  }
}

resource "azurerm_private_endpoint" "search" {
  name                = "${module.naming.private_endpoint.name_unique}-search"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  subnet_id           = azurerm_subnet.connections.id
  tags                = var.tags

  private_service_connection {
    name                           = "${module.naming.private_endpoint.name_unique}-search-psc"
    private_connection_resource_id = azapi_resource.search.id
    is_manual_connection           = false
    subresource_names              = ["searchService"]
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.search.id]
  }
}

