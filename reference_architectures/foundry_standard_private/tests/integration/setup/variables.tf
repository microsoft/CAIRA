variable "location" {
  type        = string
  description = "Azure region where the resources will be deployed."
  default     = "swedencentral"
}

variable "base_name" {
  type        = string
  description = "Semantic base name used for generating unique resource names."
  default     = "fstdprv"
}

variable "subnet_destroy_time_sleep" {
  type        = string
  description = "Time to wait before destroying the subnet."
  default     = "20m"
}
