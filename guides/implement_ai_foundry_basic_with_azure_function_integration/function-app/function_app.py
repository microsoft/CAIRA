import os
import json
import logging
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.core.exceptions import AzureError
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.ai.ml import MLClient
import requests
from typing import List, Dict, Optional, Tuple

app = func.FunctionApp()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_ml_client() -> Tuple[MLClient, DefaultAzureCredential]:
    """Initialize Azure ML Client for AI Foundry project management"""
    try:
        credential = DefaultAzureCredential()

        # Get configuration from environment
        subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")
        resource_group = os.getenv("RESOURCE_GROUP")
        workspace_name = os.getenv("AI_FOUNDRY_PROJECT_NAME", "ai-functions")

        if not subscription_id or not resource_group:
            raise ValueError(
                "Missing Azure configuration (subscription/resource group)")

        # Create ML client for AI Foundry project management
        ml_client = MLClient(
            credential=credential,
            subscription_id=subscription_id,
            resource_group_name=resource_group,
            workspace_name=workspace_name
        )

        return ml_client, credential
    except Exception as e:
        logger.error(f"Failed to initialize ML Client: {str(e)}")
        raise


def get_chat_client() -> Tuple[ChatCompletionsClient, DefaultAzureCredential, MLClient]:
    """Initialize Azure AI Inference Client with AI Foundry project context"""
    try:
        # Get ML client for project context
        ml_client, credential = get_ml_client()

        # Get the endpoint from environment
        endpoint = os.getenv("AI_FOUNDRY_ENDPOINT")
        if not endpoint:
            raise ValueError(
                "AI_FOUNDRY_ENDPOINT environment variable is not set")

        # Create ChatCompletions client using Azure AI Inference SDK
        # This client works with AI Foundry deployments
        chat_client = ChatCompletionsClient(
            endpoint=endpoint,
            credential=credential,
            # API version for AI Foundry compatibility
            api_version="2024-02-01"
        )

        return chat_client, credential, ml_client
    except Exception as e:
        logger.error(f"Failed to initialize Chat Client: {str(e)}")
        raise


def list_project_models(ml_client: MLClient) -> List[Dict]:
    """List models registered in the AI Foundry project"""
    try:
        models = ml_client.models.list()
        model_list = []

        for model in models:
            model_list.append({
                "name": model.name,
                "version": model.version,
                "description": model.description,
                "tags": model.tags,
                "created_by": model.creation_context.created_by if hasattr(model, 'creation_context') else None,
                "created_at": str(model.creation_context.created_at) if hasattr(model, 'creation_context') else None
            })

        return model_list
    except Exception as e:
        logger.error(f"Error listing project models: {str(e)}")
        return []


def list_deployments_via_api(credential: DefaultAzureCredential) -> List[str]:
    """List deployments using the Cognitive Services REST API"""
    try:
        # Get configuration
        endpoint = os.getenv("AI_FOUNDRY_ENDPOINT")
        if not endpoint:
            logger.warning(
                "AI_FOUNDRY_ENDPOINT not set, cannot list deployments")
            return []

        # Get access token
        token = credential.get_token("https://management.azure.com/.default")

        # Parse account name from endpoint
        if "cognitiveservices.azure.com" in endpoint:
            account_name = endpoint.split("//")[1].split(".")[0]
        elif "openai.azure.com" in endpoint:
            account_name = endpoint.split("//")[1].split(".")[0]
        else:
            logger.warning("Could not determine account name from endpoint")
            return []

        # Get required configuration
        subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")
        resource_group = os.getenv("RESOURCE_GROUP")

        if not subscription_id or not resource_group:
            logger.warning(
                "Missing AZURE_SUBSCRIPTION_ID or RESOURCE_GROUP environment variables")
            return []

        management_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.CognitiveServices/accounts/{account_name}/deployments?api-version=2023-05-01"

        headers = {
            "Authorization": f"Bearer {token.token}",
            "Content-Type": "application/json",
        }

        response = requests.get(management_url, headers=headers, timeout=10)

        if response.status_code == 200:
            deployments = response.json().get("value", [])
            return [
                d["name"]
                for d in deployments
                if d.get("properties", {}).get("provisioningState") == "Succeeded"
            ]
        else:
            logger.warning(
                f"Could not list deployments: {response.status_code}")
            return []

    except Exception as e:
        logger.error(f"Error listing deployments: {str(e)}")
        return []


def chat_with_ai_inference(chat_client: ChatCompletionsClient, ml_client: MLClient, prompt: str, deployment_name: str) -> Dict:
    """Execute chat using Azure AI Inference SDK with project context"""
    try:
        # Add project context to the system message
        project_name = ml_client.workspace_name

        # Create messages using AI Inference models
        messages = [
            SystemMessage(
                content=f"You are an AI assistant deployed through Azure AI Foundry project '{project_name}'. You provide helpful, accurate responses while being concise and friendly."),
            UserMessage(content=prompt)
        ]

        # Make the chat completion request using AI Inference SDK
        response = chat_client.complete(
            messages=messages,
            model=deployment_name,
            max_tokens=800,
            temperature=0.7
        )

        # Extract the response
        ai_response = response.choices[0].message.content if response.choices else "No response generated"

        return {
            "response": ai_response,
            "deployment": deployment_name,
            "project": project_name,
            "model": response.model if hasattr(response, 'model') else deployment_name,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if hasattr(response, 'usage') else 0,
                "completion_tokens": response.usage.completion_tokens if hasattr(response, 'usage') else 0,
                "total_tokens": response.usage.total_tokens if hasattr(response, 'usage') else 0,
            },
            "status": "success"
        }

    except Exception as e:
        logger.error(f"Error in AI Inference chat: {str(e)}")
        raise


@app.route(route="HttpExample", auth_level=func.AuthLevel.ANONYMOUS)
def HttpExample(req: func.HttpRequest) -> func.HttpResponse:
    """
    Simple HTTP trigger function for testing.
    This demonstrates basic function app connectivity.
    """
    logging.info("Python HTTP trigger function processed a request.")

    name = req.params.get("name")
    if not name:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            name = req_body.get("name")

    if name:
        return func.HttpResponse(
            f"Hello, {name}. This HTTP triggered function executed successfully."
        )
    else:
        return func.HttpResponse(
            "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.",
            status_code=200,
        )


@app.route(route="chat", auth_level=func.AuthLevel.ANONYMOUS)
def chat_with_ai(req: func.HttpRequest) -> func.HttpResponse:
    """
    AI chat endpoint using Azure AI Inference SDK with AI Foundry project context.
    Uses DefaultAzureCredential (managed identity) to authenticate.
    Expects JSON body with 'prompt' field.

    This implementation uses Azure AI Inference SDK instead of OpenAI SDK,
    aligning with AI Foundry's native capabilities.
    """
    logger.info("Processing AI chat request using Azure AI Inference SDK")

    try:
        # Parse request body
        try:
            req_body = req.get_json()
            prompt = req_body.get("prompt")
        except ValueError:
            prompt = req.params.get("prompt")

        if not prompt:
            return func.HttpResponse(
                json.dumps({
                    "error": "Please provide a 'prompt' in the request body or query parameters",
                    "status": "error"
                }),
                mimetype="application/json",
                status_code=400,
            )

        # Initialize clients with project context
        chat_client, credential, ml_client = get_chat_client()

        # Get deployment name from environment or discover
        deployment_name = os.getenv("MODEL_DEPLOYMENT_NAME")

        if not deployment_name:
            # Try to list available deployments
            logger.info(
                "No deployment specified, checking available deployments...")
            deployments = list_deployments_via_api(credential)

            if deployments:
                deployment_name = deployments[0]
                logger.info(
                    f"Using first available deployment: {deployment_name}")
            else:
                return func.HttpResponse(
                    json.dumps({
                        "error": "No model deployments found",
                        "hint": "Please deploy a model in Azure AI Foundry first",
                        "project": ml_client.workspace_name,
                        "status": "error"
                    }),
                    mimetype="application/json",
                    status_code=500,
                )

        logger.info(
            f"Using deployment: {deployment_name} in project: {ml_client.workspace_name}")

        try:
            # Execute chat using AI Inference SDK
            result = chat_with_ai_inference(
                chat_client, ml_client, prompt, deployment_name)

            # Return the formatted response
            return func.HttpResponse(
                json.dumps({
                    "prompt": prompt,
                    **result
                }, indent=2),
                mimetype="application/json",
                status_code=200,
            )

        except Exception as e:
            logger.error(f"Error calling AI Inference: {str(e)}")

            # Check if it's an authentication error
            if "authentication" in str(e).lower() or "401" in str(e):
                error_msg = "Authentication failed. Ensure the Function App's managed identity has proper access to AI Foundry project"
            else:
                error_msg = str(e)

            return func.HttpResponse(
                json.dumps({
                    "error": f"Failed to execute chat: {error_msg}",
                    "deployment_attempted": deployment_name,
                    "project": ml_client.workspace_name,
                    "hint": "Ensure the model is deployed and the managed identity has proper permissions",
                    "status": "error"
                }),
                mimetype="application/json",
                status_code=500,
            )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": f"Internal server error: {str(e)}",
                "status": "error"
            }),
            mimetype="application/json",
            status_code=500,
        )


@app.route(route="health", auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """
    Health check endpoint to verify the function app and AI Foundry connectivity.
    """
    logger.info("Health check requested")

    health_status = {
        "status": "healthy",
        "function_app": "running",
        "configuration": {},
        "ai_foundry": {},
        "sdk": "Azure AI Inference (No OpenAI SDK)"
    }

    # Check configuration
    endpoint = os.getenv("AI_FOUNDRY_ENDPOINT")
    project_name = os.getenv("AI_FOUNDRY_PROJECT_NAME")

    health_status["configuration"]["ai_foundry_endpoint"] = endpoint or "not set"
    health_status["configuration"]["ai_foundry_project"] = project_name or "not set"
    health_status["configuration"]["resource_group"] = os.getenv(
        "RESOURCE_GROUP", "not set")
    health_status["configuration"]["subscription"] = os.getenv(
        "AZURE_SUBSCRIPTION_ID", "not set")

    # Check if model deployment is configured
    deployment_name = os.getenv("MODEL_DEPLOYMENT_NAME")
    health_status["configuration"]["model_deployment"] = deployment_name or "auto-discover"

    # Try to verify AI Foundry connectivity
    try:
        chat_client, credential, ml_client = get_chat_client()
        health_status["ai_foundry"]["client_initialized"] = True
        health_status["ai_foundry"][
            "client_type"] = "ChatCompletionsClient (AI Inference SDK)"
        health_status["ai_foundry"]["project_name"] = ml_client.workspace_name

        # Try to list project models
        try:
            project_models = list_project_models(ml_client)
            health_status["ai_foundry"]["project_models"] = project_models
            health_status["ai_foundry"]["project_model_count"] = len(
                project_models)
        except Exception as e:
            health_status["ai_foundry"]["project_models_error"] = str(e)[:200]

        # Try to list deployments
        try:
            deployments = list_deployments_via_api(credential)
            health_status["ai_foundry"]["available_deployments"] = deployments
            health_status["ai_foundry"]["deployment_count"] = len(deployments)

            if not deployments:
                health_status["ai_foundry"]["warning"] = "No deployments found. Please deploy a model in Azure AI Foundry."
                health_status["status"] = "warning"
        except Exception as e:
            health_status["ai_foundry"]["deployments_error"] = str(e)[:200]

        # Check authentication
        try:
            token = credential.get_token(
                "https://cognitiveservices.azure.com/.default")
            health_status["ai_foundry"]["authentication"] = "Success - Managed Identity working"
        except Exception as e:
            health_status["ai_foundry"]["authentication"] = f"Failed: {str(e)[:100]}"
            health_status["status"] = "unhealthy"

    except Exception as e:
        health_status["ai_foundry"]["client_initialized"] = False
        health_status["ai_foundry"]["error"] = str(e)[:200]
        health_status["status"] = "unhealthy"

    # Overall status determination
    if health_status["status"] == "healthy" and not health_status.get("ai_foundry", {}).get("available_deployments"):
        health_status["status"] = "partially configured"

    return func.HttpResponse(
        json.dumps(health_status, indent=2),
        mimetype="application/json",
        status_code=200,
    )


@app.route(route="list-models", auth_level=func.AuthLevel.ANONYMOUS)
def list_deployed_models(req: func.HttpRequest) -> func.HttpResponse:
    """
    Lists all deployed models in the AI Foundry project.
    Uses ML Client to access project models and REST API for deployments.
    """
    logger.info("Listing deployed models")

    try:
        # Initialize clients
        chat_client, credential, ml_client = get_chat_client()

        # Get model deployments from Cognitive Services
        subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")
        resource_group = os.getenv("RESOURCE_GROUP")

        # Parse account name
        endpoint = os.getenv("AI_FOUNDRY_ENDPOINT", "")
        if "cognitiveservices.azure.com" in endpoint:
            account_name = endpoint.split("//")[1].split(".")[0]
        elif "openai.azure.com" in endpoint:
            account_name = endpoint.split("//")[1].split(".")[0]
        else:
            account_name = "unknown"

        # List deployments
        deployments = list_deployments_via_api(credential)

        # List project models
        project_models = list_project_models(ml_client)

        # Format deployment details if possible
        models_info = []
        if subscription_id and resource_group and account_name != "unknown":
            token = credential.get_token(
                "https://management.azure.com/.default")
            management_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.CognitiveServices/accounts/{account_name}/deployments?api-version=2023-05-01"

            headers = {
                "Authorization": f"Bearer {token.token}",
                "Content-Type": "application/json",
            }

            response = requests.get(
                management_url, headers=headers, timeout=10)

            if response.status_code == 200:
                deployments_data = response.json()
                for deployment in deployments_data.get("value", []):
                    properties = deployment.get("properties", {})
                    model_info = properties.get("model", {})

                    models_info.append({
                        "deployment_name": deployment.get("name"),
                        "model_name": model_info.get("name"),
                        "model_version": model_info.get("version"),
                        "model_format": model_info.get("format"),
                        "capacity": properties.get("scaleSettings", {}).get("capacity"),
                        "provisioning_state": properties.get("provisioningState"),
                        "created_at": properties.get("createdAt"),
                        "updated_at": properties.get("updatedAt"),
                    })

        return func.HttpResponse(
            json.dumps({
                "deployments": models_info if models_info else deployments,
                "project_models": project_models,
                "account": account_name,
                "project": ml_client.workspace_name,
                "resource_group": resource_group,
                "deployment_count": len(models_info) if models_info else len(deployments),
                "project_model_count": len(project_models),
                "status": "success",
                "sdk": "Azure AI Inference SDK",
                "hint": "Using AI Foundry native SDK without OpenAI dependency"
            }, indent=2),
            mimetype="application/json",
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": f"Failed to list models: {str(e)}",
                "hint": "Ensure you have deployed models in Azure AI Foundry and the managed identity has proper permissions",
                "status": "error"
            }),
            mimetype="application/json",
            status_code=500,
        )
