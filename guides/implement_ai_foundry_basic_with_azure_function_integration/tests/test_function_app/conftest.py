# Shared fixtures and configuration for unit tests

import os
import sys
import json
import pytest
from unittest.mock import Mock, patch
import azure.functions as func

# Add function-app directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
function_app_dir = os.path.join(current_dir, '..', '..', 'function-app')
function_app_path = os.path.abspath(function_app_dir)

if function_app_path not in sys.path:
    sys.path.insert(0, function_app_path)

# Now import the function_app module
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
    """Set up Azure environment variables"""
    env_vars = {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_NAME': 'test-project',
        'AI_FOUNDRY_PROJECT_ID': '/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.CognitiveServices/accounts/test-account/projects/test',
        'RESOURCE_GROUP': 'test-rg',
        'AZURE_SUBSCRIPTION_ID': 'test-sub-id',
        'MODEL_DEPLOYMENT_NAME': 'gpt-35-turbo'
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
