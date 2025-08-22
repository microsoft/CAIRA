variable "length" {
  type        = number
  description = "Length of the random string"
  default     = 16
}

variable "upper" {
  type        = bool
  description = "Whether to include uppercase letters in the random string"
  default     = false
}

variable "int_min" {
  type        = number
  description = "Minimum value for the random integer"
  default     = 1
}

variable "int_max" {
  type        = number
  description = "Maximum value for the random integer"
  default     = 50000
}
