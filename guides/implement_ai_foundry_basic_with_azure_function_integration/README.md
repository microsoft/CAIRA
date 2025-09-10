# AI Foundry Basic with Azure Function Integration - Implementation Guide

## Overview

This guide provides a complete Infrastructure as Code (IaC) solution for deploying AI Foundry Basic Reference Architecture integrated with Azure Functions using Terraform. The solution enables secure, serverless compute capabilities with AI Foundry's AI models.

## Project Directory Structure

```plaintext
guides/implement_ai_foundry_basic_with_azure_function_integration/
├── function-app/                    # Azure Function application code
│   ├── __pycache__/                 # Python cache (auto-generated)
│   ├── .python_packages/            # Function app packages (deployment)
│   ├── .venv/                       # Virtual environment (local dev)
│   ├── function_app.py              # Main function implementation
│   ├── host.json                    # Function app global configuration
│   ├── local.settings.json          # Local development settings
│   └── requirements.txt             # Python dependencies
├── images/                          # Documentation images
├── scripts/                         # Automation scripts
│   ├── configure-local-settings.sh  # Configure local development
│   ├── create-function-tfvars.sh    # Generate Function App terraform.tfvars
│   └── init-backend.sh              # Initialize Terraform backend
├── terraform/                       # Infrastructure as Code
│   ├── ai_hub/                      # AI Hub infrastructure
│   │   ├── backend.tf               # Backend configuration
│   │   ├── locals.tf                # Local variables
│   │   ├── main.tf                  # Main resources
│   │   ├── outputs.tf               # Output values
│   │   ├── providers.tf             # Provider configuration
│   │   ├── terraform.tfvars.example # Example variables file
│   │   ├── variables.tf             # Variable definitions
│   │   └── versions.tf              # Version constraints
│   └── azure_function/              # Function App infrastructure
│       ├── backend.tf               # Backend configuration
│       ├── locals.tf                # Local variables
│       ├── main.tf                  # Main resources
│       ├── outputs.tf               # Output values
│       ├── providers.tf             # Provider configuration
│       ├── terraform.tfvars.example # Example variables file
│       ├── variables.tf             # Variable definitions
│       └── versions.tf              # Version constraints
└── README.md                        # This guide
```

## Complete Resource Files

All code and configuration files referenced in this guide are located in the same repository folder structure shown above. Key files include:

### Terraform Files

- **terraform/ai_hub/**: Complete Terraform module for AI Foundry Hub deployment
- **terraform/azure_function/**: Complete Terraform module for Function App deployment

### Scripts

- **scripts/init-backend.sh**: Automated Terraform backend initialization
- **scripts/create-function-tfvars.sh**: Auto-generates Function App variables from AI Hub outputs
- **scripts/configure-local-settings.sh**: Sets up local development environment

### Function App Code

- **function-app/function_app.py**: Complete Python implementation with DefaultAzureCredential
- **function-app/requirements.txt**: All required Python packages
- **function-app/host.json**: Function runtime configuration

## Architecture Components

- **Azure AI Hub** (AI Foundry): Central workspace for AI models and experiments
- **Azure AI Project**: Connected project for organizing AI workloads
- **Azure Function App**: Serverless compute with system-assigned managed identity
- **Azure Key Vault**: Secure storage for secrets and keys
- **Application Insights**: Monitoring and diagnostics
- **Storage Accounts**: Data storage for AI Hub and Function App (with key-disabled policy workarounds)

## Using GitHub Copilot for Implementation

When implementing this solution, GitHub Copilot can assist with code generation. Here are effective prompts:

### For Terraform Resources

```plaintext
# Prompt: "Create an Azure Machine Learning workspace with system-assigned identity and Key Vault integration"
# Prompt: "Add a Function App with managed identity that can access the ML workspace"
```

### For Python Functions

```plaintext
# Prompt: "Create an Azure Function that uses DefaultAzureCredential to authenticate with AI Foundry"
# Prompt: "Implement error handling for AI model endpoint calls with retry logic"
```

### For Scripts

```plaintext
# Prompt: "Create a bash script that reads Terraform outputs and generates a tfvars file"
# Prompt: "Write a script to configure local.settings.json from deployed resources"
```

## HVE (HyperVelocity Engineering) Prompts

For step-by-step guidance, use these Copilot prompts at each stage:

### Initial Setup

1. "How do I get the principal ID for the foundry instance?"
   - Copilot will guide you to use Terraform outputs or Azure CLI commands

1. "Generate Terraform code for Azure Machine Learning workspace with AI Hub kind"
   - Note: Current limitation requires CLI workaround for Hub kind

### Function Development

1. "Create a Python Azure Function that calls an AI model endpoint using managed identity"
   - Ensures DefaultAzureCredential usage

1. "Add retry logic and error handling for AI model calls in Azure Functions"
   - Implements production-ready resilience

### Testing & Deployment

1. "Generate curl commands to test my Azure Function locally and in Azure"
   - Creates test scenarios for both environments

1. "Create a script to deploy my function app and configure app settings from Terraform outputs"
   - Automates the deployment pipeline

## Prerequisites

### Required Tools

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest) (version 2.50+)
- [Terraform](https://developer.hashicorp.com/terraform) (version 1.5.0+)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=windows%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-csharp) (version 4.x)
- [Python](https://www.python.org/downloads/) (version 3.9+)
- jq (for JSON parsing in scripts)

### Azure Requirements

- Active Azure subscription with App Service quota
- Sufficient permissions to create resources
- Contributor or Owner role at subscription level
- App Service Plan quota in target region (B1 tier or higher for Function Apps)

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

1. Install the Azure Functions Core Tools (will be needed for deploying the Azure Function):

   ``` bash
   sudo apt-get install azure-functions-core-tools-4
   ```

1. Log in to the Azure CLI and choose the subscription you wish to deploy to:

   ```bash
   az login
   ```

### 2. Configure Variables

Create terraform.tfvars files for both AI Hub and Function App:

#### AI Hub Configuration

```bash
# From the guide root directory
cd terraform/ai_hub
cat > terraform.tfvars <<EOF
resource_group_name = "rg-ai-foundry-demo"
location            = "westus2"  # Or your preferred region with quota
environment         = "dev"
project_name        = "aifoundry"
EOF
```

#### Function App Configuration (After AI Hub Deployment)

The Function App configuration is auto-generated from AI Hub outputs using the provided script.

### 3. Deploy Infrastructure

#### Step 1: Deploy AI Hub

```bash
# From the guide root directory
cd terraform/ai_hub
terraform init
terraform validate
terraform plan
terraform apply
```

This deploys:

- AI Hub (Machine Learning Workspace)
- AI Project
- Key Vault
- Application Insights
- Storage Account (with keys disabled via Azure CLI workaround)

#### Step 2: Configure Function App

```bash
# Generate Function App configuration from AI Hub outputs
cd ../.. # return to root guide directory
scripts/create-function-tfvars.sh
```

#### Step 3: Deploy Function App

```bash
cd terraform/azure_function
terraform init
terraform validate
terraform plan
terraform apply
```

This deploys:

- App Service Plan (B1 tier recommended)
- Function App with Python 3.11 runtime
- Storage Account for Function App
- Role assignments for AI Hub access

### 4. Deploy Function Code

The function app implementation is provided in the `function-app/` directory.

#### Deploy to Azure

```bash
# Navigate to the function app directory
cd function-app

# Get the function app name from Terraform outputs
FUNCTION_APP_NAME=$(cd ../terraform/azure_function && terraform output -raw function_app_name)

# Deploy using Azure Functions Core Tools
func azure functionapp publish $FUNCTION_APP_NAME --python
```

## Function App Implementation

The function app implementation provided in the `function-app/` directory includes:

### Key Files

- **function_app.py**: Main function implementation with HTTP trigger endpoints
- **host.json**: Function app global configuration settings
- **requirements.txt**: Python dependencies for AI integration
- **local.settings.json**: Local development settings (generated via script)

### DefaultAzureCredential Implementation

The function app uses `DefaultAzureCredential` from Azure Identity library for seamless authentication:

```python
# function_app.py excerpt
from azure.identity import DefaultAzureCredential
from azure.ai.ml import MLClient

# Initialize with DefaultAzureCredential - works both locally and in Azure
credential = DefaultAzureCredential()

# Connect to AI Foundry using managed identity in Azure, or user credentials locally
ml_client = MLClient(
    credential=credential,
    subscription_id=os.getenv("AZURE_SUBSCRIPTION_ID"),
    resource_group_name=os.getenv("AI_RESOURCE_GROUP"),
    workspace_name=os.getenv("AI_HUB_NAME")
)
```

This approach ensures:

- **In Azure**: Uses the Function App's system-assigned managed identity
- **Locally**: Uses your Azure CLI credentials (`az login`)
- **No code changes required** between environments

### Key Features

- **AI Model Integration**: Pre-configured to connect with deployed AI models
- **Managed Identity**: Uses system-assigned identity for secure authentication
- **Environment Variables**: Automatic configuration from Terraform outputs
- **Error Handling**: Comprehensive error handling and logging
- **Response Formatting**: Standardized JSON responses

## Local Development

### 1. Setup Local Environment

Configure local settings using the provided script:

```bash
cd scripts
./configure-local-settings.sh
```

This script automatically generates the `local.settings.json` file with the correct values from your deployed infrastructure.

### 2. Install Dependencies

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install required packages
pip install -r requirements.txt
```

### 3. Run Locally

```bash
# Start the function app locally
func start
```

The function will be available at: `http://localhost:7071/api/`

### 4. Test Locally

```bash
# Test with query parameter
curl "http://localhost:7071/api/HttpTrigger?name=Test"

# Test with JSON body
curl -X POST http://localhost:7071/api/HttpTrigger \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
```

## Testing in Azure

### 1. Get Function URL

```bash
# Get the function app base URL
FUNCTION_APP_NAME=$(cd terraform/azure_function && terraform output -raw function_app_name)
echo "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/"

# For FUNCTION level auth, get the function keys:
az functionapp keys list \
  --resource-group rg-ai-foundry-demo \
  --name ${FUNCTION_APP_NAME}
```

### 2. Test the Deployed Function

```bash
# Test the deployed function (adjust endpoint based on your function_app.py routes)
FUNCTION_URL="https://${FUNCTION_APP_NAME}.azurewebsites.net/api/HttpTrigger"
curl "${FUNCTION_URL}?name=Azure"
```

## AI Model Deployment in AI Foundry

### 1. Access AI Foundry

Navigate to the Azure Machine Learning workspace (since Terraform creates standard ML workspaces):

1. Go to [Azure Portal](https://portal.azure.com)
1. Navigate to your resource group: `rg-ai-foundry-demo`
1. Open the AI Hub: `hub-aifoundry-dev-<suffix>`
1. Click "Launch studio"

Or directly access: <https://ml.azure.com>

### 2. Deploy a Model

1. In Azure Machine Learning Studio:
   - Navigate to "Models" → "Model catalog"
   - Select a model (e.g., GPT-4, Llama 2)
   - Click "Deploy" → "Real-time endpoint"
   - Configure deployment settings
   - Deploy the model

1. Get the endpoint details:
   - Navigate to "Endpoints"
   - Select your deployed model
   - Copy the REST endpoint URL and key

### 3. Update Function Configuration

Add model endpoint to Function App settings:

```bash
az functionapp config appsettings set \
  --name ${FUNCTION_APP_NAME} \
  --resource-group rg-ai-foundry-demo \
  --settings "MODEL_ENDPOINT=<your-endpoint-url>" "MODEL_KEY=<your-key>"
```

## Security Best Practices

### 1. Managed Identity Configuration

The Function App uses system-assigned managed identity with the following roles:

- **Contributor** on AI Hub and AI Project
- **Storage Blob Data Contributor** on AI Hub storage
- **Key Vault Secrets User** on Key Vault

### 2. Network Security

- Storage accounts have key access disabled (AI Hub) or enabled (Function App) based on requirements
- Function App can be configured with IP restrictions via `allowed_ip_ranges` variable

### 3. Key Vault Integration

Store sensitive configuration in Key Vault:

```bash
# Store secret in Key Vault
az keyvault secret set \
  --vault-name kv-aifoundr-dev-<suffix> \
  --name "model-api-key" \
  --value "<your-api-key>"

# Reference in Function App
az functionapp config appsettings set \
  --name ${FUNCTION_APP_NAME} \
  --resource-group rg-ai-foundry-demo \
  --settings "MODEL_KEY=@Microsoft.KeyVault(SecretUri=https://kv-aifoundr-dev-<suffix>.vault.azure.net/secrets/model-api-key/)"
```

## Monitoring and Diagnostics

### Application Insights

View logs and metrics:

```bash
# Query recent traces
az monitor app-insights query \
  --app appi-aifoundry-dev-<suffix> \
  --resource-group rg-ai-foundry-demo \
  --query "traces | take 20"

# View exceptions
az monitor app-insights query \
  --app appi-aifoundry-dev-<suffix> \
  --resource-group rg-ai-foundry-demo \
  --query "exceptions | take 10"
```

### Function App Logs

Stream live logs:

```bash
az webapp log tail \
  --name ${FUNCTION_APP_NAME} \
  --resource-group rg-ai-foundry-demo
```

## Troubleshooting

### Common Issues

1. **Storage Key Policy Errors**
   - **Issue**: `403 Key based authentication is not permitted`
   - **Solution**: The deployment uses Azure CLI workarounds to create storage with appropriate key settings

1. **Function App Quota Errors**
   - **Issue**: `Current Limit (Free VMs): 0`
   - **Solution**: Use B1 tier instead of F1, or check quota in different regions:

   ```bash
   az appservice plan create --name test --resource-group test --location westus2 --sku B1 --is-linux
   ```

1. **Permission Issues**
   - **Issue**: Function App can't access AI Hub resources
   - **Solution**: Verify role assignments:

   ```bash
   PRINCIPAL_ID=$(az functionapp identity show --name ${FUNCTION_APP_NAME} --resource-group rg-ai-foundry-demo --query principalId -o tsv)
   az role assignment list --assignee ${PRINCIPAL_ID} --output table
   ```

1. **Python Dependencies**
   - **Issue**: Module import errors in Azure
   - **Solution**: Ensure all dependencies are listed in `requirements.txt` and redeploy

## Clean Up

Remove all resources:

```bash
# Destroy Function App first
cd terraform/azure_function
terraform destroy -auto-approve

# Destroy AI Hub
cd ../ai_hub
terraform destroy -auto-approve

# Delete backend storage (optional)
az group delete --name rg-terraform-state --yes

# Verify cleanup
az group list --query "[?contains(name, 'ai-foundry')]" -o table
```

## Cost Optimization

### Recommendations

- **Function App**: Use Consumption plan (Y1) for development, B1 for production
- **Storage**: Use LRS replication for non-critical data
- **AI Models**: Start with smaller models for testing
- **Application Insights**: Configure sampling for high-volume scenarios

### Cost Estimation

Approximate monthly costs (varies by region and usage):

- B1 App Service Plan: ~$55/month
- Storage Accounts: ~$20/month (minimal usage)
- Application Insights: ~$5/month (low volume)
- AI Model endpoints: Pay-per-token (varies by model)

## Known Limitations

- Terraform AzureRM provider doesn't support AI Foundry Hub/Project kinds (uses standard ML workspaces)
- Storage accounts with disabled keys require CLI workarounds for Terraform
- Function Apps require storage keys enabled (B1 tier avoids file share requirement)

## Support and Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/)
- [Azure Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure AI ML SDK](http://learn.microsoft.com/en-us/python/api/azure-ai-ml/azure.ai.ml?view=azure-python)

## Contributing

Please submit issues and pull requests for improvements to this guide.

### Tracking Friction Points

When encountering issues or friction points during implementation:

1. **Document the issue** in the repository's Issues section with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Workaround if found
   - Label as `friction-point` or `enhancement`

1. **Create work items** for the CAIRA team to address:
   - Use the issue template for consistency
   - Link to relevant code or documentation
   - Suggest potential solutions

1. **Current known friction points** are documented in:
   - **Troubleshooting** section of this guide
   - **Known Limitations** section
   - GitHub Issues with `friction-point` label

This feedback helps improve the guide and tooling for future implementations.
