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
