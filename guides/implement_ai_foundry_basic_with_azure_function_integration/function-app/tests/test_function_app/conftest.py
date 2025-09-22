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

    yield

    os.environ.clear()
    os.environ.update(original_environ)


@pytest.fixture
def azure_environment():
    """Set up Azure environment variables for AI Foundry with AI Inference SDK"""
    env_vars = {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_NAME': 'test-project',
        'RESOURCE_GROUP': 'test-rg',
        'AZURE_SUBSCRIPTION_ID': 'test-sub-id',
        'MODEL_DEPLOYMENT_NAME': 'gpt-4'
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
def mock_requests_get():
    """Mock requests.get method"""
    with patch('function_app.requests.get') as mock_get:
        yield mock_get


@pytest.fixture
def mock_ml_client():
    """Mock Azure ML Client"""
    mock_client = Mock()
    mock_credential = Mock()

    # Setup ML client methods
    mock_client.workspace_name = 'test-project'
    mock_client.models = Mock()
    mock_client.models.list = Mock(return_value=[])
    mock_client.workspaces = Mock()

    # Setup credential token
    mock_token = Mock()
    mock_token.token = 'test-token'
    mock_credential.get_token = Mock(return_value=mock_token)

    with patch('function_app.get_ml_client') as mock_get_ml_client:
        mock_get_ml_client.return_value = (mock_client, mock_credential)
        yield mock_client, mock_credential


@pytest.fixture
def mock_chat_client():
    """Mock Azure AI Inference ChatCompletionsClient"""
    mock_client = Mock()
    mock_credential = Mock()
    mock_ml_client = Mock()
    mock_ml_client.workspace_name = 'test-project'

    # Setup chat client methods
    mock_response = Mock()
    mock_choice = Mock()
    mock_choice.message.content = 'Test AI response'
    mock_response.choices = [mock_choice]
    mock_response.model = 'gpt-4'
    mock_response.usage = Mock(
        prompt_tokens=10, completion_tokens=20, total_tokens=30)

    mock_client.complete = Mock(return_value=mock_response)

    # Setup credential token
    mock_token = Mock()
    mock_token.token = 'test-token'
    mock_credential.get_token = Mock(return_value=mock_token)

    with patch('function_app.get_chat_client') as mock_get_chat_client:
        mock_get_chat_client.return_value = (
            mock_client, mock_credential, mock_ml_client)
        yield mock_client, mock_credential, mock_ml_client


@pytest.fixture
def mock_system_message():
    """Mock SystemMessage for AI Inference SDK"""
    with patch('function_app.SystemMessage') as mock_sys_msg:
        mock_sys_msg.return_value = Mock()
        yield mock_sys_msg


@pytest.fixture
def mock_user_message():
    """Mock UserMessage for AI Inference SDK"""
    with patch('function_app.UserMessage') as mock_usr_msg:
        mock_usr_msg.return_value = Mock()
        yield mock_usr_msg


@pytest.fixture
def mock_project_model():
    """Mock ML project model"""
    model = Mock()
    model.name = 'test-model'
    model.version = '1.0'
    model.description = 'Test model description'
    model.tags = {'type': 'nlp', 'framework': 'pytorch'}
    model.creation_context = Mock()
    model.creation_context.created_by = 'test-user'
    model.creation_context.created_at = '2024-01-01T00:00:00Z'
    return model


@pytest.fixture
def mock_deployment_response():
    """Mock deployment API response"""
    return {
        'value': [
            {
                'name': 'gpt-4-deployment',
                'properties': {
                    'model': {
                        'name': 'gpt-4',
                        'version': '0613',
                        'format': 'OpenAI'
                    },
                    'scaleSettings': {'capacity': 10},
                    'provisioningState': 'Succeeded',
                    'createdAt': '2024-01-01T00:00:00Z',
                    'updatedAt': '2024-01-02T00:00:00Z'
                }
            },
            {
                'name': 'gpt-35-deployment',
                'properties': {
                    'model': {
                        'name': 'gpt-3.5-turbo',
                        'version': '0301',
                        'format': 'OpenAI'
                    },
                    'scaleSettings': {'capacity': 5},
                    'provisioningState': 'Succeeded',
                    'createdAt': '2024-01-01T00:00:00Z',
                    'updatedAt': '2024-01-02T00:00:00Z'
                }
            }
        ]
    }


@pytest.fixture
def successful_chat_response():
    """Mock successful chat response structure for AI Inference SDK"""
    return {
        'response': 'This is a test response from Azure AI Inference',
        'deployment': 'gpt-4',
        'project': 'test-project',
        'model': 'gpt-4',
        'usage': {
            'prompt_tokens': 10,
            'completion_tokens': 20,
            'total_tokens': 30
        },
        'status': 'success'
    }


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
def mock_ml_client_class():
    """Mock MLClient class"""
    with patch('function_app.MLClient') as mock_client_class:
        yield mock_client_class


@pytest.fixture
def mock_chat_completions_client():
    """Mock ChatCompletionsClient class"""
    with patch('function_app.ChatCompletionsClient') as mock_client_class:
        yield mock_client_class


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
def mock_health_response():
    """Mock health check response structure"""
    return {
        'status': 'healthy',
        'function_app': 'running',
        'configuration': {
            'ai_foundry_endpoint': 'https://test.cognitiveservices.azure.com',
            'ai_foundry_project': 'test-project',
            'resource_group': 'test-rg',
            'subscription': 'test-sub-id',
            'model_deployment': 'gpt-4'
        },
        'ai_foundry': {
            'client_initialized': True,
            'client_type': 'ChatCompletionsClient (AI Inference SDK)',
            'project_name': 'test-project',
            'authentication': 'Success - Managed Identity working',
            'available_deployments': ['gpt-4-deployment', 'gpt-35-deployment'],
            'deployment_count': 2,
            'project_models': [],
            'project_model_count': 0
        },
        'sdk': 'Azure AI Inference (No OpenAI SDK)'
    }
