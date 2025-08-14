# This file contains the dependent resources for the Foundry Basic configuration.
# While, these resources are created using sensitive defaults, they should be either
# customized to your needs or replaced with data sources to existing resources.

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "this" {
  location            = var.location
  name                = module.naming.log_analytics_workspace.name_unique
  resource_group_name = local.resource_group_name
  retention_in_days   = 30
  sku                 = "PerGB2018"
  tags                = var.tags
}

# Application Insights
module "application_insights" {
  source  = "Azure/avm-res-insights-component/azurerm"
  version = "0.2.0"

  location            = var.location
  name                = module.naming.application_insights.name_unique
  resource_group_name = local.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.this.id
  enable_telemetry    = var.enable_telemetry
  application_type    = "other"
  tags                = var.tags
}
