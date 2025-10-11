# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

locals {
  name = var.name != null ? var.name : substr(md5(uuid()), 0, 6)
}
