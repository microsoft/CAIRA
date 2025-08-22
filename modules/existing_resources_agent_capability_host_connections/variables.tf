variable "location" {
  description = "The Azure region where resources will be created."
  type        = string
}

variable "resource_group_resource_id" {
  description = "The ID of an existing resource group to use. If not provided, a new resource group will be created."
  type        = string
  default     = null
}

variable "cosmosdb_account_name" {
  description = "Name of the existing Azure Cosmos DB account to reference."
  type        = string
}

variable "storage_account_name" {
  description = "Name of the existing Storage Account to reference."
  type        = string
}

variable "search_service_name" {
  description = "Name of the existing Azure AI Search service to reference."
  type        = string
}

variable "create_required_role_assignments" {
  description = "Flag to indicate if required role assignments should be created."
  type        = bool
  default     = true
}
