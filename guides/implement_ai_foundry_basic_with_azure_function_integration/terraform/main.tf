# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Azure Functions Integration Layer for AI Foundry
#
# This Terraform configuration deploys Azure Functions that
# integrate with an existing AI Foundry deployment.
#
# Prerequisites: any accessible foundry instance
############################################################

# Data sources for existing foundry_basic resources
data "azurerm_resource_group" "this" {
  name = var.foundry_resource_group_name
}

# Data source to reference the existing Application Insights
data "azurerm_application_insights" "this" {
  name                = var.foundry_application_insights_name
  resource_group_name = var.foundry_resource_group_name
}

# Naming module
module "naming" {
  source        = "Azure/naming/azurerm"
  version       = "0.4.2"
  suffix        = [local.base_name]
  unique-length = 5
}

# Create separate resource group for functions
resource "azurerm_resource_group" "function" {
  name     = "${module.naming.resource_group.name_unique}-func"
  location = data.azurerm_resource_group.this.location

  tags = merge(
    var.tags,
    {
      Purpose = "Function App Resources"
      Parent  = data.azurerm_resource_group.this.name
    }
  )
}

# Local values
locals {
  base_name = var.project_name

  # Use the separate resource group
  resource_group_name = azurerm_resource_group.function.name
  location            = azurerm_resource_group.function.location

  function_app_name = module.naming.function_app.name_unique
}
