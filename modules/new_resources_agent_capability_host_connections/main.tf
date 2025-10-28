# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

locals {
  resource_group_name = provider::azapi::parse_resource_id("Microsoft.Resources/resourceGroups", var.resource_group_resource_id).resource_group_name
}

# Cosmos DB Account
resource "azurerm_cosmosdb_account" "cosmosdb" {
  name                = var.cosmos_db_account_name
  location            = var.location
  resource_group_name = local.resource_group_name
  tags                = var.tags

  offer_type        = "Standard"
  kind              = "GlobalDocumentDB"
  free_tier_enabled = false

  local_authentication_disabled = true
  public_network_access_enabled = true

  automatic_failover_enabled       = false
  multiple_write_locations_enabled = false

  network_acl_bypass_for_azure_services = true

  ip_range_filter = [
    "0.0.0.0",
    "13.91.105.215", "4.210.172.107", "13.88.56.148", "40.91.218.243"
  ]

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.location
    failover_priority = 0
    zone_redundant    = false
  }

  capabilities {
    name = "EnableServerless"
  }
}

# Storage Account
locals {
  storage_account_replication_type = var.location == "westus" || var.location == "southindia" ? "GRS" : "ZRS"
}
resource "azurerm_storage_account" "storage_account" {
  name                = var.storage_account_name
  resource_group_name = local.resource_group_name
  location            = var.location
  tags                = var.tags

  account_kind             = "StorageV2"
  account_tier             = "Standard"
  account_replication_type = local.storage_account_replication_type

  shared_access_key_enabled = false

  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  network_rules {
    #trivy:ignore:AVD-AZU-0012
    default_action = "Allow"
    bypass = [
      "AzureServices"
    ]
  }
}

# AI Search
resource "azapi_resource" "ai_search" {
  type                      = "Microsoft.Search/searchServices@2025-05-01"
  name                      = var.ai_search_name
  parent_id                 = var.resource_group_resource_id
  location                  = var.location
  schema_validation_enabled = true

  body = {
    sku = {
      name = "basic"
    }

    identity = {
      type = "SystemAssigned"
    }

    properties = {
      replicaCount   = 1
      partitionCount = 1
      hostingMode    = "default"
      semanticSearch = "disabled"

      disableLocalAuth = true

      encryptionWithCmk = {
        enforcement = "Unspecified"
      }
      publicNetworkAccess = "Enabled"
    }
  }
}
