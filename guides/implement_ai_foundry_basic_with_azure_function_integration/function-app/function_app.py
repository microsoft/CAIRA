# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

import os
import json
import logging
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.core.exceptions import AzureError
from azure.ai.inference import ChatCompletionsClient
from azure.ai.projects import AIProjectClient
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timezone

app = func.FunctionApp()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global agent instance (created once and reused)
_agent_instance = None
_project_client = None


def get_project_client() -> AIProjectClient:
    """Initialize Azure AI Project Client"""
    global _project_client

    if _project_client:
        return _project_client

    try:
        credential = DefaultAzureCredential()

        # Get endpoint from environment
        endpoint = os.getenv("AI_FOUNDRY_ENDPOINT")
        if not endpoint:
            raise ValueError(
                "AI_FOUNDRY_ENDPOINT environment variable is not set")

        # Build project endpoint in the correct format
        project_name = os.getenv("AI_FOUNDRY_PROJECT_NAME", "ai-functions")

        # Transform cognitive services endpoint to AI Foundry endpoint
        if "cognitiveservices.azure.com" in endpoint:
            account_name = endpoint.split("//")[1].split(".")[0]
            project_endpoint = f"https://{account_name}.services.ai.azure.com/api/projects/{project_name}"
        else:
            project_endpoint = endpoint

        # Create AI Project Client
        _project_client = AIProjectClient(
            endpoint=project_endpoint,
            credential=credential
        )

        logger.info(
            f"AI Project Client initialized for endpoint: {project_endpoint}")
        return _project_client

    except Exception as e:
        logger.error(f"Failed to initialize AI Project Client: {str(e)}")
        raise


def get_or_create_agent() -> Any:
    """Get existing agent or create a new one"""
    global _agent_instance

    if _agent_instance:
        return _agent_instance

    try:
        project_client = get_project_client()
        agents_client = project_client.agents

        # Try to find existing agent
        agent_name = "azure-function-assistant"
        try:
            agents = agents_client.list_agents()
            for agent in agents:
                if agent.name == agent_name:
                    logger.info(f"Using existing agent: {agent.id}")
                    _agent_instance = agent
                    return agent
        except:
            pass  # No existing agent found, create new one

        # Create new agent with tools
        logger.info("Creating new AI agent...")

        # Configure tools for the agent
        code_interpreter_tool = {"type": "code_interpreter"}
        file_search_tool = {"type": "file_search"}

        # Create the agent
        _agent_instance = agents_client.create_agent(
            model=os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4"),
            name=agent_name,
            instructions="""You are an intelligent AI assistant deployed through Azure AI Projects.
            You help users with various tasks including:
            - Answering questions
            - Performing calculations using code interpreter
            - Analyzing and searching through files
            - Providing helpful, accurate, and concise responses

            You have access to code interpreter and file search capabilities.""",
            tools=[code_interpreter_tool, file_search_tool]
        )

        logger.info(f"Created new agent: {_agent_instance.id}")
        return _agent_instance

    except Exception as e:
        logger.error(f"Failed to create agent: {str(e)}")
        raise


def run_agent_conversation(agent: Any, user_message: str, thread_id: Optional[str] = None) -> Dict:
    """Run a conversation with the agent"""
    try:
        project_client = get_project_client()
        agents_client = project_client.agents

        # Create or retrieve thread
        if thread_id:
            thread = agents_client.threads.get(thread_id)
            logger.info(f"Using existing thread: {thread_id}")
        else:
            thread = agents_client.threads.create()
            logger.info(f"Created new thread: {thread.id}")

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

        # Get messages from the thread
        messages = agents_client.messages.list(thread_id=thread.id)

        # Extract the latest assistant response
        assistant_response = None
        for msg in messages:
            if msg.role == "assistant":
                # Handle different content types
                if hasattr(msg, 'content') and msg.content:
                    if isinstance(msg.content, list) and len(msg.content) > 0:
                        content_item = msg.content[0]
                        if hasattr(content_item, 'text'):
                            assistant_response = content_item.text.value
                    elif isinstance(msg.content, str):
                        assistant_response = msg.content
                break

        return {
            "response": assistant_response or "No response generated",
            "thread_id": thread.id,
            "run_id": run.id,
            "agent_id": agent.id,
            "agent_name": agent.name,
            "status": run.status,
            "usage": {
                "prompt_tokens": run.usage.prompt_tokens if hasattr(run, 'usage') and run.usage else 0,
                "completion_tokens": run.usage.completion_tokens if hasattr(run, 'usage') and run.usage else 0,
                "total_tokens": run.usage.total_tokens if hasattr(run, 'usage') and run.usage else 0,
            }
        }

    except Exception as e:
        logger.error(f"Error in agent conversation: {str(e)}")
        raise


def list_agents() -> List[Dict]:
    """List all agents in the project"""
    try:
        project_client = get_project_client()
        agents_client = project_client.agents

        agents = agents_client.list_agents()
        agent_list = []

        for agent in agents:
            agent_list.append({
                "id": agent.id,
                "name": agent.name,
                "model": agent.model,
                "instructions": agent.instructions[:200] + "..." if len(agent.instructions) > 200 else agent.instructions,
                "tools": [str(tool) for tool in agent.tools] if hasattr(agent, 'tools') and agent.tools else [],
                "created_at": agent.created_at if hasattr(agent, 'created_at') else None
            })

        return agent_list
    except Exception as e:
        logger.error(f"Error listing agents: {str(e)}")
        return []


@app.route(route="health", auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """Health check endpoint to verify function app and AI Foundry connectivity."""
    logger.info("Health check requested")

    health_status = {
        "status": "healthy",
        "function_app": "running",
        "configuration": {},
        "ai_foundry": {},
        "sdk": "Azure AI Projects SDK (with Agents)"
    }

    # Check configuration
    health_status["configuration"] = {
        "ai_foundry_endpoint": os.getenv("AI_FOUNDRY_ENDPOINT", "not set"),
        "ai_foundry_project_id": os.getenv("AI_FOUNDRY_PROJECT_ID", "not set"),
        "ai_foundry_project_name": os.getenv("AI_FOUNDRY_PROJECT_NAME", "not set"),
        "resource_group": os.getenv("RESOURCE_GROUP", "not set"),
        "subscription": os.getenv("AZURE_SUBSCRIPTION_ID", "not set"),
        "model_deployment": os.getenv("MODEL_DEPLOYMENT_NAME", "auto-discover")
    }

    # Try to verify AI Foundry connectivity
    try:
        project_client = get_project_client()
        health_status["ai_foundry"]["client_initialized"] = True
        health_status["ai_foundry"]["client_type"] = "AIProjectClient"
        health_status["ai_foundry"]["project_name"] = os.getenv(
            "AI_FOUNDRY_PROJECT_NAME")

        # Try to list agents
        try:
            agents = list_agents()
            health_status["ai_foundry"]["agents"] = agents
            health_status["ai_foundry"]["agent_count"] = len(agents)

            if len(agents) == 0:
                health_status["ai_foundry"]["info"] = "No agents found. Create one using /agent endpoint with action=create."
        except Exception as e:
            health_status["ai_foundry"]["agents_error"] = str(e)[:200]

        # Check authentication
        try:
            credential = DefaultAzureCredential()
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

    return func.HttpResponse(
        json.dumps(health_status, indent=2),
        mimetype="application/json",
        status_code=200,
    )


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

    Expected JSON body:
    {
        "action": "create|chat|list|delete|code-interpreter",
        ... additional parameters based on action ...
    }
    """
    logger.info("Agent operation requested")

    try:
        # Parse request body
        try:
            req_body = req.get_json()
            action = req_body.get("action")
        except ValueError:
            # Fallback to query parameters
            action = req.params.get("action")
            req_body = {}

        if not action:
            return func.HttpResponse(
                json.dumps({
                    "error": "Please provide an 'action' parameter",
                    "available_actions": ["create", "chat", "list", "delete", "code-interpreter"],
                    "status": "error"
                }),
                mimetype="application/json",
                status_code=400,
            )

        # Route to appropriate action handler
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
                json.dumps({
                    "error": f"Unknown action: {action}",
                    "available_actions": ["create", "chat", "list", "delete", "code-interpreter"],
                    "status": "error"
                }),
                mimetype="application/json",
                status_code=400,
            )

    except Exception as e:
        logger.error(f"Error in agent operations: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": f"Failed to process agent operation: {str(e)}",
                "status": "error"
            }),
            mimetype="application/json",
            status_code=500,
        )


def handle_create_agent(req_body: dict) -> func.HttpResponse:
    """Handle agent creation"""
    try:
        project_client = get_project_client()
        agents_client = project_client.agents

        # Configure tools based on request
        tools = []
        if req_body.get("enable_code_interpreter", True):
            tools.append({"type": "code_interpreter"})
        if req_body.get("enable_file_search", False):
            tools.append({"type": "file_search"})

        # Create agent
        agent = agents_client.create_agent(
            model=req_body.get("model", os.getenv(
                "MODEL_DEPLOYMENT_NAME", "gpt-4")),
            name=req_body.get(
                "name", f"custom-agent-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"),
            instructions=req_body.get(
                "instructions", "You are a helpful AI assistant."),
            tools=tools
        )

        return func.HttpResponse(
            json.dumps({
                "action": "create",
                "agent_id": agent.id,
                "name": agent.name,
                "model": agent.model,
                "instructions": agent.instructions,
                "tools": [str(tool) for tool in tools],
                "status": "created",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, indent=2),
            mimetype="application/json",
            status_code=201,
        )

    except Exception as e:
        logger.error(f"Error creating agent: {str(e)}")
        raise


def handle_chat(req_body: dict, params: dict) -> func.HttpResponse:
    """Handle chat with agent"""
    try:
        message = req_body.get("message") or req_body.get(
            "prompt") or params.get("message") or params.get("prompt")
        thread_id = req_body.get("thread_id") or params.get("thread_id")

        if not message:
            return func.HttpResponse(
                json.dumps({
                    "error": "Please provide a 'message' in the request",
                    "status": "error"
                }),
                mimetype="application/json",
                status_code=400,
            )

        # Get or create agent
        agent = get_or_create_agent()

        # Run conversation
        result = run_agent_conversation(agent, message, thread_id)

        return func.HttpResponse(
            json.dumps({
                "action": "chat",
                "user_message": message,
                **result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, indent=2),
            mimetype="application/json",
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        raise


def handle_list_agents() -> func.HttpResponse:
    """Handle listing agents"""
    try:
        agents = list_agents()

        return func.HttpResponse(
            json.dumps({
                "action": "list",
                "agents": agents,
                "count": len(agents),
                "project": os.getenv("AI_FOUNDRY_PROJECT_NAME"),
                "status": "success"
            }, indent=2),
            mimetype="application/json",
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Error listing agents: {str(e)}")
        raise


def handle_delete_agent(req_body: dict, params: dict) -> func.HttpResponse:
    """Handle agent deletion"""
    try:
        agent_id = req_body.get("agent_id") or params.get("agent_id")

        if not agent_id:
            return func.HttpResponse(
                json.dumps({
                    "error": "Please provide 'agent_id' to delete",
                    "status": "error"
                }),
                mimetype="application/json",
                status_code=400,
            )

        project_client = get_project_client()
        agents_client = project_client.agents

        # Delete the agent
        agents_client.delete_agent(agent_id)

        # Clear global instance if it was deleted
        global _agent_instance
        if _agent_instance and _agent_instance.id == agent_id:
            _agent_instance = None

        return func.HttpResponse(
            json.dumps({
                "action": "delete",
                "agent_id": agent_id,
                "status": "deleted",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, indent=2),
            mimetype="application/json",
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Error deleting agent: {str(e)}")
        raise


def handle_code_interpreter(req_body: dict) -> func.HttpResponse:
    """Handle code interpreter demonstration"""
    try:
        code_task = req_body.get(
            "code_task", "Calculate the sum of squares from 1 to 10")

        project_client = get_project_client()
        agents_client = project_client.agents

        # Create specialized agent for code tasks
        code_agent = agents_client.create_agent(
            model=os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4"),
            name=f"code-interpreter-{datetime.now(timezone.utc).strftime('%H%M%S')}",
            instructions="You are a Python code expert. Use the code interpreter to solve computational tasks.",
            tools=[{"type": "code_interpreter"}]
        )

        # Run the code task
        thread = agents_client.threads.create()
        message = agents_client.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"Please solve this task using code: {code_task}"
        )

        run = agents_client.runs.create(
            thread_id=thread.id,
            agent_id=code_agent.id
        )

        # Wait for completion
        while run.status in ["queued", "in_progress"]:
            run = agents_client.runs.get(thread_id=thread.id, run_id=run.id)

        # Get results
        messages = agents_client.messages.list(thread_id=thread.id)
        result = None
        for msg in messages:
            if msg.role == "assistant":
                if hasattr(msg, 'content') and msg.content:
                    if isinstance(msg.content, list) and len(msg.content) > 0:
                        content_item = msg.content[0]
                        if hasattr(content_item, 'text'):
                            result = content_item.text.value
                    elif isinstance(msg.content, str):
                        result = msg.content
                break

        # Clean up temporary agent
        agents_client.delete_agent(code_agent.id)

        return func.HttpResponse(
            json.dumps({
                "action": "code-interpreter",
                "task": code_task,
                "result": result,
                "thread_id": thread.id,
                "status": "completed",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, indent=2),
            mimetype="application/json",
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Error in code interpreter: {str(e)}")
        raise


@app.route(route="demo", auth_level=func.AuthLevel.ANONYMOUS)
def demo_agent_capabilities(req: func.HttpRequest) -> func.HttpResponse:
    """
    One-click demonstration of the entire integration.
    Shows creating an agent, having a conversation, and using tools.
    """
    logger.info("Running agent capabilities demo")

    demo_results = {
        "demo": "Complete Agent Integration Showcase",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "steps": []
    }

    try:
        project_client = get_project_client()
        agents_client = project_client.agents

        # Step 1: Create a demo agent
        demo_results["steps"].append(
            {"step": 1, "action": "Creating demo agent"})

        demo_agent = agents_client.create_agent(
            model=os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4"),
            name=f"demo-agent-{datetime.now(timezone.utc).strftime('%H%M%S')}",
            instructions="""You are a demonstration agent showcasing Azure AI Foundry capabilities.
            You can:
            1. Answer questions
            2. Perform calculations using code interpreter
            3. Maintain conversation context""",
            tools=[{"type": "code_interpreter"}]
        )

        demo_results["agent_created"] = {
            "id": demo_agent.id,
            "name": demo_agent.name
        }

        # Step 2: Create a conversation thread
        demo_results["steps"].append(
            {"step": 2, "action": "Creating conversation thread"})
        thread = agents_client.threads.create()
        demo_results["thread_id"] = thread.id

        # Step 3: Ask a general question
        demo_results["steps"].append(
            {"step": 3, "action": "Asking general question"})

        msg1 = agents_client.messages.create(
            thread_id=thread.id,
            role="user",
            content="Hello! What can you help me with today?"
        )

        run1 = agents_client.runs.create(
            thread_id=thread.id,
            agent_id=demo_agent.id
        )

        while run1.status in ["queued", "in_progress"]:
            run1 = agents_client.runs.get(thread_id=thread.id, run_id=run1.id)

        # Step 4: Ask for a calculation
        demo_results["steps"].append(
            {"step": 4, "action": "Requesting calculation with code interpreter"})

        msg2 = agents_client.messages.create(
            thread_id=thread.id,
            role="user",
            content="Calculate the factorial of 10 and explain what factorial means"
        )

        run2 = agents_client.runs.create(
            thread_id=thread.id,
            agent_id=demo_agent.id
        )

        while run2.status in ["queued", "in_progress"]:
            run2 = agents_client.runs.get(thread_id=thread.id, run_id=run2.id)

        # Get all messages
        messages = agents_client.messages.list(thread_id=thread.id)

        conversation = []
        for msg in reversed(list(messages)):
            content_text = ""
            if hasattr(msg, 'content') and msg.content:
                if isinstance(msg.content, list) and len(msg.content) > 0:
                    content_item = msg.content[0]
                    if hasattr(content_item, 'text'):
                        content_text = content_item.text.value
                elif isinstance(msg.content, str):
                    content_text = msg.content

            conversation.append({
                "role": msg.role,
                "content": content_text or "No content"
            })

        demo_results["conversation"] = conversation

        # Clean up demo agent
        agents_client.delete_agent(demo_agent.id)
        demo_results["cleanup"] = "Demo agent deleted"

        demo_results["status"] = "success"
        demo_results["summary"] = "Successfully demonstrated agent creation, conversation, and code interpreter capabilities"

        return func.HttpResponse(
            json.dumps(demo_results, indent=2),
            mimetype="application/json",
            status_code=200,
        )

    except Exception as e:
        demo_results["error"] = str(e)
        demo_results["status"] = "error"

        return func.HttpResponse(
            json.dumps(demo_results, indent=2),
            mimetype="application/json",
            status_code=500,
        )
