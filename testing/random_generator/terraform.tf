terraform {
  required_version = ">= 1.12, < 2.0.0"
  required_providers {
    # https://registry.terraform.io/providers/hashicorp/random/latest
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0, < 4.0.0"
    }
  }
}
