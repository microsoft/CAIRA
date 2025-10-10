# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "resource_group" {
  value       = azapi_resource.this
  description = "Resource group object"
}
