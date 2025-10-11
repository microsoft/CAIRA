# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

resource "azapi_resource" "this" {
  type     = "Microsoft.Resources/resourceGroups@2025-04-01"
  body     = {}
  location = var.location
  name     = local.name
}
