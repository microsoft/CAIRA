# main.tf - # This extends the foundry_basic reference architecture with Azure Functions for serverless AI integration

# Call the foundry_basic reference architecture
module "foundry_basic" {
  source = "../../../reference_architectures/foundry_basic"

  location                   = var.location
  resource_group_resource_id = var.resource_group_resource_id
  project_name               = var.project_name
  project_display_name       = var.project_display_name
  project_description        = var.project_description
  sku                        = var.sku
  enable_telemetry           = var.enable_telemetry
  tags                       = var.tags
}

# Local values for resource naming
locals {
  resource_group_name = module.foundry_basic.resource_group_name
  base_name           = "func-${var.project_name}"
}
