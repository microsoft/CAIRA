############################################################
# Variables for Azure Functions AI Integration Layer
############################################################

# Foundry Basic Outputs (Required as Inputs)
# These variables receive the outputs from the foundry_basic deployment

variable "foundry_resource_group_name" {
  type        = string
  description = "The name of the resource group from foundry_basic deployment"
}

variable "foundry_ai_foundry_name" {
  type        = string
  description = "The name of the AI Foundry account from foundry_basic deployment"
}

variable "foundry_ai_foundry_id" {
  type        = string
  description = "The resource ID of the AI Foundry account from foundry_basic deployment"
}

variable "foundry_ai_foundry_project_id" {
  type        = string
  description = "The resource ID of the AI Foundry Project from foundry_basic deployment"
}

variable "foundry_ai_foundry_project_name" {
  type        = string
  description = "The name of the AI Foundry Project from foundry_basic deployment"
}

variable "foundry_application_insights_name" {
  type        = string
  description = "The name of the Application Insights instance from foundry_basic deployment"
}

variable "foundry_application_insights_id" {
  type        = string
  description = "The resource ID of the Application Insights instance from foundry_basic deployment"
}

variable "foundry_log_analytics_workspace_id" {
  type        = string
  description = "The resource ID of the Log Analytics workspace from foundry_basic deployment"
}

# Function-specific Configuration Variables

variable "project_name" {
  type        = string
  description = "Project name for the function app resources"
  default     = "ai-integration"
}

variable "function_tier" {
  type        = string
  description = "The SKU tier for the Function App (Dynamic, ElasticPremium, or Dedicated)"
  default     = "Dedicated"
  validation {
    condition     = contains(["Dynamic", "ElasticPremium", "Dedicated"], var.function_tier)
    error_message = "The function_tier must be 'Dynamic', 'ElasticPremium', or 'Dedicated'."
  }
}

variable "function_sku_size" {
  type        = string
  description = "The SKU size for the Function App"
  default     = "B1"
}

variable "python_version" {
  type        = string
  description = "Python version for the Function App"
  default     = "3.11"
}

variable "enable_vnet_integration" {
  type        = bool
  description = "Enable VNet integration for enhanced security"
  default     = false
}

variable "enable_private_endpoints" {
  type        = bool
  description = "Enable private endpoints for storage and function app"
  default     = false
}

variable "enable_telemetry" {
  type        = bool
  default     = true
  description = "Enable telemetry collection for the module"
  nullable    = false
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to be applied to all resources"
}
