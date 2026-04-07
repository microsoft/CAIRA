# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

/*
 * Core Parameters - Optional
 */

variable "base_name" {
  type        = string
  description = "Base name used as suffix in the naming module."
  default     = "foundry-authz"
  nullable    = false
}

variable "location" {
  type        = string
  description = "Azure region where the architecture resources will be deployed."
  default     = "swedencentral"
  nullable    = false
}

variable "private_endpoint_subnet_address_prefixes" {
  type        = list(string)
  description = "Address prefixes for the subnet that hosts AI Foundry private endpoints. Otherwise, '[\"172.16.0.0/24\"]'."
  default     = ["172.16.0.0/24"]
}

variable "private_network_address_space" {
  type        = list(string)
  description = "Address space for the optional virtual network used by AI Foundry private endpoints. Otherwise, '[\"172.16.0.0/16\"]'."
  default     = ["172.16.0.0/16"]
}

variable "resource_group_resource_id" {
  type        = string
  description = "Resource group resource ID where the architecture resources will be deployed. Otherwise, a new resource group is created."
  default     = null
}

variable "should_enable_foundry_private_networking" {
  type        = bool
  description = "Controls whether the architecture creates a virtual network and private endpoints for AI Foundry model traffic. Otherwise, 'false'."
  default     = false
  nullable    = false
}

variable "sku" {
  type        = string
  description = "The SKU for the AI Foundry account. Otherwise, 'S0'."
  default     = "S0"
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all supported resources. Otherwise, '{}'."
  default     = {}
}

/*
 * APIM Parameters - Optional
 */

variable "apim_sku_name" {
  type        = string
  description = "API Management SKU name. Otherwise, 'Developer_1'."
  default     = "Developer_1"
}

variable "apim_publisher_email" {
  type        = string
  description = "Publisher email used by API Management."
}

variable "apim_publisher_name" {
  type        = string
  description = "Publisher name used by API Management. Otherwise, 'CAIRA'."
  default     = "CAIRA"
}

variable "foundry_api_version" {
  type        = string
  description = "Azure OpenAI API version used when APIM rewrites backend routes. Otherwise, '2024-10-21'."
  default     = "2024-10-21"
}

/*
 * Authorization Parameters - Optional
 */

variable "client_applications" {
  type = map(object({
    display_name     = string
    assigned_roles   = list(string)
    sign_in_audience = optional(string, "AzureADMyOrg")
  }))
  description = "Client applications and their assigned model roles. Otherwise, a sample set of two clients is created."
  default = {
    app_a_2 = {
      display_name   = "caira-client-a-2"
      assigned_roles = ["model.gpt4o-mini.invoke"]
    }
    app_b_2 = {
      display_name   = "caira-client-b-2"
      assigned_roles = ["model.gpt5-nano.invoke"]
    }
  }
}

variable "model_authorization_rules" {
  type = list(object({
    deployment_name = string
    method          = string
    required_role   = string
    route           = string
  }))
  description = "APIM operation-to-model authorization mappings. Each route maps to one deployment and one required app role."
  default = [
    {
      deployment_name = "gpt-4o-mini"
      method          = "POST"
      required_role   = "model.gpt4o-mini.invoke"
      route           = "/gpt4o-mini/chat/completions"
    },
    {
      deployment_name = "gpt-5-nano"
      method          = "POST"
      required_role   = "model.gpt5-nano.invoke"
      route           = "/gpt5-nano/chat/completions"
    }
  ]

  validation {
    condition     = length(var.model_authorization_rules) > 0
    error_message = "model_authorization_rules must contain at least one route mapping."
  }
}

variable "enable_telemetry" {
  type        = bool
  description = "Controls whether partner telemetry is enabled in supported AVM modules. Otherwise, 'true'."
  default     = true
  nullable    = false
}
