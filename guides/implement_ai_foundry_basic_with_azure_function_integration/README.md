# AI Foundry Basic with Azure Function Integration - Implementation Guide

> **Educational Guide**: This implementation guide is designed for learning and experimentation. Some security features (like function authentication) are simplified for educational clarity. Production deployments should follow Azure security best practices.

## Overview

This guide demonstrates how to extend the CAIRA `foundry_basic` reference architecture with Azure Functions to enable serverless AI agent capabilities. The solution builds upon the existing foundry_basic pattern and adds Azure Functions for serverless AI integration using Azure AI Foundry Projects SDK.

## Architecture Components

![Architecture Diagram](./images/architecture.mermaid.png)

- **Azure AI Foundry**: AI services and project management (via foundry_basic module)
- **Azure AI Project**: Organized workspace for AI agents (via foundry_basic module)
- **Azure Function App**: Serverless compute with system-assigned managed identity
- **Application Insights**: Monitoring and diagnostics (via foundry_basic module)
- **Log Analytics**: Centralized logging (via foundry_basic module)

## Project Structure

The implementation consists of:

- **function-app/** - Azure Function application code using AI Projects SDK
- **terraform/** - Infrastructure as Code for the function layer
- **scripts/** - Automation and configuration scripts
- **tests/** - Unit and integration tests

## Key Implementation Details

### Azure AI Foundry Integration

The function app uses the **Azure AI Projects SDK** to:

- Create and manage AI agents with tools (code interpreter, file search)
- Maintain conversation threads for context retention
- Connect to AI Foundry projects using managed identity authentication

### Authentication Method

- **DefaultAzureCredential** for seamless authentication
- **System-assigned Managed Identity** in Azure
- RBAC roles automatically assigned via Terraform

## Prerequisites

### Required Tools

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (version 2.50+)
- [Terraform](https://developer.hashicorp.com/terraform) (version 1.13+)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) (version 4.x)
- [Python](https://www.python.org/downloads/) (version 3.11+)

### Azure Requirements

- Active Azure subscription with sufficient permissions
- App Service Plan quota in target region (B1 tier or higher)
- Azure AI Foundry service availability in your region

## Quick Start

### (Optional) VS Code Development Container

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
1. Install the Azure Functions Core Tools (will be needed for deploying the Azure Function):

   ``` bash
   sudo apt-get install azure-functions-core-tools-4
   ```

### 1. Clone and Setup

Navigate to this guide's directory:

```bash
cd guides/implement_ai_foundry_basic_with_azure_function_integration
```

### 2. Login to Azure

```bash
az login
az account set --subscription <your-subscription-id>

# Make subscription ID available to terraform providers as environment variable
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
```

### 3. Configure Variables

The function layer expects outputs from a deployed foundry_basic instance. First deploy foundry_basic, then create a `terraform.tfvars` file with its outputs:

```bash
cd terraform
cat > terraform.tfvars <<EOF
# Outputs from foundry_basic deployment
foundry_resource_group_name        = "rg-from-foundry-basic"
foundry_ai_foundry_name            = "cog-from-foundry-basic"
foundry_ai_foundry_id              = "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/..."
foundry_ai_foundry_project_id      = "/subscriptions/.../projects/..."
foundry_ai_foundry_project_name    = "project-name-from-foundry-basic"
foundry_application_insights_name  = "appi-from-foundry-basic"
foundry_application_insights_id    = "/subscriptions/.../components/..."
foundry_log_analytics_workspace_id = "/subscriptions/.../workspaces/..."

# Function-specific configuration
project_name      = "ai-integration"
function_sku_size = "B1"
python_version    = "3.11"
tags = {
  Environment = "dev"
  Project     = "AI-Functions"
}
EOF
```

## Deployment Steps

### Step 1: Deploy Foundry Basic (if not already deployed)

First, deploy the foundry_basic reference architecture:

```bash
cd ../../reference_architectures/foundry_basic
terraform init
terraform plan
terraform apply
```

After deployment, capture the outputs you'll need:

```bash
# Save outputs for the function layer
terraform output resource_group_name
terraform output ai_foundry_name
terraform output ai_foundry_id
terraform output ai_foundry_project_id
terraform output ai_foundry_project_name
terraform output application_insights_id
terraform output log_analytics_workspace_id
```

### Step 2: Configure Function Layer Variables

Navigate to the function integration terraform directory and create your configuration:

```bash
cd guides/implement_ai_foundry_basic_with_azure_function_integration/terraform
```

Create `terraform.tfvars` using the outputs from Step 1:

```hcl
# Required inputs from foundry_basic deployment
foundry_resource_group_name        = "<output from Step 1>"
foundry_ai_foundry_name            = "<output from Step 1>"
foundry_ai_foundry_id              = "<output from Step 1>"
foundry_ai_foundry_project_id      = "<output from Step 1>"
foundry_ai_foundry_project_name    = "<output from Step 1>"

# Extract the Application Insights name from its ID
# Format: /subscriptions/.../resourceGroups/.../providers/microsoft.insights/components/NAME
foundry_application_insights_name  = "<last segment of application_insights_id>"
foundry_application_insights_id    = "<output from Step 1>"
foundry_log_analytics_workspace_id = "<output from Step 1>"

# Function-specific configuration
project_name      = "ai-integration"
function_tier     = "Dedicated"
function_sku_size = "B1"
python_version    = "3.11"

tags = {
  Environment = "dev"
  Project     = "AI-Functions"
}
```

### Step 3: Deploy Function Infrastructure

Deploy the function infrastructure with Terraform. This will:

- Create a Function App with system-assigned managed identity
- Create a storage account for the Function App
- Configure all necessary RBAC role assignments automatically:
  - Cognitive Services Contributor on AI Foundry
  - Cognitive Services User on AI Foundry
  - Storage roles for Function App operation
- Set up Application Insights integration
- Configure the Function App with the AI Foundry endpoint

```bash
terraform init
terraform plan  # Review the resources that will be created
terraform apply
```

The Terraform configuration automatically:

- Assigns the managed identity proper roles to access AI Foundry Project
- Configures the Function App settings with the correct AI Foundry endpoint
- Sets up authentication using managed identity (no keys required)

### Step 4: Deploy Function Code

```bash
cd ../function-app

# Get the Function App name from Terraform output
FUNCTION_APP_NAME=$(cd ../terraform && terraform output -raw function_app_name)

# Deploy the Python function code
func azure functionapp publish $FUNCTION_APP_NAME --python --build remote
```

The `--build remote` flag ensures dependencies are built in Azure's environment, which is crucial for Python functions.

### Step 5: Verify Deployment

```bash
# Return to terraform directory
cd ../terraform

# Test health endpoint
curl $(terraform output -raw function_app_url)/api/health | jq .

# Expected response should show:
# - "status": "healthy"
# - "ai_foundry": { "client_initialized": true }
# - Agent information if any exist
```

## Function Endpoints

### 1. Health Check (`/api/health`)

- **Method**: GET
- **Auth**: Anonymous
- **Purpose**: Verifies Function App and AI Foundry connectivity
- **Response**: JSON with configuration and connection status

### 2. Create Agent (`/api/agent/create`)

- **Method**: POST
- **Auth**: Anonymous
- **Purpose**: Create a new AI agent with specified capabilities
- **Request Body**:

  ```json
  {
    "name": "assistant-name",
    "instructions": "You are a helpful assistant",
    "model": "gpt-4",
    "enable_code_interpreter": true,
    "enable_file_search": false
  }
  ```

### 3. Chat with Agent (`/api/agent/chat`)

- **Method**: POST
- **Auth**: Anonymous
- **Purpose**: Have conversations with AI agents
- **Request Body**:

  ```json
  {
    "message": "Your message here",
    "thread_id": "optional-thread-id"
  }
  ```

### 4. List Agents (`/api/agent/list`)

- **Method**: GET
- **Auth**: Anonymous
- **Purpose**: List all agents in the AI Foundry project
- **Response**: JSON array of available agents

### 5. Delete Agent (`/api/agent/delete`)

- **Method**: POST
- **Auth**: Anonymous
- **Purpose**: Delete an agent by ID
- **Request Body**:

  ```json
  {
    "agent_id": "agent-id-to-delete"
  }
  ```

### 6. Demo (`/api/demo`)

- **Method**: GET
- **Auth**: Anonymous
- **Purpose**: Demonstrates agent capabilities including conversation and code interpreter

### 7. HttpExample (`/api/HttpExample`)

- **Method**: GET
- **Auth**: Anonymous
- **Purpose**: Basic connectivity test

## Testing the Deployed Functions

### Test Basic Connectivity

```bash
FUNCTION_URL=$(terraform output -raw function_app_url)
curl "$FUNCTION_URL/api/HttpExample?name=Azure"
```

### Test Health Check

```bash
curl "$FUNCTION_URL/api/health" | jq .
```

### Create an Agent

```bash
curl -X POST "$FUNCTION_URL/api/agent/create" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-assistant",
    "instructions": "You are a helpful AI assistant",
    "enable_code_interpreter": true
  }' | jq .
```

### Chat with Agent

```bash
curl -X POST "$FUNCTION_URL/api/agent/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Azure Functions?"}' | jq .
```

## Local Development

> **Note**: If you're using the VS Code Dev Container, the Azure Functions Core Tools are already installed. Run these commands inside the container terminal. If you're not using the Dev Container, run these commands in your local environment.

### 1. Setup Python Environment

```bash
cd function-app
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Local Settings

```bash
cd ../scripts
./configure-local-settings.sh
```

Or manually create `function-app/local.settings.json` with the AI Foundry endpoint and project details from your deployment.

### 3. Run Locally

```bash
cd function-app
func start
```

### 4. Test Locally

```bash
# Test health
curl http://localhost:7071/api/health | jq .

# Create and chat with agent
curl -X POST http://localhost:7071/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from local development"}' | jq .
```

## Troubleshooting

### Common Issues and Solutions

#### 1. 404 Not Found on Function Endpoints

**Symptom**: `curl` returns 404 for all endpoints

**Solution**: Deploy the function code:

```bash
cd function-app
func azure functionapp publish $FUNCTION_APP_NAME --python --build remote
```

#### 2. Authorization Failed Errors

**Symptom**:

```
"AuthorizationFailed: The client '...' does not have authorization to perform action"
```

**Solution**: Role assignments are handled by Terraform. If issues persist:

```bash
cd terraform
terraform apply -refresh-only
terraform apply
```

Then restart the Function App:

```bash
az functionapp restart --name $FUNCTION_APP_NAME --resource-group $(terraform output -raw resource_group_name)
```

#### 3. Function Deployment Fails

**Symptom**: `func azure functionapp publish` fails

**Solutions**:

- Ensure you're logged in: `az login`
- Check correct subscription: `az account show`
- Verify Function App exists: `az functionapp list --resource-group $RESOURCE_GROUP`
- Use `--build remote` flag: `func azure functionapp publish $FUNCTION_APP_NAME --python --build remote`

#### 5. Local Development Authentication Issues

**Symptom**: DefaultAzureCredential fails locally

**Solution**: Login to Azure CLI:

```bash
az login
az account set --subscription <your-subscription-id>
```

### Debugging Commands

```bash
# Stream Function App logs
az webapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

# Check Function App configuration
az functionapp config appsettings list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --output table

# Verify managed identity
az functionapp identity show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

# Check deployed functions
az functionapp function list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --output table
```

## Testing

The implementation includes both Python unit tests and Terraform integration tests. To run tests:

```bash
# Python tests
cd function-app
pytest

# Terraform tests
cd terraform
terraform test
```

## Monitoring

### Application Insights

```bash
# View recent logs
az monitor app-insights query \
  --app $(terraform output -raw application_insights_name) \
  --resource-group $RESOURCE_GROUP \
  --query "traces | take 20"
```

### Function Metrics

```bash
# View function invocations
az monitor metrics list \
  --resource $(az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query id -o tsv) \
  --metric "FunctionExecutionCount" \
  --interval PT1H
```

## Security Best Practices

### Managed Identity Configuration

- System-assigned managed identity with least-privilege RBAC roles
- No keys or secrets stored in code
- Uses DefaultAzureCredential for automatic authentication

### Network Security

- Consider implementing Private Endpoints for production (CAIRA includes private configurations)
- Use IP restrictions on Function App if needed
- Enable CORS only for trusted domains

### Key Management

- Function keys for sensitive endpoints
- Rotate keys regularly
- Use Azure Key Vault for additional secrets

## Cost Optimization

- **Function App**:
  - Consumption plan: Pay-per-execution model for sporadic usage
  - B1 App Service Plan: Fixed monthly cost for consistent load
- **AI Foundry**:
  - Pay-per-token for AI models
  - Agent usage based on model selected
- **Storage**: Minimal cost for Function App storage
- **Monitoring**: Application Insights costs scale with telemetry volume

## Clean Up

Remove all resources:

```bash
cd terraform
terraform destroy -auto-approve
```

## Known Limitations

- AI Foundry Projects is evolving; some features may change
- Model availability varies by region
- Function consumption plan has cold start delays
- The foundry_basic module must be deployed first
- Agent capabilities depend on deployed models in foundry_basic

## Support and Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-services/)
- [Azure AI Projects SDK Documentation](https://learn.microsoft.com/en-us/azure/ai-studio/)
- [Azure Functions Python Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
- [CAIRA Reference Architectures](../../reference_architectures/)

## Contributing

Please submit issues and pull requests for improvements to this guide. See the main [CAIRA Contributing Guide](../../CONTRIBUTING.md) for detailed information.
