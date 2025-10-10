# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

run "testacc_resource_group" {
  command = plan

  assert {
    condition     = azapi_resource.this.location == "swedencentral"
    error_message = "The resource group location should be 'swedencentral'"
  }
}
