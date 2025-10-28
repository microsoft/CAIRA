# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

variable "fbp_resource_group_name" {
  description = "Name of the resource group containing foundry basic private durable test infrastructure"
  type        = string
  default     = "rg-fbscprv-durable"
}

variable "fbp_vnet_name" {
  description = "Name of the foundry basic private durable VNet"
  type        = string
  default     = "vnet-fbscprv-durable"
}

variable "connection_subnet_name" {
  description = "Name of the connections subnet (for AI Foundry private endpoints)"
  type        = string
  default     = "connections"
}

variable "cognitive_dns_zone_name" {
  description = "Name of the Cognitive Services private DNS zone"
  type        = string
  default     = "privatelink.cognitiveservices.azure.com"
}

variable "ai_services_dns_zone_name" {
  description = "Name of the AI Services private DNS zone"
  type        = string
  default     = "privatelink.services.ai.azure.com"
}

variable "openai_dns_zone_name" {
  description = "Name of the OpenAI private DNS zone"
  type        = string
  default     = "privatelink.openai.azure.com"
}

