run "setup" {
  module {
    source = "./tests/integration/setup"
  }
}

run "testint_foundry_standard_private" {
  command = apply

  variables {
    foundry_subnet_id = run.setup.connection.id
    agents_subnet_id  = run.setup.agent.id
  }

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
