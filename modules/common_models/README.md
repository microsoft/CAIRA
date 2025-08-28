<!-- META
title: Common Models Terraform Module
description: Provides a catalog of commonly used model deployment specifications as Terraform outputs.
author: CAIRA Team
ms.date: 08/14/2025
ms.topic: module
estimated_reading_time: 3
keywords:
  - terraform module
  - model catalogs
  - model deployments
  - azure ai foundry
-->

# Common Models Terraform Module

Provides a catalog of commonly used model deployment specifications as Terraform outputs. Intended to be consumed by other modules (e.g., `ai_foundry`) to supply the `model_deployments` input.

## Overview

This module does not create any resources. It exports a set of objects representing model deployments compatible with `azurerm_cognitive_deployment` in an Azure AI Foundry account.

Some consumers may support an optional `sku` block on each item with fields `name` and `capacity`. You can add or override `sku` at the call site if needed.

## Usage

```terraform
module "common_models" {
  source = "../../modules/common_models"
}

module "ai_foundry" {
  source = "../../modules/ai_foundry"

  # ... other required inputs ...

  model_deployments = [
    module.common_models.gpt_4_1,
    module.common_models.o4_mini,
    module.common_models.text_embedding_3_large
  ]
}
```

To override SKU per deployment:

```terraform
model_deployments = [
  merge(module.common_models.gpt_4_1, { sku = { name = "GlobalStandard", capacity = 2 } }),
  module.common_models.text_embedding_3_large
]
```

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version        |
|-----------|----------------|
| terraform | >= 1.13, < 2.0 |

## Outputs

| Name                       | Description                   |
|----------------------------|-------------------------------|
| gpt\_4\_1                  | GPT-4.1 model                 |
| gpt\_4\_1\_mini            | GPT-4.1-mini model            |
| gpt\_4\_1\_nano            | GPT-4.1-nano model            |
| gpt\_4o                    | GPT-4o model                  |
| gpt\_4o\_audio\_preview    | GPT-4o audio preview model    |
| gpt\_4o\_mini              | GPT-4o-mini model             |
| gpt\_4o\_realtime\_preview | GPT-4o realtime preview model |
| gpt\_4o\_transcribe        | GPT-4o transcribe model       |
| o4\_mini                   | O4-mini model                 |
| text\_embedding\_3\_large  | Text embedding 3 large model  |
| text\_embedding\_3\_small  | Text embedding 3 small model  |
<!-- END_TF_DOCS -->
