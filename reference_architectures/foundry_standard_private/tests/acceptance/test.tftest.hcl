run "testacc_foundry_standard_private" {
  command = plan

  assert {
    condition     = azurerm_resource_group.this[0].location == "swedencentral"
    error_message = "The resource group location should be 'swedencentral'"
  }
}
