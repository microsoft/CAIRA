# locals.tf - Local values for Azure Function Configuration

locals {
  # Use existing suffix or generate new one
  suffix = var.use_existing_suffix ? var.existing_suffix : random_string.suffix[0].result

  # Naming conventions
  function_app_name             = "func-${var.project_name}-${var.environment}-${local.suffix}"
  function_storage_account_name = "stfunc${local.suffix}"
  app_service_plan_name         = "asp-${var.project_name}-${var.environment}"

  # Common tags
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Purpose     = "Azure Functions for AI Foundry"
    CreatedDate = timestamp()
  }

  # Merge common tags with user-provided tags
  tags = merge(local.common_tags, var.tags)

  # IP restrictions for Function App
  ip_restrictions = length(var.allowed_ip_ranges) != 0 ? [
    for ip in var.allowed_ip_ranges : {
      name                      = "AllowedIP-${index(var.allowed_ip_ranges, ip)}"
      ip_address                = ip
      virtual_network_subnet_id = null
      service_tag               = null
      priority                  = 100 + index(var.allowed_ip_ranges, ip)
      action                    = "Allow"
    }
  ] : []
}
