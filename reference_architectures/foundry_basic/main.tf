# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Foundry Basic Reference Architecture - Root Module Call
#
# This Terraform stack provisions a baseline Azure AI Foundry
# environment
############################################################

# Reusable model definitions used when configuring AI Foundry
# (exposes typed outputs for common model deployments)
module "common_models" {
  source = "../../modules/common_models"
}

# Azure naming convention helper to generate consistent and
# unique resource names across subscriptions and regions.
module "naming" {
  # https://registry.terraform.io/modules/Azure/naming/azurerm/latest
  source        = "Azure/naming/azurerm"
  version       = "0.4.3"
  suffix        = [local.base_name] # Suffix ensures uniqueness while keeping a human-friendly base name
  unique-length = 5                 # Number of random characters appended to resource names
}

# Resource Group (conditionally created)
# If an existing resource group ID is not provided, create one using the
# generated name from the naming module.
resource "azurerm_resource_group" "this" {
  count    = var.resource_group_resource_id == null ? 1 : 0
  location = var.location
  name     = module.naming.resource_group.name_unique
  tags     = var.tags
}

# Local values centralize the computed naming and resource group id.
locals {
  base_name                  = var.base_name # Used as the semantic prefix for naming resources
  resource_group_resource_id = var.resource_group_resource_id != null ? var.resource_group_resource_id : azurerm_resource_group.this[0].id
  resource_group_name        = var.resource_group_resource_id != null ? provider::azapi::parse_resource_id("Microsoft.Resources/resourceGroups", var.resource_group_resource_id).resource_group_name : azurerm_resource_group.this[0].name
}

# Core AI Foundry environment module
module "ai_foundry" {
  source = "../../modules/ai_foundry"

  # Target resource group and region
  resource_group_id = local.resource_group_resource_id
  location          = var.location

  sku = var.sku # AI Foundry SKU/tier

  # Logical name used for AI Foundry and dependent resources
  name = module.naming.cognitive_account.name_unique

  # Model deployments to make available within Foundry
  # Add/remove models as needed for your workload requirements
  model_deployments = [
    module.common_models.gpt_5_2_chat,
    module.common_models.gpt_5_nano,
    module.common_models.text_embedding_3_large
  ]

  application_insights = module.application_insights

  tags = var.tags
}

# Foundry default project
module "default_project" {
  source = "../../modules/ai_foundry_project"

  location      = var.location
  ai_foundry_id = module.ai_foundry.ai_foundry_id
}

# If you need a second project in your Foundry environment, uncomment
# this block with the corresponding outputs and customize
# the project name, display name, and description

# Foundry secondary project
# module "secondary_project" {
#   source = "../../modules/ai_foundry_project"

#   location      = var.location
#   ai_foundry_id = module.ai_foundry.ai_foundry_id

#   project_name         = "secondary-project"
#   project_display_name = "Secondary Project"
#   project_description  = "Secondary project"
# }
