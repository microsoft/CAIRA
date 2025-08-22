<!-- META
title: New Resources Agent Capability Host Connections Terraform Module
description: Provisions Azure resources (Cosmos DB, Storage Account, Azure AI Search) and outputs an agent_capability_host_connections object for the ai_foundry module.
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
    - new resources
-->

# New Resources Agent Capability Host Connections Terraform Module

Provisions new Azure resources (Cosmos DB, Storage Account, Azure AI Search) and outputs an `agent_capability_host_connections` object that plugs directly into the `ai_foundry` module's `agent_capability_host_connections` input.

## Overview

This module creates:

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
| terraform | >= 1.10, < 2.0 |
| azapi     | ~> 2.6         |
| azurerm   | ~> 4.40        |

## Providers

| Name    | Version |
|---------|---------|
| azapi   | ~> 2.6  |
| azurerm | ~> 4.40 |

## Resources

| Name                                                                                                                                       | Type     |
|--------------------------------------------------------------------------------------------------------------------------------------------|----------|
| [azapi_resource.ai_search](https://registry.terraform.io/providers/Azure/azapi/latest/docs/resources/resource)                             | resource |
| [azurerm_cosmosdb_account.cosmosdb](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/cosmosdb_account)      | resource |
| [azurerm_storage_account.storage_account](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/storage_account) | resource |

## Inputs

| Name                                | Description                                                      | Type          | Default | Required |
|-------------------------------------|------------------------------------------------------------------|---------------|---------|:--------:|
| ai\_search\_name                    | The name of the Azure AI Search service to create.               | `string`      | n/a     |   yes    |
| cosmos\_db\_account\_name           | The name of the Cosmos DB account to create.                     | `string`      | n/a     |   yes    |
| location                            | The Azure region where resources will be created.                | `string`      | n/a     |   yes    |
| resource\_group\_resource\_id       | The ID of an existing resource group to use.                     | `string`      | n/a     |   yes    |
| storage\_account\_name              | The name of the Storage Account to create.                       | `string`      | n/a     |   yes    |
| create\_required\_role\_assignments | Flag to indicate if required role assignments should be created. | `bool`        | `true`  |    no    |
| tags                                | Tags to apply to created resources.                              | `map(string)` | `{}`    |    no    |

## Outputs

| Name        | Description                                                             |
|-------------|-------------------------------------------------------------------------|
| connections | Connections for AI Foundry agents derived from newly created resources. |
<!-- END_TF_DOCS -->
