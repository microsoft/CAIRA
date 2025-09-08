# variables.tf - Variable definitions

# Required variables for AI Hub resources
variable "ai_hub_resource_group" {
  description = "Name of the resource group containing AI Hub resources"
  type        = string
}

variable "ai_hub_name" {
  description = "Name of the existing AI Hub"
  type        = string
  default     = ""
}

variable "ai_project_name" {
  description = "Name of the existing AI Project"
  type        = string
  default     = ""
}

variable "key_vault_name" {
  description = "Name of the existing Key Vault"
  type        = string
  default     = ""
}

variable "application_insights_name" {
  description = "Name of the existing Application Insights"
  type        = string
  default     = ""
}

variable "ai_hub_storage_account_name" {
  description = "Name of the existing AI Hub storage account"
  type        = string
  default     = ""
}

# Optional: Use existing suffix from AI Hub deployment
variable "use_existing_suffix" {
  description = "Use existing suffix from AI Hub deployment"
  type        = bool
  default     = false
}

variable "existing_suffix" {
  description = "Existing suffix from AI Hub deployment (if use_existing_suffix is true)"
  type        = string
  default     = ""
}

# Function App specific variables
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "aifoundry"

  validation {
    condition     = can(regex("^[a-z0-9]{3,12}$", var.project_name))
    error_message = "Project name must be 3-12 lowercase alphanumeric characters."
  }
}

variable "function_app_sku" {
  description = "SKU for the Function App service plan"
  type        = string
  default     = "Y1" # Consumption plan

  validation {
    condition     = contains(["F1", "Y1", "EP1", "EP2", "EP3"], var.function_app_sku)
    error_message = "Function App SKU must be F1 (Free), Y1 (Consumption), or EP1-3 (Elastic Premium)."
  }
}

variable "allowed_ip_ranges" {
  description = "List of allowed IP ranges for Function App"
  type        = list(string)
  default     = []
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins for Function App"
  type        = list(string)
  default     = ["*"]
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
