locals {
  name = var.name != null ? var.name : substr(md5(uuid()), 0, 6)
}
