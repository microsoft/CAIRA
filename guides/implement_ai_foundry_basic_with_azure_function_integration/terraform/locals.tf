# locals.tf - Local values and computed variables

locals {
  # Naming conventions
  ai_hub_name          = "hub-${var.project_name}-${var.environment}-${random_string.suffix.result}"
  ai_project_name      = "project-${var.project_name}-${var.environment}-${random_string.suffix.result}"
  storage_account_name = "st${var.project_name}${random_string.suffix.result}"
  function_app_name    = "func-${var.project_name}-${var.environment}-${random_string.suffix.result}"
  app_insights_name    = "appi-${var.project_name}-${var.environment}-${random_string.suffix.result}"

  # Key Vault name with proper length handling (3-24 characters allowed)
  # Format: kv-<project>-<env>-<suffix> ensuring we stay within limits
  key_vault_name_prefix = "kv-${substr(var.project_name, 0, min(8, length(var.project_name)))}"
  key_vault_name_suffix = substr(random_string.suffix.result, 0, 8)
  key_vault_name        = substr("${local.key_vault_name_prefix}-${var.environment}-${local.key_vault_name_suffix}", 0, 24)

  app_service_plan_name = "asp-${var.project_name}-${var.environment}"

  # Common tags
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Purpose     = "AI Foundry with Azure Functions"
    CreatedDate = timestamp()
  }

  # Merge common tags with user-provided tags
  tags = merge(local.common_tags, var.tags)

  # IP restrictions for Function App
  ip_restrictions = var.allowed_ip_ranges != [] ? [
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
