<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version          |
|-----------|------------------|
| terraform | >= 1.12, < 2.0.0 |
| azapi     | ~> 2.6           |

## Providers

| Name  | Version |
|-------|---------|
| azapi | ~> 2.6  |

## Resources

| Name                                                                                                      | Type     |
|-----------------------------------------------------------------------------------------------------------|----------|
| [azapi_resource.this](https://registry.terraform.io/providers/azure/azapi/latest/docs/resources/resource) | resource |

## Inputs

| Name     | Description                                                  | Type     | Default           | Required |
|----------|--------------------------------------------------------------|----------|-------------------|:--------:|
| location | The Azure location where the resource group will be created. | `string` | `"swedencentral"` |    no    |
| name     | The name of the resource group.                              | `string` | `null`            |    no    |

## Outputs

| Name            | Description           |
|-----------------|-----------------------|
| resource\_group | Resource group object |
<!-- END_TF_DOCS -->
