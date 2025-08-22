variable "base_name" {
  type        = string
  description = "Semantic base name used for generating unique resource names."
  default     = "privateenv"
}

variable "location" {
  type        = string
  description = "Azure region where the resources will be deployed."
  default     = "swedencentral"
}

variable "tags" {
  type        = map(string)
  description = "Optional tags to apply to resources."
  default     = null
}

variable "address_space" {
  type        = string
  description = "Address space CIDR for the virtual network."
  default     = "172.16.0.0/16"
}

variable "connections_subnet_prefix" {
  type        = string
  description = "Address prefix for the 'connections' subnet."
  default     = "172.16.0.0/24"
}

variable "storage_replication_type" {
  type        = string
  description = "Replication type for the storage account (e.g., LRS, ZRS, GRS)."
  default     = "ZRS"
}

variable "search_sku" {
  type        = string
  description = "SKU for Azure AI Search (e.g., 'basic', 'standard')."
  default     = "standard"
}
