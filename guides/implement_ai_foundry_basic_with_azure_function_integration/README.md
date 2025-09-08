# AI Foundry Basic with Azure Function Integration - Implementation Guide

## Overview

This guide provides a complete Infrastructure as Code (IaC) solution for deploying AI Foundry Basic Reference Architecture integrated with Azure Functions using Terraform. The solution enables secure, serverless compute capabilities with AI Foundry's AI models.

## Architecture Components

- **Azure AI Hub** (AI Foundry): Central workspace for AI models and experiments
- **Azure AI Project**: Connected project for organizing AI workloads
- **Azure Function App**: Serverless compute with system-assigned managed identity
- **Azure Key Vault**: Secure storage for secrets and keys
- **Application Insights**: Monitoring and diagnostics
- **Storage Accounts**: Data storage for AI Hub and Function App

## Prerequisites

### Required Tools

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest) (version 2.50+)
- [Terraform](https://developer.hashicorp.com/terraform) (version 1.5.0+)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=windows%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-csharp) (version 4.x)
- [Python](https://www.python.org/downloads/) (version 3.9+)

### Azure Requirements

- Active Azure subscription
- Sufficient permissions to create resources
- Contributor or Owner role at subscription level

## Quick Start

### 1. Clone and Setup

#### VS Code Development Containers

The recommended way to engage with this sample is through a [development container using VS Code](https://code.visualstudio.com/docs/devcontainers/containers):

1. Ensure that you have Docker configured. The easiest way is to install Docker Desktop locally, but see other options at the [Development Container documentation](https://code.visualstudio.com/docs/devcontainers/containers#_system-requirements).
1. Install [Visual Studio Code](https://code.visualstudio.com/).
1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
1. Clone the CAIRA repo using your method of choice.
1. Open the project in VS Code.
1. Assuming the Dev Containers extension is set up correctly, you should see a popup asking you if you would like to open the project in a dev container:
    ![Dev Container popup notification](images/dev_container_popup.png)

    Choose "Reopen in Container".

    - If you do not get the popup, you can instead click on the Dev Container extension in the bottom-left of the window, which will open a dropdown at the top of the window with a "Reopen in Container" option.

1. The first time you open the dev container, it will take a while to load and build all the configured settings. Once it has already been created, it will load more quickly in the future. In both cases there should be a notification that it is connecting, with an option to show logs; clicking on that notification will open a terminal showing all the configuration happening.
    ![Connecting to Dev Container](images/connecting_to_dev_container.png)

1. In the VS Code menu, click Terminal -> New Terminal to open a terminal within the container.
1. Navigate to this guide's directory:

    ``` bash
    cd guides/implement_ai_foundry_basic_with_azure_function_integration
    ```

### 2. Configure Variables

Create a `terraform.tfvars` file:

// TODO

### 3. Deploy Infrastructure

1. From the guide directory, run the `init-backend` script to set up the terraform backend.

    ```bash
    scripts/init-backend.sh
    ```

1. Change to the terraform directory:

    ```bash
    cd terraform
    ```

1. Run the following terraform commands:

    ```bash
    terraform validate
    terraform plan
    ```

1. If the above commands succeed and the plan looks correct, run the following terraform command to deploy the changes:

    ```bash
    terraform apply
    ```

### 4. Deploy Function Code

// TODO

## Function App Implementation

### Project Structure

// TODO

### Sample Function Code

// TODO

## Local Development

### 1. Setup Local Environment

// TODO

### 2. Run Locally

// TODO

### 3. Test Locally

// TODO

## Testing in Azure

### 1. Get Function URL and Key

// TODO

### 2. Test the Deployed Function

// TODO

## AI Model Deployment in AI Foundry

### 1. Access AI Foundry

// TODO

### 2. Deploy a Model

// TODO

### 3. Update Function Configuration

// TODO

## Security Best Practices

### 1. Managed Identity Configuration

// TODO

### 2. Network Security

// TODO

### 3. Key Vault Integration

// TODO

## Monitoring and Diagnostics

### Application Insights

// TODO

### Function App Logs

// TODO

## Troubleshooting

### Common Issues

1. **Authentication Errors**

// TODO

1. **Deployment Failures**

// TODO

1. **Permission Issues**

// TODO

## Clean Up

// TODO

## Cost Optimization

### Recommendations

// TODO (IDK if we want to include this or not)

### Cost Estimation

// TODO (IDK if we want to include this or not)

## CI/CD Integration

### GitHub Actions Example

// TODO

## Support and Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/)
- [Azure Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure AI ML SDK](http://learn.microsoft.com/en-us/python/api/azure-ai-ml/azure.ai.ml?view=azure-python)

## License

// TODO

## Contributing

Please submit issues and pull requests for improvements to this guide.
