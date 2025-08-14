run "testint_foundry_standard" {
  command = apply

  assert {
    condition     = azurerm_resource_group.this[0].name != null
    error_message = "The resource group name should not be null"
  }

  assert {
    condition     = module.ai_foundry.ai_foundry_id != null
    error_message = "The AI Foundry ID should not be null"
  }

  assert {
    condition     = module.ai_foundry.ai_foundry_project_id != null
    error_message = "The AI Foundry project ID should not be null"
  }

  assert {
    condition     = module.ai_foundry.ai_foundry_model_deployments_ids != null && length(module.ai_foundry.ai_foundry_model_deployments_ids) > 0
    error_message = "There should be at least one AI Model Deployment ID"
  }
}
