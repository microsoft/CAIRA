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
  # Parse AI Foundry resource ID
  # Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{name}
  ai_foundry_id_parts         = split("/", var.foundry_ai_foundry_id)
  foundry_resource_group_name = local.ai_foundry_id_parts[4]
  ai_foundry_name             = local.ai_foundry_id_parts[8]

  # Parse Application Insights resource ID
  # Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Insights/components/{name}
  app_insights_id_parts       = split("/", var.foundry_application_insights_id)
  app_insights_resource_group = local.app_insights_id_parts[4]
  app_insights_name           = local.app_insights_id_parts[8]

  # Parse AI Foundry Project ID to extract project name
  # Format varies, but typically ends with /projects/{name}
  project_id_parts        = split("/", var.foundry_ai_foundry_project_id)
  ai_foundry_project_name = element(local.project_id_parts, length(local.project_id_parts) - 1)

  # Validation flags
  is_valid_ai_foundry_id = (
    length(local.ai_foundry_id_parts) == 9 &&
    local.ai_foundry_id_parts[6] == "Microsoft.CognitiveServices" &&
    local.ai_foundry_id_parts[7] == "accounts"
  )

  is_valid_app_insights_id = (
    length(local.app_insights_id_parts) == 9 &&
    lower(local.app_insights_id_parts[6]) == "microsoft.insights" &&
    local.app_insights_id_parts[7] == "components"
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
