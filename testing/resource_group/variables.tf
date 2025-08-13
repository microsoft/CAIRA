
variable "location" {
  type        = string
  description = "The Azure location where the resource group will be created."
  default     = "WestUS2"
}

variable "name" {
  type        = string
  description = "The name of the resource group."
  default     = null
}
