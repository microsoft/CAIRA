<!-- META
title: Azure AI Foundry - Basic Configuration
description: This Terraform configuration deploys a baseline Azure AI Foundry environment designed for development and experimentation with AI workloads.
author: CAIRA Team
ms.date: 08/14/2025
ms.topic: architecture
estimated_reading_time: 7
keywords:
   - reference architecture
   - azure ai foundry
   - basic configuration
   - terraform
   - application insights
   - log analytics
   - model deployments
-->

# Azure AI Foundry - Basic Configuration

This Terraform configuration deploys a baseline Azure AI Foundry environment designed for development and experimentation with AI workloads. It provides a simple, cost-effective setup that includes all essential components for building, testing, and monitoring AI applications.

## Overview

The Basic AI Foundry configuration creates a minimal but complete AI development environment suitable for:

- **Generative AI POC Development**: Building custom copilots, chatbots, and AI-powered applications
- **Model Experimentation**: Testing and fine-tuning AI models in a controlled environment
- **Learning and Training**: Educational environments for teams new to Azure AI services

## Architecture

![Architecture Diagram](./images/architecture.drawio.svg)

### Components Deployed

| Component                   | Purpose                                  | Configuration                          |
|-----------------------------|------------------------------------------|----------------------------------------|
| **Resource Group**          | Container for all resources              | Conditionally created if not provided  |
| **AI Foundry Resource**     | Central AI platform (Cognitive Services) | Single Resource with model deployments |
| **AI Foundry Project**      | Workspace for organizing AI work         | One project with configurable settings |
| **Model Deployments**       | Pre-deployed AI models                   | GPT-4.1 by default (configurable)      |
| **Log Analytics Workspace** | Centralized logging and analytics        | 30-day retention, pay-per-GB           |
| **Application Insights**    | Application performance monitoring       | Linked to Log Analytics                |
| **Project Connection**      | Telemetry integration                    | Connects AI project to App Insights    |

## Key Features

- **🚀 Quick Setup**: Deploy in minutes with minimal configuration
- **💰 Cost-Optimized**: Uses standard pricing tiers suitable for development
- **📊 Observability**: Built-in monitoring and logging capabilities
- **🔧 Configurable**: Easily customizable through Terraform variables
- **📈 Scalable**: Foundation that can grow with your needs

## Getting Started

### Prerequisites

1. **Active Azure subscription(s) with appropriate permissions**
  It's recommended to deploy these templates through a deployment pipeline associated to a service principal or managed identity with sufficient permissions over the the workload subscription (such as Owner or Role Based Access Control Administrator and Contributor). If deployed manually, the permissions below should be sufficient.

   - **Workload Subscription**
     - **Role Based Access Control Administrator**: Needed over the resource group to create the relevant role assignments
     - **Network Contributor**: Needed over the resource group to create virtual network and Private Endpoint resources
     - **Azure AI Account Owner**: Needed to create a cognitive services account and project
     - **Owner or Role Based Access Administrator**: Needed to assign RBAC to the required resources (Cosmos DB, Azure AI Search, Storage)
     - **Azure AI User**: Needed to create and edit agents

1. **Register Resource Providers**

   ```shell
   az provider register --namespace 'Microsoft.CognitiveServices'
   ```

1. Sufficient quota for all resources in your target Azure region

1. Azure CLI installed and configured on your local workstation or deployment pipeline server

1. Terraform CLI version v1.10 or later on your local workstation or deployment pipeline server. This template requires the usage of both the AzureRm and AzApi Terraform providers.

### Basic Deployment

1. **Clone the repository**:

   ```shell
   git clone <repository-url>
   cd reference_architectures/foundry_basic
   ```

1. **Login to your Azure subscription**

    ```shell
    az login
    ```

1. **Set your active subscription**

    ```shell
    az account set --subscription "<your_subscription_id>"
    ```

1. **Export the subscription ID as an environment variable to make it available to the AzureRM and AzAPI Terraform providers**

    ```shell
    export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    ```

1. **Initialize Terraform**:

   ```shell
   terraform init
   ```

1. **Review the plan**:

   ```shell
   terraform plan
   ```

1. **Deploy the infrastructure**:

   ```shell
   terraform apply
   ```

## Usage Examples

### Accessing Your AI Foundry

After deployment, you can access your AI Foundry environment through:

1. **Azure Portal**: Navigate to your Cognitive Services account
1. **AI Foundry Studio**: Use the web interface for model management
1. **Azure CLI**: Interact programmatically with your deployments
1. **SDKs**: Connect from your applications using Azure AI SDKs

### Monitoring and Observability

The configuration includes built-in monitoring:

- **Application Insights**: View telemetry, performance metrics, and traces
- **Log Analytics**: Query logs and create custom dashboards

Access monitoring dashboards through the Azure Portal or create custom queries in Log Analytics.

## Cost Considerations

This configuration is designed to be cost-effective for development workloads:

- **AI Models**: Uses standard pricing tiers with minimal capacity
- **Storage**: Log Analytics with 30-day retention
- **Compute**: No dedicated compute resources (serverless model endpoints)

## Troubleshooting

### Common Issues

1. **Model Deployment Failures**:
   - Check model availability in your region
   - Verify quota limits for your subscription
   - Update model versions if outdated

1. **Permission Errors**:
   - Ensure your account has Contributor role on subscription/resource group
   - Check if Cognitive Services are available in your region

1. **Terraform Errors**:
   - Run `terraform validate` to check syntax
   - Update provider versions if needed
   - Check Azure CLI authentication with `az account show`

## Support

For issues and questions:

- Review the [troubleshooting guide](../../docs/troubleshooting.md)
- Check the [contributing guidelines](../../CONTRIBUTING.md)
- Open an issue in the repository

---

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name      | Version        |
|-----------|----------------|
| terraform | >= 1.10, < 2.0 |
| azapi     | ~> 2.6         |
| azurerm   | ~> 4.40        |

## Providers

| Name    | Version |
|---------|---------|
| azurerm | ~> 4.40 |

## Modules

| Name                  | Source                                   | Version |
|-----------------------|------------------------------------------|---------|
| ai\_foundry           | ../../modules/ai_foundry                 | n/a     |
| application\_insights | Azure/avm-res-insights-component/azurerm | 0.2.0   |
| common\_models        | ../../modules/common_models              | n/a     |
| naming                | Azure/naming/azurerm                     | 0.4.2   |

## Resources

| Name                                                                                                                                            | Type     |
|-------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| [azurerm_log_analytics_workspace.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/log_analytics_workspace) | resource |
| [azurerm_resource_group.this](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/resource_group)                   | resource |

## Inputs

| Name                          | Description                                                                                                                                                                                                 | Type          | Default                         | Required |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|---------------------------------|:--------:|
| enable\_telemetry             | This variable controls whether or not telemetry is enabled for the module.<br/>For more information see <https://aka.ms/avm/telemetryinfo>.<br/>If it is set to false, then no telemetry will be collected. | `bool`        | `true`                          |    no    |
| location                      | Azure region where the resource should be deployed.                                                                                                                                                         | `string`      | `"swedencentral"`               |    no    |
| project\_description          | The description of the AI Foundry project                                                                                                                                                                   | `string`      | `"Default Project description"` |    no    |
| project\_display\_name        | The display name of the AI Foundry project                                                                                                                                                                  | `string`      | `"Default Project"`             |    no    |
| project\_name                 | The name of the AI Foundry project                                                                                                                                                                          | `string`      | `"default-project"`             |    no    |
| resource\_group\_resource\_id | The resource group resource id where the module resources will be deployed. If not provided, a new resource group will be created.                                                                          | `string`      | `null`                          |    no    |
| sku                           | The SKU for the AI Foundry resource. The default is 'S0'.                                                                                                                                                   | `string`      | `"S0"`                          |    no    |
| tags                          | (Optional) Tags to be applied to all resources.                                                                                                                                                             | `map(string)` | `null`                          |    no    |

## Outputs

| Name                                          | Description                                                                  |
|-----------------------------------------------|------------------------------------------------------------------------------|
| ai\_foundry\_id                               | The resource ID of the AI Foundry account.                                   |
| ai\_foundry\_model\_deployments\_ids          | The IDs of the AI Foundry model deployments.                                 |
| ai\_foundry\_name                             | The name of the AI Foundry account.                                          |
| ai\_foundry\_project\_id                      | The resource ID of the AI Foundry Project.                                   |
| ai\_foundry\_project\_identity\_principal\_id | The principal ID of the AI Foundry project system-assigned managed identity. |
| ai\_foundry\_project\_name                    | The name of the AI Foundry Project.                                          |
| application\_insights\_id                     | The resource ID of the Application Insights instance.                        |
| log\_analytics\_workspace\_id                 | The resource ID of the Log Analytics workspace.                              |
| resource\_group\_id                           | The resource ID of the resource group.                                       |
| resource\_group\_name                         | The name of the resource group.                                              |
<!-- END_TF_DOCS -->
