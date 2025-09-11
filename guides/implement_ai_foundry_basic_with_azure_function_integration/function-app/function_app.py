import os
import json
import logging
import azure.functions as func
import requests
from azure.identity import DefaultAzureCredential
from azure.ai.ml import MLClient
from azure.core.exceptions import AzureError

app = func.FunctionApp()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_ml_client():
    """Initialize ML Client with DefaultAzureCredential for AI Foundry connection"""
    try:
        credential = DefaultAzureCredential()
        ml_client = MLClient(
            credential=credential,
            subscription_id=os.getenv("AZURE_SUBSCRIPTION_ID"),
            resource_group_name=os.getenv("RESOURCE_GROUP_NAME"),
            workspace_name=os.getenv("AI_FOUNDRY_PROJECT_NAME")
        )
        return ml_client
    except Exception as e:
        logger.error(f"Failed to initialize ML Client: {str(e)}")
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


@app.route(route="chat", auth_level=func.AuthLevel.FUNCTION)
def chat_with_ai(req: func.HttpRequest) -> func.HttpResponse:
    """
    AI chat endpoint that integrates with AI Foundry model endpoints.
    Uses DefaultAzureCredential to authenticate with AI Foundry.
    Expects JSON body with 'prompt' field.

    Required environment variables:
    - AI_FOUNDRY_PROJECT_NAME: Your AI Foundry Project name
    - AI_FOUNDRY_PROJECT_ID: AI Foundry Project resource ID
    - RESOURCE_GROUP_NAME: Resource group containing the project
    - AZURE_SUBSCRIPTION_ID: Azure subscription ID
    - MODEL_ENDPOINT_NAME: Deployed model endpoint name (optional)
    - MODEL_DEPLOYMENT_NAME: Model deployment name (optional)
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

        # Initialize ML Client
        ml_client = get_ml_client()

        # Get model endpoint configuration from environment
        endpoint_name = os.getenv("MODEL_ENDPOINT_NAME")
        deployment_name = os.getenv("MODEL_DEPLOYMENT_NAME")

        if not endpoint_name:
            # If no specific endpoint is configured, try to list available endpoints
            logger.info(
                "No specific model endpoint configured, checking available endpoints...")
            try:
                endpoints = list(ml_client.online_endpoints.list())
                if endpoints:
                    endpoint_name = endpoints[0].name
                    logger.info(
                        f"Using first available endpoint: {endpoint_name}")
                else:
                    return func.HttpResponse(
                        json.dumps({
                            "error": "No model endpoints found. Please deploy a model to AI Foundry first.",
                            "hint": "Use Azure AI Studio to deploy a model from the model catalog.",
                            "status": "error"
                        }),
                        mimetype="application/json",
                        status_code=500
                    )
            except Exception as e:
                logger.error(f"Could not list endpoints: {str(e)}")
                return func.HttpResponse(
                    json.dumps({
                        "error": "Model endpoint not configured and could not auto-discover.",
                        "details": str(e),
                        "status": "error"
                    }),
                    mimetype="application/json",
                    status_code=500
                )

        logger.info(f"Connecting to AI Foundry endpoint: {endpoint_name}")

        try:
            # Get the endpoint details
            endpoint = ml_client.online_endpoints.get(name=endpoint_name)

            # Get endpoint keys for authentication
            keys = ml_client.online_endpoints.get_keys(name=endpoint_name)

            # Prepare the request headers
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {keys.primary_key}"
            }

            # Add deployment header if specified
            if deployment_name:
                headers["azureml-model-deployment"] = deployment_name

            # Format request based on model type
            # Try to detect if it's an OpenAI-style model
            if any(x in endpoint_name.lower() for x in ['gpt', 'openai', 'phi', 'llama', 'mistral']):
                # OpenAI-style format for chat models
                data = {
                    "messages": [
                        {"role": "system", "content": "You are a helpful AI assistant integrated with Azure Functions."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 800,
                    "temperature": 0.7
                }
            else:
                # Generic format for other models
                data = {
                    "inputs": {
                        "input_string": [prompt]
                    }
                }

            logger.info(f"Calling AI Foundry endpoint: {endpoint.scoring_uri}")

            # Make the API call to the model endpoint
            response = requests.post(
                endpoint.scoring_uri,
                json=data,
                headers=headers,
                timeout=30
            )

            # Check for errors
            if response.status_code != 200:
                logger.error(
                    f"Model endpoint error: {response.status_code} - {response.text}")
                return func.HttpResponse(
                    json.dumps({
                        "error": f"Model endpoint error: {response.status_code}",
                        "details": response.text[:500]
                    }),
                    mimetype="application/json",
                    status_code=response.status_code
                )

            # Parse the response
            result = response.json()

            # Extract the response based on format
            if "choices" in result:
                # OpenAI-style response
                ai_response = result["choices"][0].get(
                    "message", {}).get("content", "No response generated")
            elif isinstance(result, list) and len(result) > 0:
                # List response
                ai_response = result[0]
            else:
                # Generic response
                ai_response = result.get(
                    "output", result.get("generated_text", str(result)))

            # Return the formatted response
            return func.HttpResponse(
                json.dumps({
                    "prompt": prompt,
                    "response": ai_response,
                    "endpoint": endpoint_name,
                    "deployment": deployment_name or "default",
                    "status": "success"
                }, indent=2),
                mimetype="application/json",
                status_code=200
            )

        except Exception as e:
            logger.error(f"Error calling AI Foundry model: {str(e)}")
            return func.HttpResponse(
                json.dumps({
                    "error": f"Failed to call AI Foundry model: {str(e)}",
                    "hint": "Ensure a model is deployed in your AI Foundry project",
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
    Health check endpoint to verify the function app and AI Foundry connectivity.
    """
    logger.info('Health check requested')

    health_status = {
        "status": "healthy",
        "function_app": "running",
        "configuration": {},
        "ai_foundry": {}
    }

    # Check AI Foundry configuration
    project_name = os.getenv("AI_FOUNDRY_PROJECT_NAME")
    if project_name:
        health_status["configuration"]["ai_foundry_project"] = project_name
        health_status["configuration"]["ai_foundry_id"] = os.getenv(
            "AI_FOUNDRY_PROJECT_ID", "not set")
        health_status["configuration"]["resource_group"] = os.getenv(
            "RESOURCE_GROUP_NAME")
        health_status["configuration"]["subscription"] = os.getenv(
            "AZURE_SUBSCRIPTION_ID")

        # Check if model endpoint is configured
        endpoint_name = os.getenv("MODEL_ENDPOINT_NAME")
        if endpoint_name:
            health_status["configuration"]["model_endpoint"] = endpoint_name
            health_status["configuration"]["model_deployment"] = os.getenv(
                "MODEL_DEPLOYMENT_NAME", "not specified")
        else:
            health_status["configuration"]["model_endpoint"] = "auto-discover"

        # Try to verify AI Foundry connectivity
        try:
            ml_client = get_ml_client()
            workspace = ml_client.workspaces.get(name=project_name)
            health_status["ai_foundry"]["connected"] = True
            health_status["ai_foundry"]["project_status"] = workspace.provisioning_state

            # Try to count available endpoints
            try:
                endpoints = list(ml_client.online_endpoints.list())
                health_status["ai_foundry"]["available_endpoints"] = len(
                    endpoints)
                if endpoints and endpoint_name:
                    # Try to get specific endpoint status
                    try:
                        endpoint = ml_client.online_endpoints.get(
                            name=endpoint_name)
                        health_status["ai_foundry"]["endpoint_status"] = endpoint.provisioning_state
                    except:
                        health_status["ai_foundry"]["endpoint_status"] = "not found"
            except Exception as e:
                health_status["ai_foundry"]["endpoints_error"] = str(e)[:100]

        except Exception as e:
            health_status["ai_foundry"]["connected"] = False
            health_status["ai_foundry"]["error"] = str(e)[:200]
    else:
        health_status["configuration"]["ai_foundry"] = "not configured"
        health_status["status"] = "partially configured"

    # Check authentication method
    try:
        credential = DefaultAzureCredential()
        health_status["authentication"] = "DefaultAzureCredential available"
    except:
        health_status["authentication"] = "DefaultAzureCredential not available"

    return func.HttpResponse(
        json.dumps(health_status, indent=2),
        mimetype="application/json",
        status_code=200
    )


@app.route(route="list-models", auth_level=func.AuthLevel.ANONYMOUS)
def list_deployed_models(req: func.HttpRequest) -> func.HttpResponse:
    """
    Lists all deployed model endpoints in the AI Foundry project.
    Useful for discovering available models and their endpoints.
    """
    logger.info('Listing deployed models')

    try:
        # Initialize ML Client
        ml_client = get_ml_client()

        # List all online endpoints
        endpoints = ml_client.online_endpoints.list()

        models_info = []
        for endpoint in endpoints:
            endpoint_info = {
                "endpoint_name": endpoint.name,
                "scoring_uri": endpoint.scoring_uri,
                "auth_mode": endpoint.auth_mode,
                "provisioning_state": endpoint.provisioning_state,
                "deployments": []
            }

            # Try to get deployments for each endpoint
            try:
                deployments = ml_client.online_deployments.list(
                    endpoint_name=endpoint.name)
                for deployment in deployments:
                    endpoint_info["deployments"].append({
                        "name": deployment.name,
                        "model": str(deployment.model) if deployment.model else "N/A",
                        "instance_type": deployment.instance_type if hasattr(deployment, 'instance_type') else "serverless",
                        "instance_count": deployment.instance_count if hasattr(deployment, 'instance_count') else "N/A"
                    })
            except Exception as e:
                logger.warning(
                    f"Could not get deployments for {endpoint.name}: {str(e)}")

            models_info.append(endpoint_info)

        return func.HttpResponse(
            json.dumps({
                "endpoints": models_info,
                "project": os.getenv("AI_FOUNDRY_PROJECT_NAME"),
                "count": len(models_info),
                "status": "success",
                "hint": "Use MODEL_ENDPOINT_NAME environment variable to specify a default endpoint"
            }, indent=2),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": f"Failed to list models: {str(e)}",
                "hint": "Ensure you have deployed models in your AI Foundry project via Azure AI Studio"
            }),
            mimetype="application/json",
            status_code=500
        )
