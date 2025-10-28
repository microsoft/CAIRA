# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Foundry Standard Private Reference Architecture - Root Module Call
#
# Provisions an Azure AI Foundry environment configured for
# private networking. Foundry disables public access and
# injects the Agents capability into an existing subnet.
# Uses existing resources for agent capability host.
############################################################

module "common_models" {
  source = "../../modules/common_models"
}

module "naming" {
  source        = "Azure/naming/azurerm"
  version       = "0.4.2"
  suffix        = [local.base_name]
  unique-length = 5
}

resource "azurerm_resource_group" "this" {
  count    = var.resource_group_resource_id == null ? 1 : 0
  location = var.location
  name     = module.naming.resource_group.name_unique
  tags     = var.tags
}

locals {
  base_name                  = "basic-private"
  resource_group_resource_id = var.resource_group_resource_id != null ? var.resource_group_resource_id : azurerm_resource_group.this[0].id
  resource_group_name        = var.resource_group_resource_id != null ? provider::azapi::parse_resource_id("Microsoft.Resources/resourceGroups", var.resource_group_resource_id).resource_group_name : azurerm_resource_group.this[0].name
}

# Core AI Foundry environment with private networking enabled
module "ai_foundry" {
  source = "../../modules/ai_foundry"

  resource_group_id = local.resource_group_resource_id
  location          = var.location
  sku               = var.sku
  name              = module.naming.cognitive_account.name_unique

  model_deployments = [
    module.common_models.gpt_4_1,
    module.common_models.o4_mini,
    module.common_models.text_embedding_3_large
  ]

  application_insights = module.application_insights

  # Private networking
  foundry_subnet_id = var.foundry_subnet_id

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
