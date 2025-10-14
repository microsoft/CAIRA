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

locals {
  # Parse resource IDs using provider function
  ai_foundry_parsed   = provider::azurerm::parse_resource_id(var.foundry_ai_foundry_id)
  app_insights_parsed = provider::azurerm::parse_resource_id(var.foundry_application_insights_id)

  # Extract components - the function returns a map with parts of the ID
  # Access using the actual keys returned by the function
  foundry_resource_group_name = local.ai_foundry_parsed["resource_group_name"]
  ai_foundry_name             = local.ai_foundry_parsed["resource_name"]

  app_insights_resource_group = local.app_insights_parsed["resource_group_name"]
  app_insights_name           = local.app_insights_parsed["resource_name"]

  # Parse AI Foundry Project ID to extract project name
  project_id_parts        = split("/", var.foundry_ai_foundry_project_id)
  ai_foundry_project_name = element(local.project_id_parts, length(local.project_id_parts) - 1)

  # Validation using the parsed objects
  is_valid_ai_foundry_id = (
    can(local.ai_foundry_parsed["resource_group_name"]) &&
    can(local.ai_foundry_parsed["resource_name"])
  )

  is_valid_app_insights_id = (
    can(local.app_insights_parsed["resource_group_name"]) &&
    can(local.app_insights_parsed["resource_name"])
  )
}



# Validation check
resource "terraform_data" "validate_inputs" {
  lifecycle {
    precondition {
      condition     = local.is_valid_ai_foundry_id
      error_message = "foundry_ai_foundry_id must be a valid Azure Cognitive Services resource ID with format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{name}"
    }

    precondition {
      condition     = local.is_valid_app_insights_id
      error_message = "foundry_application_insights_id must be a valid Application Insights resource ID with format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Insights/components/{name}"
    }
  }
}

# Data source for existing foundry_basic resource group
data "azurerm_resource_group" "this" {
  name = local.foundry_resource_group_name
}

# Data source to reference the existing AI Foundry account and get endpoint
data "azurerm_cognitive_account" "ai_foundry" {
  name                = local.ai_foundry_name
  resource_group_name = local.foundry_resource_group_name
}

# Data source to reference the existing Application Insights
data "azurerm_application_insights" "this" {
  name                = local.app_insights_name
  resource_group_name = local.app_insights_resource_group
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

  depends_on = [terraform_data.validate_inputs]
}

# Local values
locals {
  base_name = var.project_name

  # Use the separate resource group for functions
  function_resource_group_name = azurerm_resource_group.function.name
  location                     = azurerm_resource_group.function.location

  function_app_name   = module.naming.function_app.name_unique
  ai_foundry_endpoint = data.azurerm_cognitive_account.ai_foundry.endpoint
}
