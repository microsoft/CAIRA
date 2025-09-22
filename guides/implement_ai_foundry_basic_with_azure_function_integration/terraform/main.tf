############################################################
# Azure Functions Integration Layer for AI Foundry
#
# This Terraform configuration deploys Azure Functions that
# integrate with an existing AI Foundry deployment.
#
# Prerequisites: foundry_basic must be deployed first
############################################################

# Data source to reference the existing resource group
data "azurerm_resource_group" "this" {
  name = var.foundry_resource_group_name
}

# Data source to reference the existing AI Foundry account
data "azurerm_cognitive_account" "ai_foundry" {
  name                = var.foundry_ai_foundry_name
  resource_group_name = var.foundry_resource_group_name
}

# Data source to reference the existing Application Insights
data "azurerm_application_insights" "this" {
  name                = var.foundry_application_insights_name
  resource_group_name = var.foundry_resource_group_name
}

# Azure naming convention helper for function-specific resources
module "naming" {
  source        = "Azure/naming/azurerm"
  version       = "0.4.2"
  suffix        = [local.base_name]
  unique-length = 5
}

# Local values for resource naming and configuration
locals {
  base_name           = "func-${var.project_name}"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = data.azurerm_resource_group.this.location

  # Function app configuration
  function_app_name = module.naming.function_app.name_unique

  # AI Foundry connection details
  ai_foundry_endpoint = data.azurerm_cognitive_account.ai_foundry.endpoint
  ai_foundry_key      = data.azurerm_cognitive_account.ai_foundry.primary_access_key
}
