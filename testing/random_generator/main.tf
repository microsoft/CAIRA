resource "random_string" "this" {
  keepers = {
    first = timestamp()
  }
  length  = var.length
  special = false
  numeric = false
  upper   = var.upper
}

resource "random_uuid" "this" {
  keepers = {
    first = timestamp()
  }
}

resource "random_password" "this" {
  keepers = {
    first = timestamp()
  }
  length           = var.length
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_integer" "this" {
  keepers = {
    first = timestamp()
  }
  min = var.int_min
  max = var.int_max
}
