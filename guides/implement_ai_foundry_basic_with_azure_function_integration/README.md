# AI Foundry Basic with Azure Function Integration

> **Educational Guide**: This guide demonstrates how easy it is to integrate Azure Functions with CAIRA's foundry_basic reference architecture for serverless AI agents.

## Overview

This guide shows you how to use CAIRA's `foundry_basic` reference architecture with Azure Functions to create serverless AI agent endpoints. The focus is on **CAIRA integration patterns** - how to connect your function layer to the AI Foundry infrastructure that foundry_basic provides.

**What You'll Learn:**

- How to consume foundry_basic outputs in your function layer
- Managed identity patterns for keyless authentication with AI Foundry
- Agent lifecycle management through serverless endpoints
- Monitoring integration with Application Insights

## Architecture Components

![Architecture Diagram](./images/architecture.mermaid.png)

**From foundry_basic (what CAIRA provides):**

- Azure AI Foundry account and project workspace
- Application Insights for monitoring
- Log Analytics for centralized logging
- All configured with managed identities and RBAC

**What we're adding (the function layer):**

- Azure Function App with Python 3.11 and Azure AI Projects SDK
- System-assigned managed identity for keyless auth
- Storage account for function runtime
- RBAC role assignments connecting to AI Foundry
- RESTful HTTP endpoints for agent operations

**The Integration:** Your function app connects to AI Foundry using the managed identity pattern - no keys, no secrets, just RBAC roles that Terraform manages automatically.

## Understanding the CAIRA Integration

### The Connection Pattern

This guide demonstrates a clean separation of concerns:

1. **Foundation Layer** (foundry_basic): Manages AI Foundry infrastructure
1. **Function Layer** (this guide): Consumes foundry_basic outputs and provides application endpoints
1. **Integration Layer**: Terraform data sources and managed identity RBAC

**Key Integration Point:**

```hcl
# In your function layer terraform - reference existing AI Foundry
data "azurerm_cognitive_account" "ai_foundry" {
  name                = var.foundry_ai_foundry_name # From foundry_basic output
  resource_group_name = var.foundry_resource_group_name
}

# Grant function access using managed identity
resource "azurerm_role_assignment" "function_ai_foundry_user" {
  scope                = var.foundry_ai_foundry_id # From foundry_basic output
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
```

See the complete implementation in [`terraform/main.tf`](terraform/main.tf) and [`terraform/function.tf`](terraform/function.tf).

## Building the Solution Step by Step

### Part 1: Understanding the Terraform Infrastructure

The function layer terraform creates three key resources that connect to your AI Foundry deployment:

**1. Storage Account** ([`function.tf`](terraform/function.tf) lines 5-35)

- **Key security decision**: `shared_access_key_enabled = false` forces managed identity usage
- No connection strings, no keys to manage

**2. Function App** ([`function.tf`](terraform/function.tf) lines 53-103)

```hcl
# Critical settings for CAIRA integration:
storage_uses_managed_identity = true # Keyless storage access
identity {
  type = "SystemAssigned" # Azure creates and manages the identity
}
app_settings = {
  "AI_FOUNDRY_ENDPOINT"     = local.ai_foundry_endpoint # From foundry_basic
  "AI_FOUNDRY_PROJECT_NAME" = var.foundry_ai_foundry_project_name
  "AI_FOUNDRY_PROJECT_ID"   = var.foundry_ai_foundry_project_id
}
```

**3. RBAC Role Assignment** ([`function.tf`](terraform/function.tf) lines 105-113)

```hcl
# This is what connects your function to AI Foundry - no keys needed!
resource "azurerm_role_assignment" "function_ai_foundry_user" {
  scope                = var.foundry_ai_foundry_id # AI Foundry resource ID
  role_definition_name = "Cognitive Services User" # Minimal permissions needed
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
```

**Why these settings matter**: The managed identity pattern means no secrets in your code or configuration. Terraform handles the entire permission chain automatically.

See complete infrastructure code: [`terraform/function.tf`](terraform/function.tf)

### Part 2: Connecting Function Layer to foundry_basic

Your function layer receives foundry_basic outputs as input variables. See [`terraform/variables.tf`](terraform/variables.tf) for the complete interface.

**Critical pattern** - Data sources discover existing resources:

```hcl
# Reference the AI Foundry that foundry_basic created
data "azurerm_cognitive_account" "ai_foundry" {
  name                = var.foundry_ai_foundry_name # From foundry_basic output
  resource_group_name = var.foundry_resource_group_name
}

# Use its endpoint in your function configuration
locals {
  ai_foundry_endpoint = data.azurerm_cognitive_account.ai_foundry.endpoint
}
```

See complete setup: [`terraform/main.tf`](terraform/main.tf)

### Part 3: Understanding the Function App Code

The function app uses Azure AI Projects SDK to interact with agents. **Key insight**: DefaultAzureCredential automatically uses the managed identity in Azure, developer credentials locally - same code works everywhere.

**Core pattern** - Client initialization with managed identity:

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

def get_project_client() -> AIProjectClient:
    credential = DefaultAzureCredential()  # Automatically uses managed identity!
    endpoint = os.getenv("AI_FOUNDRY_ENDPOINT")  # From terraform config

    # Transform to AI Foundry project endpoint format
    project_endpoint = f"https://{account_name}.services.ai.azure.com/api/projects/{project_name}"

    return AIProjectClient(endpoint=project_endpoint, credential=credential)
```

**Unified endpoint pattern** - One route, multiple actions:

```python
@app.route(route="agent", auth_level=func.AuthLevel.ANONYMOUS)
def agent_operations(req: func.HttpRequest) -> func.HttpResponse:
    action = req_body.get("action")  # create, chat, list, delete, code-interpreter

    if action == "chat":
        return handle_chat(req_body, req.params)
    elif action == "list":
        return handle_list_agents()
    # ... other actions
```

See complete implementation: [`function-app/function_app.py`](function-app/function_app.py)

### Part 4: Testing Your Build

After deploying both foundry_basic and the function layer:

**1. Verify health and connectivity:**

```bash
curl https://<function-app>.azurewebsites.net/api/health | jq .
```

Expected: `"status": "healthy"`, `"authentication": "Success - Managed Identity working"`

**2. Create and test an agent:**

```bash
# Create
curl -X POST https://<function-app>.azurewebsites.net/api/agent \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "name": "my-assistant"}' | jq .

# Chat
curl -X POST https://<function-app>.azurewebsites.net/api/agent \
  -H "Content-Type: application/json" \
  -d '{"action": "chat", "message": "Hello"}' | jq .
```

**3. Run the complete demo:**

```bash
curl https://<function-app>.azurewebsites.net/api/demo | jq .
```

This validates the entire integration: agent creation, conversation, code interpreter, and cleanup.

### Part 5: How the Integration Works

**Connection flow:**

1. User sends HTTPS request to function endpoint
1. Function runtime loads environment variables (AI Foundry endpoint from terraform)
1. DefaultAzureCredential requests token using managed identity
1. Azure AD validates the identity and returns access token
1. AI Projects SDK calls AI Foundry with the token
1. Agent processes the request
1. Function returns JSON response

**No secrets anywhere** - The managed identity is the secret, and Azure manages it automatically.

### Part 6: Local Development

For local testing, the same code works with your Azure CLI credentials:

```bash
az login
cd function-app
func start
```

DefaultAzureCredential automatically falls back to Azure CLI credentials when not running in Azure. Configure your local settings using the provided script:

```bash
cd scripts
./configure-local-settings.sh
```

See local setup details: [`scripts/configure-local-settings.sh`](scripts/configure-local-settings.sh)

## Key CAIRA Integration Patterns

### 1. Consuming foundry_basic Outputs

Your function layer receives everything it needs from foundry_basic as terraform variables:

- AI Foundry endpoint and project details
- Application Insights connection
- Log Analytics workspace for diagnostic logs

See the complete variable interface: [`terraform/variables.tf`](terraform/variables.tf)

### 2. Managed Identity Authentication

DefaultAzureCredential works everywhere - no code changes needed:

- **In Azure**: Uses the function app's system-assigned managed identity
- **Locally**: Falls back to Azure CLI credentials (`az login`)
- **CI/CD**: Can use service principals or other credential types

See implementation: [`function-app/function_app.py`](function-app/function_app.py) lines 17-58

### 3. RBAC Role Management via Terraform

Terraform creates the function's managed identity and grants it access to AI Foundry in one step:

```hcl
resource "azurerm_role_assignment" "function_ai_foundry_user" {
  scope                = var.foundry_ai_foundry_id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
```

No manual portal configuration needed - it's all Infrastructure as Code.

## Prerequisites

### Required Tools

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (2.50+)
- [Terraform](https://developer.hashicorp.com/terraform) (1.13+)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) (4.x)
- [Python](https://www.python.org/downloads/) (3.11+)

### Azure Requirements

- Active Azure subscription
- Existing foundry_basic deployment (or any AI Foundry instance)
- App Service Plan quota in target region

## Quick Start

### (Optional) VS Code Development Container

For a pre-configured development environment with all tools installed, use [development container using VS Code](https://code.visualstudio.com/docs/devcontainers/containers):

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
1. Install Python 3.11 and Azure Functions Core Tools:

    ```bash
    # Ensure Python 3.11 is installed (required for function app compatibility)
    sudo apt update
    sudo apt install -y python3.11 python3.11-venv python3.11-dev

    # Detect architecture and install appropriate Azure Functions Core Tools
    ARCH=$(uname -m)
    echo "Detected architecture: $ARCH"

    cd /tmp

    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        echo "Installing Azure Functions Core Tools for ARM64 (Apple Silicon)..."
        wget https://github.com/Azure/azure-functions-core-tools/releases/download/4.3.0-preview1/Azure.Functions.Cli.linux-arm64.4.3.0-preview1.zip
        sudo unzip -d /opt/azure-functions-cli Azure.Functions.Cli.linux-arm64.4.3.0-preview1.zip
        rm Azure.Functions.Cli.linux-arm64.4.3.0-preview1.zip
    else
        echo "Installing Azure Functions Core Tools for x64 (Intel/AMD)..."
        wget https://github.com/Azure/azure-functions-core-tools/releases/download/4.0.5858/Azure.Functions.Cli.linux-x64.4.0.5858.zip
        sudo unzip -d /opt/azure-functions-cli Azure.Functions.Cli.linux-x64.4.0.5858.zip
        rm Azure.Functions.Cli.linux-x64.4.0.5858.zip
    fi

    # Set permissions and create symlinks (common for both architectures)
    sudo chmod +x /opt/azure-functions-cli/func /opt/azure-functions-cli/gozip
    sudo ln -sf /opt/azure-functions-cli/func /usr/local/bin/func
    sudo ln -sf /opt/azure-functions-cli/gozip /usr/local/bin/gozip

    # Verify installation
    func --version
    ```

### 1. Clone and Setup

Navigate to this guide's directory:

```bash
cd guides/implement_ai_foundry_basic_with_azure_function_integration
```

### Login to Azure

```bash
az login
az account set --subscription <your-subscription-id>
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
```

## Deployment Steps

### Step 1: Deploy foundry_basic (if not already deployed)

```bash
cd ../../reference_architectures/foundry_basic
terraform init
terraform apply

# Capture outputs for the function layer
RG_NAME=$(terraform output -raw resource_group_name)
AI_FOUNDRY_NAME=$(terraform output -raw ai_foundry_name)
AI_FOUNDRY_ID=$(terraform output -raw ai_foundry_id)
AI_PROJECT_ID=$(terraform output -raw ai_foundry_project_id)
AI_PROJECT_NAME=$(terraform output -raw ai_foundry_project_name)
APPINSIGHTS_ID=$(terraform output -raw application_insights_id)
LOG_WORKSPACE_ID=$(terraform output -raw log_analytics_workspace_id)
APPINSIGHTS_NAME=${APPINSIGHTS_ID##*/}
```

### Step 2: Configure and Deploy Function Layer

```bash
cd ../../guides/implement_ai_foundry_basic_with_azure_function_integration/terraform

# Create terraform.tfvars with the captured values
cat > terraform.tfvars <<EOF
foundry_resource_group_name        = "$RG_NAME"
foundry_ai_foundry_name            = "$AI_FOUNDRY_NAME"
foundry_ai_foundry_id              = "$AI_FOUNDRY_ID"
foundry_ai_foundry_project_id      = "$AI_PROJECT_ID"
foundry_ai_foundry_project_name    = "$AI_PROJECT_NAME"
foundry_application_insights_name  = "$APPINSIGHTS_NAME"
foundry_log_analytics_workspace_id = "$LOG_WORKSPACE_ID"
project_name      = "ai-integration"
function_sku_size = "B1"
EOF

# Deploy infrastructure
terraform init
terraform apply
```

**What this creates:**

- Function App with managed identity
- RBAC role granting AI Foundry access
- Storage account for function runtime
- Application Insights integration
- All configuration wired automatically

### Step 3: Deploy Function Code

```bash
cd ../function-app
FUNCTION_APP_NAME=$(cd ../terraform && terraform output -raw function_app_name)
func azure functionapp publish "$FUNCTION_APP_NAME" --python --build remote
```

The `--build remote` flag builds dependencies in Azure's Python 3.11 environment.

### Step 4: Verify

```bash
cd ../terraform
curl $(terraform output -raw function_app_url)/api/health | jq .
```

Expected: `"status": "healthy"` and `"authentication": "Success - Managed Identity working"`

## Function Endpoints

The function app provides three endpoints for AI agent operations:

### 1. Health Check - `GET /api/health`

Verifies function and AI Foundry connectivity.

```bash
curl https://${FUNCTION_APP_NAME}.azurewebsites.net/api/health | jq .
```

### 2. Agent Operations - `POST /api/agent`

Unified endpoint with action-based routing. Request body format:

```json
{
  "action": "create|chat|list|delete|code-interpreter",
  // ... additional parameters based on action
}
```

**Example - Chat:**

```bash
curl -X POST https://<function-app>.azurewebsites.net/api/agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "chat",
    "message": "What is Azure Functions?",
    "thread_id": "optional-for-continuing-conversation"
  }' | jq .
```

**Example - List Agents:**

```bash
curl -X POST https://<function-app>.azurewebsites.net/api/agent \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}' | jq .
```

See complete endpoint documentation: [`function-app/function_app.py`](function-app/function_app.py) lines 237+

### 3. Demo - `GET /api/demo`

One-click validation of the entire integration - creates agent, has conversation, uses code interpreter, and cleans up.

```bash
curl https://<function-app>.azurewebsites.net/api/demo | jq .
```

## Testing

### Unit Tests

```bash
cd function-app
pytest tests
```

### Integration Tests

```bash
cd terraform
terraform test
```

The integration tests create a complete environment, test it, and clean up automatically. See [`terraform/tests/integration.tftest.hcl`](terraform/tests/integration.tftest.hcl) for details.

## Local Development

**Important:** Use Python 3.11 to match Azure Function runtime.

```bash
cd function-app
# Requires Python 3.11 (to match Azure Function runtime)
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure local settings
cd ../scripts
./configure-local-settings.sh

# Start local development server
cd ../function-app
func start
```

Test locally:

```bash
curl http://localhost:7071/api/health | jq .
curl -X POST http://localhost:7071/api/agent \
  -H "Content-Type: application/json" \
  -d '{"action": "chat", "message": "Hello"}' | jq .
```

**Authentication:** DefaultAzureCredential automatically uses your Azure CLI credentials (`az login`) for local development.

## Troubleshooting

### Common Issues

**404 Not Found on all endpoints**

- Solution: Deploy function code: `func azure functionapp publish $FUNCTION_APP_NAME --python --build remote`

**Authorization Failed errors**

- Cause: RBAC roles not applied yet (can take a few minutes)
- Solution: Wait 2-3 minutes, then restart function app:

  ```bash
  az functionapp restart --name $FUNCTION_APP_NAME --resource-group $(terraform output -raw resource_group_name)
  ```

**Function deployment fails**

- Ensure logged in: `az login`
- Verify subscription: `az account show`
- Always use `--build remote` flag for Python functions

**Local development authentication issues**

- Solution: `az login` and `az account set --subscription <your-subscription-id>`

### Debugging Commands

```bash
# Stream function logs
az webapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

# Check function app settings
az functionapp config appsettings list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --output table

# Verify managed identity
az functionapp identity show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

# Check deployed functions
az functionapp function list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --output table
```

## Monitoring

All logs flow automatically to Application Insights and Log Analytics (configured by terraform):

```bash
# View recent logs via Azure CLI
az monitor app-insights query \
  --app $(terraform output -raw application_insights_name) \
  --resource-group $RESOURCE_GROUP \
  --query "traces | take 20"

# View function metrics
az monitor metrics list \
  --resource $(az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query id -o tsv) \
  --metric "FunctionExecutionCount" \
  --interval PT1H
```

Or use Azure Portal → Application Insights for visual dashboards and detailed telemetry.

## Cost Optimization

- **Consumption Plan**: Alternative for sporadic usage (pay-per-execution)
- **AI Foundry**: Pay-per-token for model usage
- **Storage**: Minimal cost for function runtime
- **Monitoring**: Application Insights costs scale with telemetry volume

## Clean Up

To remove all resources and avoid ongoing charges:

### 1. Remove Function Layer Resources

```bash
# Navigate to function terraform directory
cd guides/implement_ai_foundry_basic_with_azure_function_integration/terraform

# Destroy all function layer resources
terraform destroy -auto-approve

# Remove terraform state files
rm -rf .terraform terraform.tfstate* .terraform.lock.hcl
```

### 2. Remove Foundry Basic Resources

```bash
# Navigate to foundry_basic directory
cd ../../../reference_architectures/foundry_basic

# Destroy foundry_basic resources
terraform destroy -auto-approve

# Remove terraform state files
rm -rf .terraform terraform.tfstate* .terraform.lock.hcl
```

### 3. Clean Local Development Environment

```bash
# Navigate to function-app directory
cd ../../guides/implement_ai_foundry_basic_with_azure_function_integration/function-app

# Deactivate virtual environment if active
deactivate 2>/dev/null || true

# Remove Python virtual environment
rm -rf .venv

# Remove local settings and deployment files
rm -f local.settings.json
rm -f deploy.zip

# Remove Python cache
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
```

## Additional Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-services/)
- [Azure AI Projects SDK](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-projects-readme?view=azure-python)
- [Azure Functions Python Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
- [CAIRA Reference Architectures](../../reference_architectures/)
- [foundry_basic module](../../reference_architectures/foundry_basic)

## Contributing

See [CAIRA Contributing Guide](../../CONTRIBUTING.md) for detailed information on submitting issues and pull requests.
