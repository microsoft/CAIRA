<!-- META
title: Existing Resources Agent Capability Host Connections Terraform Module
description: Retrieves details for existing Azure resources (Cosmos DB, Storage Account, Azure AI Search) and outputs an agent_capability_host_connections object for the ai_foundry module.
author: CAIRA Team
ms.date: 08/18/2025
ms.topic: module
estimated_reading_time: 4
keywords:
    - terraform module
    - agent capability host
    - cosmos db
    - azure storage
    - azure ai search
    - existing resources
-->

# Existing Resources Agent Capability Host Connections Terraform Module

Retrieves the details about existing Azure resources (Cosmos DB, Storage Account, Azure AI Search) and outputs an `agent_capability_host_connections` object that plugs directly into the `ai_foundry` module's `agent_capability_host_connections` input.

## Overview

This module retrieves details of:

- Azure Cosmos DB account (SQL API)
- Azure Storage Account
- Azure AI Search service

And exposes a single output, designed to be used together with the `ai_foundry` module to quickly wire up Agent Capability Host connections with freshly created resources.

## Note

- This module does not create any RBAC assignments. The `create_required_role_assignments` value is only forwarded so that downstream modules (like `ai_foundry`) can decide whether to assign RBAC.

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version        |
|-----------|----------------|
| terraform | >= 1.13, < 2.0 |
| azapi     | ~> 2.6         |
| azurerm   | ~> 4.40        |

## Providers

| Name    | Version |
|---------|---------|
| azapi   | ~> 2.6  |
| azurerm | ~> 4.40 |

## Resources

| Name                                                                                                                                          | Type        |
|-----------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| [azapi_resource.ai_search](https://registry.terraform.io/providers/Azure/azapi/latest/docs/data-sources/resource)                             | data source |
| [azurerm_cosmosdb_account.cosmosdb](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/cosmosdb_account)      | data source |
| [azurerm_storage_account.storage_account](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/storage_account) | data source |

## Inputs

| Name                                | Description                                                                                         | Type     | Default | Required |
|-------------------------------------|-----------------------------------------------------------------------------------------------------|----------|---------|:--------:|
| cosmosdb\_account\_name             | Name of the existing Azure Cosmos DB account to reference.                                          | `string` | n/a     |   yes    |
| location                            | The Azure region where resources will be created.                                                   | `string` | n/a     |   yes    |
| search\_service\_name               | Name of the existing Azure AI Search service to reference.                                          | `string` | n/a     |   yes    |
| storage\_account\_name              | Name of the existing Storage Account to reference.                                                  | `string` | n/a     |   yes    |
| create\_required\_role\_assignments | Flag to indicate if required role assignments should be created.                                    | `bool`   | `true`  |    no    |
| resource\_group\_resource\_id       | The ID of an existing resource group to use. If not provided, a new resource group will be created. | `string` | `null`  |    no    |

## Outputs

| Name        | Description                                                        |
|-------------|--------------------------------------------------------------------|
| connections | Connections for AI Foundry agents derived from existing resources. |
<!-- END_TF_DOCS -->
