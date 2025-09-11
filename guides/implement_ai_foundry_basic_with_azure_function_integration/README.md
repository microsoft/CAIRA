# AI Foundry Basic with Azure Function Integration - Implementation Guide

## Overview

This guide provides a complete Infrastructure as Code (IaC) solution for deploying AI Foundry Basic Reference Architecture integrated with Azure Functions using Terraform. The solution enables secure, serverless compute capabilities with AI models deployed to Azure AI Foundry.

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
│   ├── deploy-ai-model.sh           # Deploy model to AI Foundry
│   └── init-backend.sh              # Initialize Terraform backend
├── terraform/                       # Infrastructure as Code
│   ├── function.tf                  # Function resources
│   ├── main.tf                      # Main resources
│   ├── outputs.tf                   # Output values
│   ├── providers.tf                 # Provider configuration
│   ├── terraform.tfvars.example     # Example variables file
│   ├── variables.tf                 # Variable definitions
└── README.md                        # This guide
```

## Complete Resource Files

All code and configuration files referenced in this guide are located in the same repository folder structure shown above. Key files include:

### Terraform Files

- **terraform**: Complete Terraform module for Function App deployment

### Scripts

- **scripts/init-backend.sh**: Automated Terraform backend initialization
- **scripts/create-function-tfvars.sh**: Auto-generates Function App variables from AI Hub outputs
- **scripts/configure-local-settings.sh**: Sets up local development environment with AI Foundry endpoints
- **scripts/deploy-ai-model.sh**: Deploys a model to AI Foundry workspace

### Function App Code

- **function-app/function_app.py**: Complete Python implementation with DefaultAzureCredential for AI Foundry
- **function-app/requirements.txt**: Python packages for AI Foundry integration
- **function-app/host.json**: Function runtime configuration

## Architecture Components

- **Azure AI Hub** (AI Foundry): Central workspace for AI models and experiments
- **Azure AI Project**: Connected project for organizing AI workloads
- **Azure Function App**: Serverless compute with system-assigned managed identity
- **AI Model Endpoint**: Managed or serverless endpoint in AI Foundry
- **Azure Key Vault**: Secure storage for secrets and keys
- **Application Insights**: Monitoring and diagnostics
- **Storage Accounts**: Data storage for AI Hub and Function App

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
# Prompt: "Create a bash script that deploys a model to Azure ML workspace"
# Prompt: "Write a script to configure local.settings.json from AI Foundry endpoints"
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

- Active Azure subscription
- Sufficient permissions to create resources
- Contributor or Owner role at subscription level
- App Service Plan quota in target region (B1 tier or higher for Function Apps)
- **ML Compute Quota** in target region (see note below)

> **Note on ML Compute Quota**: Deploying models to AI Foundry requires ML compute quota in your Azure subscription. If you encounter quota limitations (showing 0 for all ML compute families), you have two options:
>
> 1. Request ML compute quota increase via Azure Support (recommended for production)
> 1. Use Azure OpenAI Service as an alternative (requires minimal code changes)

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
cd terraform
cat > terraform.tfvars <<EOF
resource_group_name = "rg-ai-foundry-demo"
location            = "westus2"  # Or your preferred region with ML quota
environment         = "dev"
project_name        = "aifoundry"
EOF
```

#### Function App Configuration (After AI Hub Deployment)

The Function App configuration is auto-generated from AI Hub outputs using the provided script.

## Deployment Steps

### Step 1: Deploy Azure Function Infrastructure

Deploy the Function App and supporting resources:

```bash
# From the guide root directory
cd terraform

# Ensure you are logged into the correct azure subscription
az login

# Make subscription ID available to terraform providers as environment variable
export ARM_SUBSCIRPTION_ID=$(az show --query id -o tsv)

# Deploy Function App
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

### Step 2: Configure and Deploy Function Code

Configure and deploy the function app code:

```bash
# From the guide root directory
scripts/configure-local-settings.sh

# Deploy function code
cd function-app
FUNCTION_APP_NAME=$(cd ../terraform/azure_function && terraform output -raw function_app_name)
func azure functionapp publish $FUNCTION_APP_NAME --python
```

## Function App Implementation

The function app implementation provided in the `function-app/` directory includes:

### Key Files

- **function_app.py**: Main function implementation with AI Foundry integration
- **host.json**: Function app global configuration settings
- **requirements.txt**: Python dependencies (azure-functions, azure-ai-ml, azure-identity)
- **local.settings.json**: Local development settings (generated via script)

### Function Endpoints

The deployed function app includes three endpoints:

#### 1. HttpExample Endpoint

- **Route**: `/api/HttpExample`
- **Purpose**: Basic connectivity test
- **Auth**: Anonymous

#### 2. Chat Endpoint

- **Route**: `/api/chat`
- **Purpose**: AI-powered chat using AI Foundry model
- **Auth**: Function key required
- **Authentication**: DefaultAzureCredential (Managed Identity in Azure, CLI locally)

#### 3. Health Check Endpoint

- **Route**: `/api/health`
- **Purpose**: Verify configuration and AI Foundry connectivity
- **Auth**: Anonymous

### DefaultAzureCredential Implementation

The function app uses `DefaultAzureCredential` for seamless authentication:

```python
from azure.identity import DefaultAzureCredential
from azure.ai.ml import MLClient

# Initialize with DefaultAzureCredential
credential = DefaultAzureCredential()

# Connect to AI Foundry
ml_client = MLClient(
    credential=credential,
    subscription_id=os.getenv("AI_SUBSCRIPTION_ID"),
    resource_group_name=os.getenv("AI_RESOURCE_GROUP"),
    workspace_name=os.getenv("AI_HUB_NAME")
)
```

This ensures:

- **In Azure**: Uses Function App's system-assigned managed identity
- **Locally**: Uses your Azure CLI credentials
- **No code changes** required between environments

## Local Development

### 1. Setup Local Environment

Configure local settings using the provided script:

```bash
cd scripts
./configure-local-settings.sh
```

This script automatically:

- Retrieves AI Hub configuration from Terraform outputs
- Finds deployed model endpoints in AI Foundry
- Generates local.settings.json with endpoint details

### 2. Install Dependencies

```bash
# Navigate to function app directory
cd ../function-app

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
# Test HttpExample endpoint
curl "http://localhost:7071/api/HttpExample?name=Local"

# Test chat endpoint
curl -X POST http://localhost:7071/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello from local development"}'

# Test health endpoint
curl http://localhost:7071/api/health
```

## Testing in Azure

### 1. Get Function App Details

```bash
# Get the function app name
FUNCTION_APP_NAME=$(cd terraform/azure_function && terraform output -raw function_app_name)
echo "Function App: ${FUNCTION_APP_NAME}"

# Get the base URL
echo "Base URL: https://${FUNCTION_APP_NAME}.azurewebsites.net/api/"

# For endpoints with FUNCTION level auth, get the function keys
FUNCTION_KEY=$(az functionapp keys list \
  --resource-group rg-ai-foundry-demo \
  --name ${FUNCTION_APP_NAME} \
  --query "functionKeys.default" -o tsv)
echo "Function Key: ${FUNCTION_KEY}"
```

### 2. Test the Deployed Endpoints

#### Test HttpExample (Anonymous)

```bash
# Simple test with query parameter
curl "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/HttpExample?name=Azure"

# Test with JSON body
curl -X POST "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/HttpExample" \
  -H "Content-Type: application/json" \
  -d '{"name": "Azure Functions"}'
```

#### Test Health Check (Anonymous)

```bash
# Check service health and configuration
curl "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/health"

# Pretty print the JSON response
curl -s "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/health" | python -m json.tool
```

#### Test Chat Endpoint (Function Auth Required)

```bash
# Test AI chat with function key
curl -X POST "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/chat?code=${FUNCTION_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is Azure Functions?"}'

# Test with a more complex prompt
curl -X POST "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/chat?code=${FUNCTION_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain serverless computing benefits in 3 bullet points"}' \
  | python -m json.tool
```

### 3. Verify AI Foundry Model Endpoint

```bash
# Get endpoint details
ENDPOINT_NAME=$(az ml online-endpoint list \
  --resource-group rg-ai-foundry-demo \
  --workspace-name hub-aifoundry-dev-<suffix> \
  --query "[0].name" -o tsv)

# Test the endpoint directly
az ml online-endpoint invoke \
  --name $ENDPOINT_NAME \
  --resource-group rg-ai-foundry-demo \
  --workspace-name hub-aifoundry-dev-<suffix> \
  --request-file <(echo '{"prompt": "test"}')
```

## Configuration

### Environment Variables

The function app requires these environment variables (automatically configured):

- `AI_HUB_NAME`: AI Foundry Hub name
- `AI_PROJECT_NAME`: AI Project name
- `AI_RESOURCE_GROUP`: Resource group name
- `AI_SUBSCRIPTION_ID`: Azure subscription ID
- `MODEL_ENDPOINT_NAME`: Deployed model endpoint name
- `MODEL_DEPLOYMENT_NAME`: Model deployment name

## Security Best Practices

### 1. Managed Identity Configuration

The Function App uses system-assigned managed identity with the following roles:

- **Contributor** on AI Hub and AI Project
- **Storage Blob Data Contributor** on AI Hub storage
- **Key Vault Secrets User** on Key Vault

### 2. Network Security

- Storage accounts have appropriate key access policies
- Function App can be configured with IP restrictions
- Model endpoints use key-based or token-based authentication

### 3. Key Vault Integration

Store sensitive configuration in Key Vault:

```bash
# Store endpoint key in Key Vault
az keyvault secret set \
  --vault-name kv-aifoundr-dev-<suffix> \
  --name "model-endpoint-key" \
  --value "<your-endpoint-key>"

# Reference in Function App
az functionapp config appsettings set \
  --name ${FUNCTION_APP_NAME} \
  --resource-group rg-ai-foundry-demo \
  --settings "MODEL_KEY=@Microsoft.KeyVault(SecretUri=https://kv-aifoundr-dev-<suffix>.vault.azure.net/secrets/model-endpoint-key/)"
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

1. **ML Compute Quota**
   - **Issue**: `Not enough subscription CPU quota`
   - **Solution**: Request ML compute quota via Azure Support or use serverless endpoints

1. **Storage Key Policy Errors**
   - **Issue**: `403 Key based authentication is not permitted`
   - **Solution**: The deployment uses Azure CLI workarounds to create storage with appropriate key settings

1. **Model Deployment Failures**
   - **Issue**: Model deployment fails with provisioning errors
   - **Solution**: Check compute quota, try different instance types, or use serverless deployment

1. **Permission Issues**
   - **Issue**: Function App can't access AI Hub resources
   - **Solution**: Verify role assignments:

   ```bash
   PRINCIPAL_ID=$(az functionapp identity show --name ${FUNCTION_APP_NAME} --resource-group rg-ai-foundry-demo --query principalId -o tsv)
   az role assignment list --assignee ${PRINCIPAL_ID} --output table
   ```

1. **Function App Quota Errors**
   - **Issue**: `Current Limit (Free VMs): 0`
   - **Solution**: Use B1 tier instead of F1, or check quota in different regions:

   ```bash
   az appservice plan create --name test --resource-group test --location westus2 --sku B1 --is-linux
   ```

1. **Python Dependencies**
   - **Issue**: Module import errors in Azure
   - **Solution**: Ensure all dependencies are listed in `requirements.txt` and redeploy

## Clean Up

Remove all resources:

```bash
# Delete model endpoints first
az ml online-endpoint delete \
  --name <endpoint-name> \
  --resource-group rg-ai-foundry-demo \
  --workspace-name hub-aifoundry-dev-<suffix> \
  --yes

# Delete Function App
cd terraform/azure_function
terraform destroy -auto-approve

# Delete AI Hub
cd ../ai_hub
terraform destroy -auto-approve

# Delete backend storage (optional)
az group delete --name rg-terraform-state --yes
```

## Cost Optimization

### Recommendations

- **Function App**: Use Consumption plan for development, B1 for production
- **Model Endpoints**: Use serverless when available, or smallest instance type
- **Storage**: Use LRS replication for non-critical data
- **Application Insights**: Configure sampling for high-volume scenarios

### Cost Estimation

Approximate monthly costs (varies by region and usage):

- **Function App (B1 tier)**: ~$55/month
- **Model Endpoint (DS2_v2)**: ~$150/month (managed) or pay-per-request (serverless)
- **Storage Accounts**: ~$20/month (minimal usage)
- **Application Insights**: ~$5/month (low volume)

## Known Limitations

- Terraform AzureRM provider doesn't support AI Foundry Hub/Project kinds (uses standard ML workspaces)
- ML compute quota required for managed endpoints
- Serverless model availability varies by region
- Storage accounts with disabled keys require CLI workarounds

## Support and Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/)
- [Azure Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Azure ML Model Catalog](https://learn.microsoft.com/en-us/azure/machine-learning/concept-model-catalog)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)

## Contributing

Please submit issues and pull requests for improvements to this guide. See the main [CAIRA Contributing Guide](../../CONTRIBUTING.md) for detailed information.
