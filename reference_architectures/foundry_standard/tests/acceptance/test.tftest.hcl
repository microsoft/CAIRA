run "testacc_foundry_standard" {
  command = plan

  variables {
    location = "swedencentral"
  }

  assert {
    condition     = azurerm_resource_group.this[0].location == "swedencentral"
    error_message = "The resource group location should be 'swedencentral'"
  }
}
