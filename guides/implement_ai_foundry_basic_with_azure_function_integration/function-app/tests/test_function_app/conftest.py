# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# Shared fixtures and configuration for unit tests

import os
import sys
import json
import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import azure.functions as func

# Add function-app directory to path (2 levels up)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import function_app  # noqa: E402


@pytest.fixture(autouse=True)
def reset_environment():
    """Reset environment variables before each test"""
    original_environ = os.environ.copy()

    # Reset global variables
    function_app._agent_instance = None
    function_app._project_client = None

    yield

    os.environ.clear()
    os.environ.update(original_environ)


@pytest.fixture
def azure_environment():
    """Set up Azure environment variables for AI Foundry"""
    env_vars = {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_NAME': 'ai-functions',
        'AI_FOUNDRY_PROJECT_ID': '/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.CognitiveServices/accounts/test-account/projects/ai-functions',
        'RESOURCE_GROUP': 'test-rg',
        'AZURE_SUBSCRIPTION_ID': 'test-sub-id',
        'MODEL_DEPLOYMENT_NAME': 'gpt-4',
        'AZURE_AI_API_KEY': 'test-api-key'
    }
    with patch.dict(os.environ, env_vars):
        yield env_vars


@pytest.fixture
def http_request_factory():
    """Factory for creating HTTP requests"""
    def create_request(
        method='GET',
        url='/api/test',
        params=None,
        body=None,
        headers=None
    ):
        if params is None:
            params = {}
        if headers is None:
            headers = {}

        if body is not None and not isinstance(body, bytes):
            if isinstance(body, dict):
                body = json.dumps(body).encode('utf-8')
            else:
                body = str(body).encode('utf-8')

        return func.HttpRequest(
            method=method,
            url=url,
            params=params,
            body=body,
            headers=headers
        )

    return create_request


@pytest.fixture
def mock_agent():
    """Mock agent object"""
    agent = Mock()
    agent.id = 'asst_test123'
    agent.name = 'test-assistant'
    agent.model = 'gpt-4'
    agent.instructions = 'You are a helpful assistant.'
    agent.tools = [{"type": "code_interpreter"}]
    agent.created_at = '2024-01-01T00:00:00Z'
    return agent


@pytest.fixture
def mock_thread():
    """Mock thread object"""
    thread = Mock()
    thread.id = 'thread_test123'
    thread.created_at = '2024-01-01T00:00:00Z'
    return thread


@pytest.fixture
def mock_message():
    """Mock message object"""
    message = Mock()
    message.id = 'msg_test123'
    message.role = 'assistant'
    message.thread_id = 'thread_test123'

    # Create content structure
    content_item = Mock()
    content_item.text = Mock()
    content_item.text.value = 'Test response from assistant'
    message.content = [content_item]

    return message


@pytest.fixture
def mock_run():
    """Mock run object"""
    run = Mock()
    run.id = 'run_test123'
    run.thread_id = 'thread_test123'
    run.agent_id = 'asst_test123'
    run.status = 'completed'
    run.usage = Mock(
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30
    )
    return run


@pytest.fixture
def mock_agents_client(mock_agent, mock_thread, mock_message, mock_run):
    """Mock agents client with nested structure for threads, messages, and runs"""
    agents_client = Mock()

    # Setup list_agents to return a list directly (not a .data attribute)
    agents_client.list_agents = Mock(return_value=[mock_agent])

    # Setup create_agent to dynamically create agent based on input
    def create_agent_side_effect(*args, **kwargs):
        new_agent = Mock()
        new_agent.id = 'asst_test123'
        new_agent.name = kwargs.get('name', 'test-assistant')
        new_agent.model = kwargs.get('model', 'gpt-4')
        new_agent.instructions = kwargs.get(
            'instructions', 'You are a helpful assistant.')
        new_agent.tools = kwargs.get('tools', [])
        new_agent.created_at = '2024-01-01T00:00:00Z'
        return new_agent

    agents_client.create_agent = Mock(side_effect=create_agent_side_effect)

    # Setup delete_agent
    agents_client.delete_agent = Mock()

    # Setup nested threads operations
    agents_client.threads = Mock()
    agents_client.threads.create = Mock(return_value=mock_thread)
    agents_client.threads.get = Mock(return_value=mock_thread)

    # Setup nested messages operations
    agents_client.messages = Mock()
    agents_client.messages.create = Mock(return_value=mock_message)
    agents_client.messages.list = Mock(return_value=[mock_message])

    # Setup nested runs operations
    agents_client.runs = Mock()
    agents_client.runs.create = Mock(return_value=mock_run)
    agents_client.runs.get = Mock(return_value=mock_run)

    return agents_client


@pytest.fixture
def mock_project_client(mock_agents_client):
    """Mock AIProjectClient"""
    project_client = Mock()
    project_client.agents = mock_agents_client
    return project_client


@pytest.fixture
def mock_ai_project_client_class(mock_project_client):
    """Mock AIProjectClient class"""
    with patch('function_app.AIProjectClient') as mock_class:
        mock_class.return_value = mock_project_client
        yield mock_class


@pytest.fixture
def mock_default_credential():
    """Mock DefaultAzureCredential"""
    with patch('function_app.DefaultAzureCredential') as mock_credential_class:
        mock_credential = Mock()
        mock_token = Mock()
        mock_token.token = 'test-azure-token'
        mock_credential.get_token = Mock(return_value=mock_token)
        mock_credential_class.return_value = mock_credential
        yield mock_credential


@pytest.fixture
def mock_azure_key_credential():
    """Mock AzureKeyCredential"""
    with patch('azure.core.credentials.AzureKeyCredential') as mock_key_cred_class:
        mock_credential = Mock()
        mock_credential.key = 'test-api-key'
        mock_key_cred_class.return_value = mock_credential
        yield mock_key_cred_class


@pytest.fixture
def mock_get_project_client(mock_project_client):
    """Mock get_project_client function"""
    with patch('function_app.get_project_client') as mock_func:
        mock_func.return_value = mock_project_client
        yield mock_func


@pytest.fixture
def mock_get_or_create_agent(mock_agent):
    """Mock get_or_create_agent function"""
    with patch('function_app.get_or_create_agent') as mock_func:
        mock_func.return_value = mock_agent
        yield mock_func


@pytest.fixture
def mock_run_agent_conversation():
    """Mock run_agent_conversation function"""
    with patch('function_app.run_agent_conversation') as mock_func:
        mock_func.return_value = {
            "response": "Test response from agent",
            "thread_id": "thread_test123",
            "run_id": "run_test123",
            "agent_id": "asst_test123",
            "agent_name": "test-assistant",
            "status": "completed",
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30
            }
        }
        yield mock_func


@pytest.fixture
def mock_list_agents():
    """Mock list_agents function"""
    with patch('function_app.list_agents') as mock_func:
        mock_func.return_value = [
            {
                "id": "asst_test123",
                "name": "test-assistant",
                "model": "gpt-4",
                "instructions": "You are a helpful assistant...",
                "tools": ["code_interpreter"],
                "created_at": "2024-01-01T00:00:00Z"
            }
        ]
        yield mock_func


@pytest.fixture
def successful_agent_creation_response():
    """Mock successful agent creation response"""
    return {
        "agent_id": "asst_test123",
        "name": "test-assistant",
        "model": "gpt-4",
        "instructions": "You are a helpful AI assistant.",
        "tools": ["{'type': 'code_interpreter'}"],
        "status": "created",
        "timestamp": "2024-01-01T00:00:00.000000"
    }


@pytest.fixture
def successful_chat_response():
    """Mock successful chat response"""
    return {
        "user_message": "Hello",
        "response": "Hello! How can I help you today?",
        "thread_id": "thread_test123",
        "run_id": "run_test123",
        "agent_id": "asst_test123",
        "agent_name": "test-assistant",
        "status": "completed",
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30
        },
        "timestamp": "2024-01-01T00:00:00.000000"
    }


@pytest.fixture
def mock_health_response():
    """Mock health check response structure"""
    return {
        'status': 'healthy',
        'function_app': 'running',
        'configuration': {
            'ai_foundry_endpoint': 'https://test.cognitiveservices.azure.com',
            'ai_foundry_project_id': '/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.CognitiveServices/accounts/test-account/projects/ai-functions',
            'ai_foundry_project_name': 'ai-functions',
            'resource_group': 'test-rg',
            'subscription': 'test-sub-id',
            'model_deployment': 'gpt-4'
        },
        'ai_foundry': {
            'client_initialized': True,
            'client_type': 'AIProjectClient',
            'project_name': 'ai-functions',
            'agents': [],
            'agent_count': 0,
            'info': 'No agents found. Create one using /agent endpoint with action=create.',
            'authentication': 'Success - Managed Identity working'
        },
        'sdk': 'Azure AI Projects SDK (with Agents)'
    }


@pytest.fixture(autouse=True)
def prevent_real_api_calls():
    """Prevent accidental real API calls during tests"""
    with patch('requests.get') as mock_get, \
            patch('requests.post') as mock_post, \
            patch('requests.put') as mock_put, \
            patch('requests.delete') as mock_delete:

        # Configure default responses for safety
        mock_get.return_value = Mock(status_code=404, json=lambda: {})
        mock_post.return_value = Mock(status_code=404, json=lambda: {})
        mock_put.return_value = Mock(status_code=404, json=lambda: {})
        mock_delete.return_value = Mock(status_code=404, json=lambda: {})

        yield


@pytest.fixture
def mock_datetime():
    """Mock datetime for consistent timestamps in tests"""
    with patch('function_app.datetime') as mock_dt:
        mock_now_result = Mock()
        mock_now_result.isoformat.return_value = '2024-01-01T00:00:00.000000'
        mock_now_result.strftime.return_value = '20240101000000'

        mock_dt.now.return_value = mock_now_result

        mock_dt.timezone = Mock()
        mock_dt.timezone.utc = Mock()

        yield mock_dt


@pytest.fixture
def mock_agent_operations_handlers():
    """Mock all handler functions for agent operations"""
    with patch('function_app.handle_create_agent') as mock_create, \
            patch('function_app.handle_chat') as mock_chat, \
            patch('function_app.handle_list_agents') as mock_list, \
            patch('function_app.handle_delete_agent') as mock_delete, \
            patch('function_app.handle_code_interpreter') as mock_code:

        # Configure default successful responses
        mock_create.return_value = func.HttpResponse(
            json.dumps({
                "action": "create",
                "agent_id": "asst_test123",
                "status": "created"
            }),
            mimetype="application/json",
            status_code=201
        )

        mock_chat.return_value = func.HttpResponse(
            json.dumps({
                "action": "chat",
                "response": "Test response",
                "thread_id": "thread_test123"
            }),
            mimetype="application/json",
            status_code=200
        )

        mock_list.return_value = func.HttpResponse(
            json.dumps({
                "action": "list",
                "agents": [],
                "count": 0
            }),
            mimetype="application/json",
            status_code=200
        )

        mock_delete.return_value = func.HttpResponse(
            json.dumps({
                "action": "delete",
                "status": "deleted"
            }),
            mimetype="application/json",
            status_code=200
        )

        mock_code.return_value = func.HttpResponse(
            json.dumps({
                "action": "code-interpreter",
                "result": "Calculation complete",
                "status": "completed"
            }),
            mimetype="application/json",
            status_code=200
        )

        yield {
            'create': mock_create,
            'chat': mock_chat,
            'list': mock_list,
            'delete': mock_delete,
            'code_interpreter': mock_code
        }
