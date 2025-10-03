# AI Foundry Basic with Azure Function Integration - Implementation Guide

> **Educational Guide**: This implementation guide is designed for learning and experimentation. Some security features (like function authentication) are simplified for educational clarity. Production deployments should follow Azure security best practices.

## Overview

This guide demonstrates how to use the CAIRA `foundry_basic` reference architecture with Azure Functions to enable serverless AI agent capabilities. The solution builds upon the existing foundry_basic pattern and adds Azure Functions for serverless AI integration using Azure AI Foundry Projects SDK.

## Architecture Components

![Architecture Diagram](./images/architecture.mermaid.png)

- **Azure AI Foundry**: AI services and project management (via foundry_basic module)
- **Azure AI Project**: Organized workspace for AI agents (via foundry_basic module)
- **Azure Function App**: Serverless compute with system-assigned managed identity
- **Application Insights**: Monitoring and diagnostics (via foundry_basic module)
- **Log Analytics**: Centralized logging (via foundry_basic module)

## Understanding What We're Building

### The End State

By the end of this guide, you'll have a complete serverless AI agent solution consisting of:

**Foundation Layer (foundry_basic)**:

- An Azure AI Foundry account hosting your AI capabilities
- An AI Foundry Project workspace for organizing agents
- Application Insights for monitoring and telemetry
- Log Analytics workspace for centralized logging
- All connected via managed identities and RBAC roles

**Function Layer (what we're building)**:

- An Azure Function App running Python 3.11
- System-assigned managed identity for secure, keyless authentication
- Storage account for function runtime (also using managed identity)
- App Service Plan hosting the function
- Complete RBAC role assignments for AI Foundry access
- RESTful HTTP endpoints for AI agent operations

**Integration Points**:

- Function App → AI Foundry: Managed identity with Cognitive Services User role
- Function App → Storage: Managed identity with Storage Blob Data Owner role
- Function App → App Insights: Connection string-based telemetry
- All traffic secured with HTTPS and TLS 1.2 minimum

### Why This Architecture?

**Serverless Benefits**: Azure Functions provide automatic scaling, pay-per-execution pricing, and minimal infrastructure management.

**Security by Design**: Managed identities eliminate the need for storing credentials, following Azure's security best practices.

**Separation of Concerns**: The foundry_basic layer handles AI infrastructure, while the function layer focuses on application logic and API endpoints.

**Production Ready**: All components include monitoring, logging, and security configurations suitable for production workloads.

## Building the Solution Step by Step

This section walks you through building the solution from the ground up, explaining each component and why it's needed.

### Part 1: Understanding the Terraform Infrastructure

Before deploying anything, let's understand what the Terraform code creates and why each piece is necessary.

#### Core Resource: The Function App

The centerpiece of our solution is the Azure Function App. Here's what makes it work:

**1. Storage Account** (`function.tf` lines 5-35):

```hcl
resource "azurerm_storage_account" "function" {
  name                     = replace(module.naming.storage_account.name_unique, "-", "")
  account_tier             = "Standard"
  shared_access_key_enabled = false  # Security: Use managed identity instead
  ...
}
```

**Why it's needed**: Function Apps require storage for runtime data, state management, and queue triggers. We disable shared access keys and use managed identity for secure access.

**2. App Service Plan** (`function.tf` lines 37-51):

```hcl
resource "azurerm_service_plan" "function" {
  os_type  = "Linux"
  sku_name = var.function_sku_size  # Default: B1
}
```

**Why it's needed**: This provides the compute resources for your function. The B1 SKU offers a good balance of cost and performance for learning and development.

**3. Linux Function App** (`function.tf` lines 53-103):

```hcl
resource "azurerm_linux_function_app" "main" {
  storage_uses_managed_identity = true  # No storage keys!

  identity {
    type = "SystemAssigned"  # Creates managed identity automatically
  }

  app_settings = {
    "AI_FOUNDRY_ENDPOINT" = local.ai_foundry_endpoint
    "AzureWebJobsStorage__credential" = "managedidentity"
  }
}
```

**Why these settings matter**:

- `storage_uses_managed_identity`: Eliminates the need for storage connection strings
- `SystemAssigned` identity: Azure creates and manages the identity lifecycle
- `app_settings`: Configure the function to find and authenticate with AI Foundry

#### Security Layer: RBAC Role Assignments

**AI Foundry Access** (`function.tf` lines 105-113):

```hcl
resource "azurerm_role_assignment" "function_ai_foundry_user" {
  scope                = var.foundry_ai_foundry_id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
```

**Why this matters**: This grants your function app permission to call AI Foundry APIs. Without this role assignment, all API calls would fail with authorization errors.

#### Observability Layer: Monitoring

**Diagnostic Settings** (`function.tf` lines 115-131):

```hcl
resource "azurerm_monitor_diagnostic_setting" "function" {
  target_resource_id         = azurerm_linux_function_app.main.id
  log_analytics_workspace_id = var.foundry_log_analytics_workspace_id

  enabled_log {
    category = "FunctionAppLogs"
  }
}
```

**Why this matters**: Sends all function logs to Log Analytics, enabling troubleshooting and monitoring through Azure Monitor.

### Part 2: Building the Terraform Infrastructure

Now that you understand the components, let's build them step by step.

#### Step 1: Set Up Your Terraform Files

Create a new directory for your function layer:

```bash
mkdir -p my-function-layer
cd my-function-layer
```

**Create `providers.tf`**: This configures Terraform and Azure provider settings.

```hcl
terraform {
  required_version = ">= 1.13, < 2.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
  storage_use_azuread = true  # Enable managed identity for storage
}
```

**Why these settings**: The provider configuration enables managed identity authentication for storage accounts, which is crucial for our keyless security model.

**Create `variables.tf`**: Define inputs from foundry_basic.

```hcl
variable "foundry_resource_group_name" {
  type        = string
  description = "Resource group from foundry_basic"
}

variable "foundry_ai_foundry_name" {
  type        = string
  description = "AI Foundry account name"
}

variable "foundry_ai_foundry_id" {
  type        = string
  description = "Full resource ID for RBAC assignments"
}

variable "project_name" {
  type    = string
  default = "ai-integration"
}

variable "function_sku_size" {
  type    = string
  default = "B1"
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

**Why separate variables**: This creates a clean interface between the foundry_basic foundation and your function layer, making the solution modular and reusable.

#### Step 2: Connect to Foundry Basic

**Create `main.tf`**: This connects to your existing AI Foundry deployment.

```hcl
# Reference existing foundry_basic resources
data "azurerm_resource_group" "this" {
  name = var.foundry_resource_group_name
}

data "azurerm_cognitive_account" "ai_foundry" {
  name                = var.foundry_ai_foundry_name
  resource_group_name = var.foundry_resource_group_name
}

# Use Azure naming module for consistent names
module "naming" {
  source  = "Azure/naming/azurerm"
  version = "0.4.2"
  suffix  = [var.project_name]
}

# Create separate resource group for function resources
resource "azurerm_resource_group" "function" {
  name     = "${module.naming.resource_group.name_unique}-func"
  location = data.azurerm_resource_group.this.location

  tags = merge(var.tags, {
    Purpose = "Function App Resources"
    Parent  = data.azurerm_resource_group.this.name
  })
}

locals {
  resource_group_name = azurerm_resource_group.function.name
  location            = azurerm_resource_group.function.location
  ai_foundry_endpoint = data.azurerm_cognitive_account.ai_foundry.endpoint
}
```

**Why data sources**: These let Terraform discover and reference your existing AI Foundry resources without managing them directly.

**Why a separate resource group**: This keeps function resources isolated, making it easier to manage, update, or delete them independently.

#### Step 3: Create the Function Infrastructure

**Create `function.tf`**: Build the complete function infrastructure.

Start with storage (keyless design):

```hcl
resource "azurerm_storage_account" "function" {
  name                        = replace(module.naming.storage_account.name_unique, "-", "")
  resource_group_name         = local.resource_group_name
  location                    = local.location
  account_tier                = "Standard"
  account_replication_type    = "LRS"
  shared_access_key_enabled   = false  # Critical: No keys!
  min_tls_version             = "TLS1_2"
  https_traffic_only_enabled  = true

  network_rules {
    default_action = "Allow"
    bypass         = ["AzureServices"]
  }
}
```

**Security decision explained**: By setting `shared_access_key_enabled = false`, we force all access to use managed identities. This eliminates the risk of key leakage.

Add the App Service Plan:

```hcl
resource "azurerm_service_plan" "function" {
  name                = module.naming.app_service_plan.name_unique
  resource_group_name = local.resource_group_name
  location            = local.location
  os_type             = "Linux"
  sku_name            = var.function_sku_size
}
```

**SKU choice**: B1 provides dedicated compute with 1.75 GB RAM and 1 vCPU, suitable for moderate workloads. For production, consider Premium plans for better performance.

Create the Function App with managed identity:

```hcl
resource "azurerm_linux_function_app" "main" {
  name                = module.naming.function_app.name_unique
  resource_group_name = local.resource_group_name
  location            = local.location
  service_plan_id     = azurerm_service_plan.function.id

  # Managed identity for storage (no connection string!)
  storage_account_name          = azurerm_storage_account.function.name
  storage_uses_managed_identity = true

  functions_extension_version = "~4"

  site_config {
    always_on                = false
    ftps_state               = "Disabled"
    http2_enabled            = true
    minimum_tls_version      = "1.2"

    application_stack {
      python_version = "3.11"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"     = "python"
    "AI_FOUNDRY_ENDPOINT"          = local.ai_foundry_endpoint
    "AI_FOUNDRY_PROJECT_NAME"      = var.foundry_ai_foundry_project_name
    "AzureWebJobsStorage__accountName" = azurerm_storage_account.function.name
    "AzureWebJobsStorage__credential"  = "managedidentity"
  }
}
```

**Configuration breakdown**:

- `storage_uses_managed_identity = true`: Function runtime uses managed identity for storage
- `AzureWebJobsStorage__credential = "managedidentity"`: Explicitly tells Function runtime to use MI
- `identity { type = "SystemAssigned" }`: Azure creates and manages the identity
- `python_version = "3.11"`: Matches our development environment

Add RBAC roles for AI Foundry:

```hcl
resource "azurerm_role_assignment" "function_ai_foundry_user" {
  scope                = var.foundry_ai_foundry_id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
```

**Role explanation**: "Cognitive Services User" allows calling AI Foundry APIs but doesn't grant management permissions. This follows least-privilege principles.

Add monitoring:

```hcl
resource "azurerm_monitor_diagnostic_setting" "function" {
  name                       = "${module.naming.function_app.name_unique}-diagnostics"
  target_resource_id         = azurerm_linux_function_app.main.id
  log_analytics_workspace_id = var.foundry_log_analytics_workspace_id

  enabled_log {
    category = "FunctionAppLogs"
  }

  metric {
    category = "AllMetrics"
  }
}
```

**Monitoring benefit**: Every function execution, error, and metric flows into Log Analytics, enabling Azure Monitor queries and alerting.

#### Step 4: Add Outputs

**Create `outputs.tf`**: Expose important values for testing and integration.

```hcl
output "function_app_name" {
  description = "Name of the deployed Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_url" {
  description = "Base URL for function endpoints"
  value       = "https://${azurerm_linux_function_app.main.default_hostname}"
}

output "resource_group_name" {
  description = "Resource group containing function resources"
  value       = azurerm_resource_group.function.name
}
```

### Part 3: Understanding the Function App Code

Now let's understand the Python function code that provides AI agent capabilities.

#### Core Architecture: Azure AI Projects SDK

The function app uses the **Azure AI Projects SDK** which provides:

**Agent Management**: Create, list, and delete AI agents with various capabilities (code interpreter, file search)

**Conversation Threading**: Maintain conversation context across multiple user interactions

**Managed Identity Authentication**: Seamless authentication using DefaultAzureCredential

#### Key Code Components

**1. Project Client Initialization** (`function_app.py` lines 17-58):

```python
def get_project_client() -> AIProjectClient:
    """Initialize Azure AI Project Client"""
    global _project_client

    if _project_client:
        return _project_client  # Reuse existing client

    credential = DefaultAzureCredential()
    endpoint = os.getenv("AI_FOUNDRY_ENDPOINT")
    project_name = os.getenv("AI_FOUNDRY_PROJECT_NAME")

    # Transform endpoint to AI Foundry format
    if "cognitiveservices.azure.com" in endpoint:
        account_name = endpoint.split("//")[1].split(".")[0]
        project_endpoint = f"https://{account_name}.services.ai.azure.com/api/projects/{project_name}"

    _project_client = AIProjectClient(
        endpoint=project_endpoint,
        credential=credential
    )

    return _project_client
```

**Why this design**:

- **Singleton pattern**: Creates the client once and reuses it across function invocations for better performance
- **DefaultAzureCredential**: Automatically uses managed identity in Azure, developer credentials locally
- **Endpoint transformation**: Converts Cognitive Services endpoint to AI Foundry project endpoint format

**2. Agent Creation** (`function_app.py` lines 60-117):

```python
def get_or_create_agent() -> Any:
    """Get existing agent or create a new one"""
    global _agent_instance

    if _agent_instance:
        return _agent_instance

    project_client = get_project_client()
    agents_client = project_client.agents

    # Try to find existing agent
    agent_name = "azure-function-assistant"
    agents = agents_client.list_agents()
    for agent in agents:
        if agent.name == agent_name:
            _agent_instance = agent
            return agent

    # Create new agent with tools
    code_interpreter_tool = {"type": "code_interpreter"}
    file_search_tool = {"type": "file_search"}

    _agent_instance = agents_client.create_agent(
        model=os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4"),
        name=agent_name,
        instructions="""You are an intelligent AI assistant...""",
        tools=[code_interpreter_tool, file_search_tool]
    )

    return _agent_instance
```

**Why this approach**:

- **Reuse existing agents**: Avoids creating duplicate agents on each function invocation
- **Tool configuration**: Code interpreter enables Python execution, file search enables document analysis
- **Default instructions**: Provides baseline behavior; can be customized per use case

**3. Running Conversations** (`function_app.py` lines 119-187):

```python
def run_agent_conversation(agent: Any, user_message: str, thread_id: Optional[str] = None) -> Dict:
    """Run a conversation with the agent"""
    project_client = get_project_client()
    agents_client = project_client.agents

    # Create or retrieve thread for conversation context
    if thread_id:
        thread = agents_client.threads.get(thread_id)
    else:
        thread = agents_client.threads.create()

    # Add user message to thread
    message = agents_client.messages.create(
        thread_id=thread.id,
        role="user",
        content=user_message
    )

    # Run the agent
    run = agents_client.runs.create(
        thread_id=thread.id,
        agent_id=agent.id
    )

    # Wait for completion
    while run.status in ["queued", "in_progress", "requires_action"]:
        run = agents_client.runs.get(thread_id=thread.id, run_id=run.id)

    # Extract assistant response
    messages = agents_client.messages.list(thread_id=thread.id)
    for msg in messages:
        if msg.role == "assistant":
            if hasattr(msg, 'content') and msg.content:
                if isinstance(msg.content, list):
                    assistant_response = msg.content[0].text.value

    return {
        "response": assistant_response,
        "thread_id": thread.id,
        "run_id": run.id,
        "status": run.status,
        "usage": {...}  # Token usage metrics
    }
```

**Why threads matter**:

- **Context retention**: Thread IDs allow continuing conversations with full context
- **Multi-turn conversations**: Users can reference previous messages naturally
- **Session management**: Each user can have their own thread for isolated conversations

**4. HTTP Endpoints** (`function_app.py` lines 237+):

The function app uses a unified endpoint design with action-based routing:

```python
@app.route(route="agent", auth_level=func.AuthLevel.ANONYMOUS)
def agent_operations(req: func.HttpRequest) -> func.HttpResponse:
    """
    Unified agent operations endpoint.

    Actions:
    - create: Create a new agent
    - chat: Chat with an agent
    - list: List all agents
    - delete: Delete an agent
    - code-interpreter: Demonstrate code interpreter capability
    """
    try:
        req_body = req.get_json()
        action = req_body.get("action")

        if not action:
            return func.HttpResponse(
                json.dumps({
                    "error": "Please provide an 'action' parameter",
                    "available_actions": ["create", "chat", "list", "delete", "code-interpreter"]
                }),
                status_code=400
            )

        # Route to appropriate handler
        if action == "create":
            return handle_create_agent(req_body)
        elif action == "chat":
            return handle_chat(req_body, req.params)
        elif action == "list":
            return handle_list_agents()
        elif action == "delete":
            return handle_delete_agent(req_body, req.params)
        elif action == "code-interpreter":
            return handle_code_interpreter(req_body)
```

**Why this design**:

- **Single endpoint**: Simplifies API surface and makes it easier to secure
- **Action-based routing**: Clear separation of concerns while maintaining single entry point
- **Extensible**: Easy to add new actions without creating new endpoints
- **Consistent error handling**: Centralized validation and error responses

### Part 4: Building the Function App Code

Now let's build the function app step by step.

#### Step 1: Set Up the Function Project

Create the function app directory structure:

```bash
mkdir function-app
cd function-app
```

Initialize with Azure Functions Core Tools:

```bash
func init . --python
```

This creates:

- `host.json`: Function app configuration
- `local.settings.json`: Local development settings
- `requirements.txt`: Python dependencies
- `.funcignore`: Files to exclude from deployment

#### Step 2: Define Dependencies

Edit `requirements.txt` to include Azure AI SDK:

```txt
azure-functions
azure-identity
azure-ai-projects>=1.0.0b11
azure-ai-inference>=1.0.0b4
azure-core
requests
```

**Dependency explanation**:

- `azure-functions`: Core Functions framework
- `azure-identity`: Managed identity authentication
- `azure-ai-projects`: AI Foundry agents SDK
- `azure-ai-inference`: Additional AI inference capabilities
- `azure-core`: Azure SDK foundation
- `requests`: HTTP client for API calls

#### Step 3: Configure the Function App

Edit `host.json` for Function runtime configuration:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

**Configuration details**:

- `version: 2.0`: Latest Functions runtime
- `samplingSettings`: Reduces telemetry costs while maintaining visibility
- `extensionBundle`: Includes all function bindings without explicit installation

#### Step 4: Build the Core Function Logic

Create `function_app.py` with the complete implementation:

**Import section**:

```python
import os
import json
import logging
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from typing import Optional, Dict, Any
from datetime import datetime, timezone

app = func.FunctionApp()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

**Client initialization** (as shown in Part 3):

```python
_project_client = None

def get_project_client() -> AIProjectClient:
    # Implementation from Part 3
    ...
```

**Agent management** (as shown in Part 3):

```python
_agent_instance = None

def get_or_create_agent() -> Any:
    # Implementation from Part 3
    ...
```

**Conversation handling** (as shown in Part 3):

```python
def run_agent_conversation(agent, user_message, thread_id=None):
    # Implementation from Part 3
    ...
```

**HTTP endpoint - Health Check**:

```python
@app.route(route="health", auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """Verify function and AI Foundry connectivity"""
    health_status = {
        "status": "healthy",
        "function_app": "running",
        "configuration": {
            "ai_foundry_endpoint": os.getenv("AI_FOUNDRY_ENDPOINT"),
            "project_name": os.getenv("AI_FOUNDRY_PROJECT_NAME")
        }
    }

    try:
        project_client = get_project_client()
        health_status["ai_foundry"]["client_initialized"] = True

        # Test listing agents
        agents = list_agents()
        health_status["ai_foundry"]["agent_count"] = len(agents)

        # Verify authentication
        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        health_status["ai_foundry"]["authentication"] = "Success"

    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["error"] = str(e)

    return func.HttpResponse(
        json.dumps(health_status, indent=2),
        mimetype="application/json"
    )
```

**Why health checks**: Provides immediate visibility into deployment status, configuration, and connectivity issues.

**HTTP endpoint - Unified Agent Operations**:

The current design uses a single endpoint with action-based routing for all agent operations:

```python
@app.route(route="agent", auth_level=func.AuthLevel.ANONYMOUS)
def agent_operations(req: func.HttpRequest) -> func.HttpResponse:
    """
    Unified agent operations endpoint.
    Routes to different handlers based on 'action' parameter.
    """
    logger.info("Agent operation requested")

    try:
        req_body = req.get_json()
        action = req_body.get("action")

        if not action:
            return func.HttpResponse(
                json.dumps({
                    "error": "Please provide an 'action' parameter",
                    "available_actions": ["create", "chat", "list", "delete", "code-interpreter"]
                }),
                status_code=400
            )

        # Route to appropriate handler
        if action == "create":
            return handle_create_agent(req_body)
        elif action == "chat":
            return handle_chat(req_body, req.params)
        elif action == "list":
            return handle_list_agents()
        elif action == "delete":
            return handle_delete_agent(req_body, req.params)
        elif action == "code-interpreter":
            return handle_code_interpreter(req_body)
        else:
            return func.HttpResponse(
                json.dumps({"error": f"Unknown action: {action}"}),
                status_code=400
            )

    except Exception as e:
        logger.error(f"Error in agent operations: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500
        )
```

**Handler functions**: Each action has a dedicated handler function:

```python
def handle_chat(req_body: dict, params: dict) -> func.HttpResponse:
    """Handle chat with agent"""
    message = req_body.get("message") or req_body.get("prompt")
    thread_id = req_body.get("thread_id")

    if not message:
        return func.HttpResponse(
            json.dumps({"error": "Please provide a 'message'"}),
            status_code=400
        )

    agent = get_or_create_agent()
    result = run_agent_conversation(agent, message, thread_id)

    return func.HttpResponse(
        json.dumps({
            "action": "chat",
            "user_message": message,
            **result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, indent=2),
        mimetype="application/json",
        status_code=200
    )
```

**Why this unified design**:

- **Single API endpoint**: Easier to secure and manage
- **Clear action routing**: Separation of concerns with dedicated handlers
- **Consistent error handling**: Centralized validation at the main endpoint
- **Extensible**: Easy to add new actions without creating new routes
- **Self-documenting**: Error messages list available actions

**HTTP endpoint - Demo**:

```python
@app.route(route="demo", auth_level=func.AuthLevel.ANONYMOUS)
def demo_agent_capabilities(req: func.HttpRequest) -> func.HttpResponse:
    """One-click demonstration of the entire integration"""
    # Creates agent, runs conversation, demonstrates code interpreter, cleans up
    # See full implementation in function_app.py
```

#### Step 5: Local Development Configuration

Create `local.settings.json` for local testing:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AI_FOUNDRY_ENDPOINT": "https://your-foundry.cognitiveservices.azure.com/",
    "AI_FOUNDRY_PROJECT_NAME": "your-project-name",
    "AI_FOUNDRY_PROJECT_ID": "/subscriptions/.../projects/...",
    "AZURE_SUBSCRIPTION_ID": "your-subscription-id"
  }
}
```

**Local development notes**:

- Uses Azure Storage Emulator or real storage account
- Authenticates using Azure CLI credentials (`az login`)
- Same code runs locally and in Azure without changes

### Part 5: Understanding How It All Connects

Now that we've built all the pieces, let's see how they work together:

#### Connection Flow

1. **User Request** → HTTP request to Function endpoint
1. **Function Runtime** → Loads Python code and environment variables
1. **DefaultAzureCredential** → Gets token using managed identity
1. **AI Projects SDK** → Authenticates with AI Foundry using token
1. **Agent Execution** → Processes request using AI model
1. **Response** → Returns JSON result to user

#### Data Flow Example: Chat Request

```txt
User sends POST to /api/agent/chat
    ↓
Function receives request with {"message": "Hello"}
    ↓
get_or_create_agent() checks for existing agent
    ↓
run_agent_conversation() creates thread
    ↓
AI Projects SDK sends message to agent
    ↓
Agent processes using GPT-4 model
    ↓
Function extracts response from thread
    ↓
Returns JSON with response and thread_id
    ↓
User receives response and can continue conversation
```

#### Security Flow: Managed Identity

```txt
Function App starts
    ↓
Azure assigns managed identity (automatic)
    ↓
Terraform grants "Cognitive Services User" role
    ↓
Function requests token from Azure AD
    ↓
Azure AD validates identity and role
    ↓
Azure AD returns access token
    ↓
Function uses token to call AI Foundry
    ↓
AI Foundry validates token and processes request
```

**Key insight**: No credentials stored anywhere. Azure handles all authentication through its identity platform.

#### Monitoring Flow

```txt
Function executes
    ↓
Logs written to console
    ↓
Diagnostic settings capture logs
    ↓
Logs sent to Log Analytics workspace
    ↓
Application Insights processes telemetry
    ↓
Azure Monitor enables queries and alerts
```

### Part 6: Testing Your Build

After building everything, verify each component:

**1. Terraform Plan**:

```bash
terraform init
terraform plan
```

Verify: No errors, expected resource count

**2. Terraform Apply**:

```bash
terraform apply
```

Verify: All resources created, outputs displayed

**3. Function Deployment**:

```bash
func azure functionapp publish <function-app-name> --python --build remote
```

Verify: Deployment successful, URLs displayed

**4. Health Check**:

```bash
curl https://<function-app>.azurewebsites.net/api/health | jq .
```

Verify: Status "healthy", client initialized, authentication successful

**5. Agent Creation**:

```bash
curl -X POST https://<function-app>.azurewebsites.net/api/agent/create \
  -H "Content-Type: application/json" \
  -d '{"name": "test-agent"}' | jq .
```

Verify: Agent created with ID, name, model

**6. Chat Test**:

```bash
curl -X POST https://<function-app>.azurewebsites.net/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}' | jq .
```

Verify: Response received, thread_id provided, usage metrics included

**7. Demo Run**:

```bash
curl https://<function-app>.azurewebsites.net/api/demo | jq .
```

Verify: Complete workflow executes, agent created and deleted, conversation captured

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
- **RBAC roles assigned via Terraform** - The Terraform configuration explicitly creates role assignments for the Function App's managed identity to access AI Foundry and storage resources

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

### 2. Login to Azure

```bash
az login
az account set --subscription <your-subscription-id>

# Make subscription ID available to terraform providers as environment variable
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
```

## Deployment Steps

### Step 1: Deploy Foundry Basic (if not already deployed)

First, deploy the foundry_basic reference architecture:

```bash
cd ../../reference_architectures/foundry_basic
terraform init
terraform apply
```

After deployment, capture the outputs you'll need:

```bash
# Save outputs for the function layer
RG_NAME=$(terraform output -raw resource_group_name)
AI_FOUNDRY_NAME=$(terraform output -raw ai_foundry_name)
AI_FOUNDRY_ID=$(terraform output -raw ai_foundry_id)
AI_PROJECT_ID=$(terraform output -raw ai_foundry_project_id)
AI_PROJECT_NAME=$(terraform output -raw ai_foundry_project_name)
APPINSIGHTS_ID=$(terraform output -raw application_insights_id)
LOG_WORKSPACE_ID=$(terraform output -raw log_analytics_workspace_id)

# Extract Application Insights name from its ID
APPINSIGHTS_NAME=${APPINSIGHTS_ID##*/}
```

### Step 2: Configure Function Layer Variables

Navigate to the function integration terraform directory and create your configuration:

```bash
cd ../../guides/implement_ai_foundry_basic_with_azure_function_integration/terraform
```

Create `terraform.tfvars` using the outputs from Step 1:

```bash
# Create terraform.tfvars with the captured values
cat > terraform.tfvars <<EOF
# Outputs from foundry_basic deployment
foundry_resource_group_name        = "$RG_NAME"
foundry_ai_foundry_name            = "$AI_FOUNDRY_NAME"
foundry_ai_foundry_id              = "$AI_FOUNDRY_ID"
foundry_ai_foundry_project_id      = "$AI_PROJECT_ID"
foundry_ai_foundry_project_name    = "$AI_PROJECT_NAME"
foundry_application_insights_name  = "$APPINSIGHTS_NAME"
foundry_log_analytics_workspace_id = "$LOG_WORKSPACE_ID"

# Function-specific configuration
project_name      = "ai-integration"
function_sku_size = "B1"
python_version    = "3.11"

tags = {
  Environment = "dev"
  Project     = "AI-Functions"
}
EOF

echo "✅ terraform.tfvars created with outputs from foundry_basic"
```

### Step 3: Deploy Function Infrastructure

Deploy the function infrastructure with Terraform. This will:

- Create a Function App with system-assigned managed identity
- Create a storage account for the Function App
- Configure all necessary RBAC role assignments:
  - Cognitive Services User on AI Foundry
- Set up Application Insights integration
- Configure the Function App with the AI Foundry endpoint

```bash
terraform init
terraform apply
```

The Terraform configuration handles:

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

The implementation provides three streamlined endpoints for all agent operations:

### 1. Health Check (`/api/health`)

- **Method**: GET
- **Auth**: Anonymous
- **Purpose**: Verifies Function App and AI Foundry connectivity
- **Response**: JSON with configuration and connection status

### 2. Agent Operations (`/api/agent`)

- **Method**: POST
- **Auth**: Anonymous
- **Purpose**: Unified endpoint for all agent operations
- **Request Body**:

  ```json
  {
    "action": "create|chat|list|delete|code-interpreter",
    // Additional parameters based on action
  }
  ```

**Available Actions:**

- **create**: Create a new AI agent

  ```json
  {
    "action": "create",
    "name": "assistant-name",
    "instructions": "You are a helpful assistant",
    "model": "gpt-4",
    "enable_code_interpreter": true,
    "enable_file_search": false
  }
  ```

- **chat**: Have conversations with AI agents

  ```json
  {
    "action": "chat",
    "message": "Your message here",
    "thread_id": "optional-thread-id"
  }
  ```

- **list**: List all agents in the project

  ```json
  {
    "action": "list"
  }
  ```

- **delete**: Delete an agent by ID

  ```json
  {
    "action": "delete",
    "agent_id": "agent-id-to-delete"
  }
  ```

- **code-interpreter**: Demonstrate code interpreter capability

  ```json
  {
    "action": "code-interpreter",
    "code_task": "Calculate fibonacci sequence up to n=10"
  }
  ```

### 3. Demo (`/api/demo`)

- **Method**: GET
- **Auth**: Anonymous
- **Purpose**: One-click validation of the entire integration
- **Response**: Demonstrates agent creation, conversation, code interpreter, and cleanup

## Testing the Deployed Functions

### Test Health Check

```bash
curl "$FUNCTION_URL/api/health" | jq .
```

### Create an Agent

```bash
curl -X POST "$FUNCTION_URL/api/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "name": "my-assistant",
    "instructions": "You are a helpful AI assistant",
    "enable_code_interpreter": true
  }' | jq .
```

### Chat with Agent

```bash
curl -X POST "$FUNCTION_URL/api/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "chat",
    "message": "What is Azure Functions?"
  }' | jq .
```

### List All Agents

```bash
curl -X POST "$FUNCTION_URL/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}' | jq .
```

### Delete an Agent

```bash
curl -X POST "$FUNCTION_URL/api/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "agent_id": "asst_xxxxx"
  }' | jq .
```

### Run Code Interpreter Demo

```bash
curl -X POST "$FUNCTION_URL/api/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "code-interpreter",
    "code_task": "Calculate the sum of squares from 1 to 10"
  }' | jq .
```

### Run Complete Demo

```bash
curl "$FUNCTION_URL/api/demo" | jq .
```

## Local Development

> **Important:** Always use a Python 3.11 virtual environment to match the Azure Function runtime requirements.

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

# Create agent
curl -X POST http://localhost:7071/api/agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "name": "local-assistant"
  }' | jq .

# Chat with agent
curl -X POST http://localhost:7071/api/agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "chat",
    "message": "Hello from local development"
  }' | jq .

# Run complete demo
curl http://localhost:7071/api/demo | jq .
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

```txt
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
pytest tests

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

- For production deployments requiring private endpoints, use `foundry_basic_private` reference architecture located at `../../reference_architectures/foundry_basic_private`
- The private configuration provides network isolation with Private Endpoints for all services
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

## Known Limitations

- AI Foundry Projects is evolving; some features may change
- Model availability varies by region
- Function consumption plan has cold start delays
- Agent model selection (gpt-4, etc.) depends on what's available in your AI Foundry region

## Support and Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/en-us/azure/ai-services/)
- [Azure AI Projects SDK Documentation](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-projects-readme?view=azure-python)
- [Azure Functions Python Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
- [CAIRA Reference Architectures](../../reference_architectures/)

## Contributing

Please submit issues and pull requests for improvements to this guide. See the main [CAIRA Contributing Guide](../../CONTRIBUTING.md) for detailed information.
