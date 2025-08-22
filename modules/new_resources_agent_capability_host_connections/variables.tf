variable "location" {
  description = "The Azure region where resources will be created."
  type        = string
}

variable "resource_group_resource_id" {
  description = "The ID of an existing resource group to use."
  type        = string
}

variable "tags" {
  description = "Tags to apply to created resources."
  type        = map(string)
  default     = {}
}

variable "create_required_role_assignments" {
  description = "Flag to indicate if required role assignments should be created."
  type        = bool
  default     = true
}

variable "cosmos_db_account_name" {
  description = "The name of the Cosmos DB account to create."
  type        = string
}

variable "storage_account_name" {
  description = "The name of the Storage Account to create."
  type        = string
}

variable "ai_search_name" {
  description = "The name of the Azure AI Search service to create."
  type        = string
}
