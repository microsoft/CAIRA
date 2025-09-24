variable "ai_foundry_name" {
  description = "The name of the AI Foundry resource."
  type        = string
}

variable "location" {
  description = "The Azure region where the AI Foundry resource will be deployed."
  type        = string
}

variable "sku" {
  description = "The SKU for the AI Foundry resource."
  type        = string
  default     = "S0"
}

variable "resource_group_id" {
  description = "The ID of the resource group where the AI Foundry resource will be created."
  type        = string
}

variable "project_name" {
  type        = string
  description = "The name of the AI Foundry project"
  default     = "default-project"
}

variable "project_display_name" {
  type        = string
  description = "The display name of the AI Foundry project"
  default     = "Default Project"
}

variable "project_description" {
  type        = string
  description = "The description of the AI Foundry project"
  default     = "Default Project description"
}

variable "model_deployments" {
  description = "A map of model deployments to be created in the AI Foundry resource."
  type = list(object({
    name    = string
    version = string
    format  = string
    sku = optional(object({
      name     = string
      capacity = number
      }), {
      name     = "GlobalStandard"
      capacity = 1
    })
  }))
}

variable "tags" {
  description = "A list of tags to apply to the AI Foundry resource."
  type        = map(string)
  default     = null
}

variable "agents_subnet_id" {
  description = "Optional subnet ID to inject the AI Foundry Agents capability host."
  type        = string
  default     = null
}

variable "foundry_subnet_id" {
  description = "Optional subnet ID to inject the AI Foundry."
  type        = string
  default     = null
}

variable "application_insights" {
  description = "Configuration for Application Insights connection."
  type = object({
    resource_id       = string
    name              = string
    connection_string = string
  })
  nullable  = false
  sensitive = true
}

variable "agent_capability_host_connections" {
  type = object({
    cosmos_db = object({
      resource_id         = string
      resource_group_name = string
      name                = string
      endpoint            = string
      location            = string
    })
    ai_search = object({
      resource_id = string
      name        = string
      location    = string
    })
    storage_account = object({
      resource_id           = string
      name                  = string
      primary_blob_endpoint = string
      location              = string
    })

    create_required_role_assignments = optional(bool, true)
  })
  description = "Connections for AI Foundry agents."
  default     = null
}
