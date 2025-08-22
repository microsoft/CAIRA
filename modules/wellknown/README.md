<!-- META
title: Wellknown Module
description: Terraform module for deploying well-known Azure resources including Azure AI Search, Cosmos DB, storage accounts, and private DNS zones with networking infrastructure.
author: CAIRA Team
ms.date: 08/20/2025
ms.topic: reference
estimated_reading_time: 5
keywords:
    - terraform
    - azure
    - wellknown
    - ai search
    - cosmos db
    - private dns
    - networking
    - module
-->

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version        |
|-----------|----------------|
| terraform | >= 1.10, < 2.0 |
| azapi     | ~> 2.6         |
| azurerm   | ~> 4.40        |
| random    | ~> 3.7         |
| time      | ~> 0.13        |

## Providers

| Name    | Version |
|---------|---------|
| azapi   | ~> 2.6  |
| azurerm | ~> 4.40 |

## Modules

| Name   | Source               | Version |
|--------|----------------------|---------|
| naming | Azure/naming/azurerm | 0.4.2   |

## Resources

| Name                                                                                                                                                                               | Type     |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| [azapi_resource.search](https://registry.terraform.io/providers/Azure/azapi/latest/docs/resources/resource)                                                                        | resource |
| [azurerm_cosmosdb_account.cosmos](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/cosmosdb_account)                                                | resource |
| [azurerm_private_dns_zone.ai_services](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone)                                           | resource |
| [azurerm_private_dns_zone.blob](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone)                                                  | resource |
| [azurerm_private_dns_zone.cognitive](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone)                                             | resource |
| [azurerm_private_dns_zone.cosmos_sql](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone)                                            | resource |
| [azurerm_private_dns_zone.openai](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone)                                                | resource |
| [azurerm_private_dns_zone.search](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone)                                                | resource |
| [azurerm_private_dns_zone_virtual_network_link.ai_services](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone_virtual_network_link) | resource |
| [azurerm_private_dns_zone_virtual_network_link.blob](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone_virtual_network_link)        | resource |
| [azurerm_private_dns_zone_virtual_network_link.cognitive](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone_virtual_network_link)   | resource |
| [azurerm_private_dns_zone_virtual_network_link.cosmos_sql](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone_virtual_network_link)  | resource |
| [azurerm_private_dns_zone_virtual_network_link.openai](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone_virtual_network_link)      | resource |
| [azurerm_private_dns_zone_virtual_network_link.search](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_dns_zone_virtual_network_link)      | resource |
| [azurerm_private_endpoint.cosmos_sql](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_endpoint)                                            | resource |
| [azurerm_private_endpoint.sa_blob](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_endpoint)                                               | resource |
| [azurerm_private_endpoint.search](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/private_endpoint)                                                | resource |
| [azurerm_resource_group.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group)                                                      | resource |
| [azurerm_storage_account.blob](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_account)                                                    | resource |
| [azurerm_subnet.agent](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/subnet)                                                                     | resource |
| [azurerm_subnet.connections](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/subnet)                                                               | resource |
| [azurerm_virtual_network.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network)                                                    | resource |

## Inputs

| Name                        | Description                                                     | Type          | Default           | Required |
|-----------------------------|-----------------------------------------------------------------|---------------|-------------------|:--------:|
| address\_space              | Address space CIDR for the virtual network.                     | `string`      | `"172.16.0.0/16"` |    no    |
| base\_name                  | Semantic base name used for generating unique resource names.   | `string`      | `"privateenv"`    |    no    |
| connections\_subnet\_prefix | Address prefix for the 'connections' subnet.                    | `string`      | `"172.16.0.0/24"` |    no    |
| location                    | Azure region where the resources will be deployed.              | `string`      | `"swedencentral"` |    no    |
| search\_sku                 | SKU for Azure AI Search (e.g., 'basic', 'standard').            | `string`      | `"standard"`      |    no    |
| storage\_replication\_type  | Replication type for the storage account (e.g., LRS, ZRS, GRS). | `string`      | `"ZRS"`           |    no    |
| tags                        | Optional tags to apply to resources.                            | `map(string)` | `null`            |    no    |

<!-- END_TF_DOCS -->
