import os
import json
import logging
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.core.exceptions import AzureError
from openai import AzureOpenAI
import requests

app = func.FunctionApp()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_openai_client():
    """Initialize Azure OpenAI Client with DefaultAzureCredential"""
    try:
        # Get the endpoint from environment variables
        endpoint = os.getenv("AI_FOUNDRY_ENDPOINT",
                             "https://cog-basic-k4qzw.openai.azure.com/")

        # Use DefaultAzureCredential for managed identity authentication
        credential = DefaultAzureCredential()

        # Get access token for cognitive services
        token = credential.get_token(
            "https://cognitiveservices.azure.com/.default")

        # Create Azure OpenAI client
        client = AzureOpenAI(
            azure_endpoint=endpoint.replace(
                "cognitiveservices.azure.com", "openai.azure.com"),
            azure_ad_token=token.token,
            api_version="2024-02-01"
        )

        return client, credential
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI Client: {str(e)}")
        raise


def list_deployments_via_api(credential):
    """List deployments using the Cognitive Services REST API"""
    try:
        # Get configuration
        endpoint = os.getenv(
            "AI_FOUNDRY_ENDPOINT", "https://cog-basic-k4qzw.cognitiveservices.azure.com/")

        # Get access token
        token = credential.get_token("https://management.azure.com/.default")

        # Parse the resource ID from the AI_FOUNDRY_PROJECT_ID
        project_id = os.getenv("AI_FOUNDRY_PROJECT_ID", "")
        if "/providers/Microsoft.CognitiveServices/accounts/" in project_id:
            account_name = project_id.split(
                "/providers/Microsoft.CognitiveServices/accounts/")[1].split("/")[0]
        else:
            account_name = "cog-basic-k4qzw"  # Fallback

        # Construct management API URL for deployments
        subscription_id = os.getenv(
            "AZURE_SUBSCRIPTION_ID", "2445fdd8-5e2c-4da4-8e51-8da0deba3b81")
        resource_group = os.getenv("RESOURCE_GROUP", "rg-basic-k4qzw")

        management_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.CognitiveServices/accounts/{account_name}/deployments?api-version=2023-05-01"

        headers = {
            "Authorization": f"Bearer {token.token}",
            "Content-Type": "application/json"
        }

        response = requests.get(management_url, headers=headers)

        if response.status_code == 200:
            deployments = response.json().get("value", [])
            return [d["name"] for d in deployments if d.get("properties", {}).get("provisioningState") == "Succeeded"]
        else:
            logger.warning(
                f"Could not list deployments: {response.status_code}")
            return []

    except Exception as e:
        logger.error(f"Error listing deployments: {str(e)}")
        return []


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


@app.route(route="chat", auth_level=func.AuthLevel.FUNCTION)
def chat_with_ai(req: func.HttpRequest) -> func.HttpResponse:
    """
    AI chat endpoint that integrates with Azure OpenAI.
    Uses DefaultAzureCredential (managed identity) to authenticate.
    Expects JSON body with 'prompt' field.

    Required environment variables:
    - AI_FOUNDRY_ENDPOINT: Your Cognitive Services endpoint
    - MODEL_DEPLOYMENT_NAME: OpenAI model deployment name (e.g., 'gpt-35-turbo', 'gpt-4')
    """
    logger.info('Processing AI chat request')

    try:
        # Parse request body
        try:
            req_body = req.get_json()
            prompt = req_body.get('prompt')
        except ValueError:
            prompt = req.params.get('prompt')

        if not prompt:
            return func.HttpResponse(
                json.dumps(
                    {"error": "Please provide a 'prompt' in the request body or query parameters"}),
                mimetype="application/json",
                status_code=400
            )

        # Initialize OpenAI Client
        client, credential = get_openai_client()

        # Get deployment name from environment or use default
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
                        "hint": "Please deploy a model (like GPT-3.5 or GPT-4) in Azure AI Studio first",
                        "endpoint": os.getenv("AI_FOUNDRY_ENDPOINT"),
                        "status": "error"
                    }),
                    mimetype="application/json",
                    status_code=500
                )

        logger.info(f"Using deployment: {deployment_name}")

        try:
            # Make the chat completion request
            response = client.chat.completions.create(
                model=deployment_name,
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant integrated with Azure Functions."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.7
            )

            # Extract the response
            ai_response = response.choices[0].message.content

            # Return the formatted response
            return func.HttpResponse(
                json.dumps({
                    "prompt": prompt,
                    "response": ai_response,
                    "deployment": deployment_name,
                    "model": response.model,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    },
                    "status": "success"
                }, indent=2),
                mimetype="application/json",
                status_code=200
            )

        except Exception as e:
            logger.error(f"Error calling Azure OpenAI: {str(e)}")

            # Check if it's an authentication error
            if "authentication" in str(e).lower() or "401" in str(e):
                error_msg = "Authentication failed. Ensure the Function App's managed identity has 'Cognitive Services OpenAI User' role"
            else:
                error_msg = str(e)

            return func.HttpResponse(
                json.dumps({
                    "error": f"Failed to call Azure OpenAI: {error_msg}",
                    "deployment_attempted": deployment_name,
                    "hint": "Ensure the model is deployed and the managed identity has proper permissions",
                    "status": "error"
                }),
                mimetype="application/json",
                status_code=500
            )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return func.HttpResponse(
            json.dumps(
                {"error": f"Internal server error: {str(e)}", "status": "error"}),
            mimetype="application/json",
            status_code=500
        )


@app.route(route="health", auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """
    Health check endpoint to verify the function app and Azure OpenAI connectivity.
    """
    logger.info('Health check requested')

    health_status = {
        "status": "healthy",
        "function_app": "running",
        "configuration": {},
        "azure_openai": {}
    }

    # Check configuration
    endpoint = os.getenv("AI_FOUNDRY_ENDPOINT")
    project_name = os.getenv("AI_FOUNDRY_PROJECT_NAME")

    health_status["configuration"]["ai_foundry_endpoint"] = endpoint or "not set"
    health_status["configuration"]["ai_foundry_project"] = project_name or "not set"
    health_status["configuration"]["ai_foundry_id"] = os.getenv(
        "AI_FOUNDRY_PROJECT_ID", "not set")
    health_status["configuration"]["resource_group"] = os.getenv(
        "RESOURCE_GROUP", "not set")
    health_status["configuration"]["subscription"] = os.getenv(
        "AZURE_SUBSCRIPTION_ID", "not set")

    # Check if model deployment is configured
    deployment_name = os.getenv("MODEL_DEPLOYMENT_NAME")
    health_status["configuration"]["model_deployment"] = deployment_name or "auto-discover"

    # Try to verify Azure OpenAI connectivity
    try:
        client, credential = get_openai_client()
        health_status["azure_openai"]["client_initialized"] = True

        # Try to list deployments
        try:
            deployments = list_deployments_via_api(credential)
            health_status["azure_openai"]["available_deployments"] = deployments
            health_status["azure_openai"]["deployment_count"] = len(
                deployments)

            if not deployments:
                health_status["azure_openai"]["warning"] = "No deployments found. Please deploy a model in Azure AI Studio."
                health_status["status"] = "warning"
        except Exception as e:
            health_status["azure_openai"]["deployments_error"] = str(e)[:200]

        # Check authentication
        try:
            token = credential.get_token(
                "https://cognitiveservices.azure.com/.default")
            health_status["azure_openai"]["authentication"] = "Success - Managed Identity working"
        except Exception as e:
            health_status["azure_openai"]["authentication"] = f"Failed: {str(e)[:100]}"
            health_status["status"] = "unhealthy"

    except Exception as e:
        health_status["azure_openai"]["client_initialized"] = False
        health_status["azure_openai"]["error"] = str(e)[:200]
        health_status["status"] = "unhealthy"

    # Overall status determination
    if health_status["status"] == "healthy" and not health_status.get("azure_openai", {}).get("available_deployments"):
        health_status["status"] = "partially configured"

    return func.HttpResponse(
        json.dumps(health_status, indent=2),
        mimetype="application/json",
        status_code=200
    )


@app.route(route="list-models", auth_level=func.AuthLevel.ANONYMOUS)
def list_deployed_models(req: func.HttpRequest) -> func.HttpResponse:
    """
    Lists all deployed models in the Cognitive Services account.
    Uses the Azure Management API to get deployment information.
    """
    logger.info('Listing deployed models')

    try:
        # Initialize credential
        credential = DefaultAzureCredential()

        # Get configuration
        subscription_id = os.getenv(
            "AZURE_SUBSCRIPTION_ID", "2445fdd8-5e2c-4da4-8e51-8da0deba3b81")
        resource_group = os.getenv("RESOURCE_GROUP", "rg-basic-k4qzw")

        # Parse account name from project ID or use default
        project_id = os.getenv("AI_FOUNDRY_PROJECT_ID", "")
        if "/providers/Microsoft.CognitiveServices/accounts/" in project_id:
            account_name = project_id.split(
                "/providers/Microsoft.CognitiveServices/accounts/")[1].split("/")[0]
        else:
            account_name = "cog-basic-k4qzw"

        # Get access token for management API
        token = credential.get_token("https://management.azure.com/.default")

        # Construct management API URL
        management_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.CognitiveServices/accounts/{account_name}/deployments?api-version=2023-05-01"

        headers = {
            "Authorization": f"Bearer {token.token}",
            "Content-Type": "application/json"
        }

        # Make the API call
        response = requests.get(management_url, headers=headers, timeout=10)

        if response.status_code == 200:
            deployments_data = response.json()
            deployments = deployments_data.get("value", [])

            models_info = []
            for deployment in deployments:
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
                    "updated_at": properties.get("updatedAt")
                })

            return func.HttpResponse(
                json.dumps({
                    "deployments": models_info,
                    "account": account_name,
                    "resource_group": resource_group,
                    "count": len(models_info),
                    "status": "success",
                    "hint": "Use MODEL_DEPLOYMENT_NAME environment variable to specify a default deployment"
                }, indent=2),
                mimetype="application/json",
                status_code=200
            )
        else:
            error_detail = response.text[:500] if response.text else "No details available"
            return func.HttpResponse(
                json.dumps({
                    "error": f"Failed to list deployments: HTTP {response.status_code}",
                    "details": error_detail,
                    "hint": "Ensure the managed identity has proper permissions to the Cognitive Services account"
                }),
                mimetype="application/json",
                status_code=response.status_code
            )

    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": f"Failed to list models: {str(e)}",
                "hint": "Ensure you have deployed models in Azure AI Studio and the managed identity has proper permissions"
            }),
            mimetype="application/json",
            status_code=500
        )
