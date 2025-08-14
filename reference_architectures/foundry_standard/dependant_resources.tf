# This file contains the dependent resources for the Foundry Standard configuration.
# While, these resources are created using sensitive defaults, they should be either
# customized to your needs or replaced with data sources to existing resources.

# Cosmos DB Account
resource "azurerm_cosmosdb_account" "cosmosdb" {
  name                = module.naming.cosmosdb_account.name_unique
  location            = var.location
  resource_group_name = local.resource_group_name
  tags                = var.tags

  # General settings
  offer_type        = "Standard"
  kind              = "GlobalDocumentDB"
  free_tier_enabled = false

  # Set security-related settings
  local_authentication_disabled = true
  public_network_access_enabled = true

  # Set high availability and failover settings
  automatic_failover_enabled       = false
  multiple_write_locations_enabled = false

  network_acl_bypass_for_azure_services = true


  ip_range_filter = [
    "0.0.0.0",                                                        #Accept connections from within public Azure datacenters. https://learn.microsoft.com/azure/cosmos-db/how-to-configure-firewall#allow-requests-from-the-azure-portal
    "13.91.105.215", "4.210.172.107", "13.88.56.148", "40.91.218.243" #Allow access from the Azure portal. https://learn.microsoft.com/azure/cosmos-db/how-to-configure-firewall#allow-requests-from-global-azure-datacenters-or-other-sources-within-azure
  ]

  # Configure consistency settings
  consistency_policy {
    consistency_level = "Session"
  }

  # Configure single location with no zone redundancy to reduce costs
  geo_location {
    location          = var.location
    failover_priority = 0
    zone_redundant    = false
  }
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "this" {
  location            = var.location
  name                = module.naming.log_analytics_workspace.name_unique
  resource_group_name = local.resource_group_name
  retention_in_days   = 30
  sku                 = "PerGB2018"
  tags                = var.tags
}

# Application Insights
module "application_insights" {
  source  = "Azure/avm-res-insights-component/azurerm"
  version = "0.2.0"

  location            = var.location
  name                = module.naming.application_insights.name_unique
  resource_group_name = local.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.this.id
  enable_telemetry    = var.enable_telemetry
  application_type    = "other"
  tags                = var.tags
}

# Storage Account

locals {
  storage_account_replication_type = var.location == "westus" || var.location == "southindia" ? "GRS" : "ZRS"
}
resource "azurerm_storage_account" "storage_account" {
  name                = module.naming.storage_account.name_unique
  resource_group_name = local.resource_group_name
  location            = var.location
  tags                = var.tags

  account_kind             = "StorageV2"
  account_tier             = "Standard"
  account_replication_type = local.storage_account_replication_type

  ## Identity configuration
  shared_access_key_enabled = false

  ## Network access configuration
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  network_rules {
    #trivy:ignore:AVD-AZU-0012
    default_action = "Allow" # In a production scenario, consider setting this to "Deny" and configuring specific virtual network rules.
    bypass = [
      "AzureServices"
    ]
  }

}

# AI Search
resource "azapi_resource" "ai_search" {
  type                      = "Microsoft.Search/searchServices@2025-05-01"
  name                      = module.naming.search_service.name_unique
  parent_id                 = local.resource_group_resource_id
  location                  = var.location
  schema_validation_enabled = true

  body = {
    sku = {
      name = "standard"
    }

    identity = {
      type = "SystemAssigned"
    }

    properties = {

      # Search-specific properties
      replicaCount   = 1
      partitionCount = 1
      hostingMode    = "default"
      semanticSearch = "disabled"

      # Identity-related controls
      disableLocalAuth = false
      authOptions = {
        aadOrApiKey = {
          aadAuthFailureMode = "http401WithBearerChallenge"
        }
      }
      encryptionWithCmk = {
        enforcement = "Unspecified"
      }
      # Networking-related controls
      publicNetworkAccess = "Enabled"
    }
  }
}
