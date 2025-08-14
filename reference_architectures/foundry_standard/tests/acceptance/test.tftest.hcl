run "testacc_foundry_standard" {
  command = plan
  variables {
    location = "eastus"
  }
  assert {
    condition     = azurerm_resource_group.this[0].location == "eastus"
    error_message = "The resource group location should be 'eastus'"
  }
}
