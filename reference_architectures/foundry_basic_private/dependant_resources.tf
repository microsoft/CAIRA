# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# Dependent resources for Foundry Basic Private

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
  monitor_private_link_scope = var.monitor_private_link_scope_resource_id != null ? {
    "ampls" = {
      resource_id = var.monitor_private_link_scope_resource_id
    }
  } : {}
}
