# https://github.com/terraform-linters/tflint/blob/master/docs/user-guide/config.md

config {
  call_module_type = "local"
  force            = false
}

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

plugin "terraform" {
  enabled = true
  version = "0.12.0"
  source  = "github.com/terraform-linters/tflint-ruleset-terraform"
}

plugin "basic-ext" {
  enabled = true
  version = "0.7.2"
  source  = "github.com/Azure/tflint-ruleset-basic-ext"
}

plugin "azurerm" {
  enabled = true
  version = "0.28.0"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

plugin "azurerm-ext" {
  enabled = true
  version = "0.6.1"
  source  = "github.com/Azure/tflint-ruleset-azurerm-ext"
}

# TODO
rule "terraform_unused_required_providers" {
  enabled = false
}

rule "terraform_module_version" {
  enabled = true
  exact   = true
}
