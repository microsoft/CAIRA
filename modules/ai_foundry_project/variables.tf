# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

variable "ai_foundry_id" {
  description = "The resource ID of the parent AI Foundry resource."
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

variable "tags" {
  description = "A list of tags to apply to the AI Foundry resource."
  type        = map(string)
  default     = null
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
  })
  description = "Connections for AI Foundry agents."
  default     = null
}

variable "location" {
  description = "The Azure region where the AI Foundry project will be deployed."
  type        = string
}

variable "sku" {
  description = "The SKU for the AI Foundry project."
  type        = string
  default     = "S0"
}
