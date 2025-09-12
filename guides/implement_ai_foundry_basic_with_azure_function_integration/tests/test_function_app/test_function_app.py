"""
Unit tests for Azure Function App
"""

import os
import json
import sys
import pytest
from unittest.mock import Mock, patch, MagicMock
import azure.functions as func
from azure.core.exceptions import AzureError
from azure.identity import DefaultAzureCredential
import requests
import function_app


class TestGetOpenAIClient:
    """Test cases for get_openai_client function following AAA pattern"""

    @patch.dict(os.environ, {'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com'})
    @patch('function_app.DefaultAzureCredential')
    @patch('function_app.AzureOpenAI')
    def test_get_openai_client_success(self, mock_openai, mock_credential):
        """Test successful OpenAI client initialization"""
        # Arrange
        mock_cred_instance = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_cred_instance.get_token.return_value = mock_token
        mock_credential.return_value = mock_cred_instance

        mock_client = Mock()
        mock_openai.return_value = mock_client

        # Act
        client, credential = function_app.get_openai_client()

        # Assert
        assert client == mock_client
        assert credential == mock_cred_instance
        mock_cred_instance.get_token.assert_called_once_with(
            "https://cognitiveservices.azure.com/.default")
        mock_openai.assert_called_once_with(
            azure_endpoint='https://test.openai.azure.com',
            azure_ad_token='test-token',
            api_version='2024-02-01'
        )

    @patch.dict(os.environ, {}, clear=True)
    def test_get_openai_client_missing_endpoint(self):
        """Test client initialization with missing endpoint"""
        # Arrange
        # Environment is cleared in decorator, no endpoint set

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            function_app.get_openai_client()

        # Assert
        assert "AI_FOUNDRY_ENDPOINT environment variable is not set" in str(
            exc_info.value)

    @patch.dict(os.environ, {'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com'})
    @patch('function_app.DefaultAzureCredential')
    def test_get_openai_client_credential_failure(self, mock_credential):
        """Test client initialization with credential failure"""
        # Arrange
        expected_error_message = "Authentication failed"
        mock_credential.side_effect = Exception(expected_error_message)

        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            function_app.get_openai_client()

        # Assert
        assert expected_error_message in str(exc_info.value)


class TestListDeploymentsViaAPI:
    """Test cases for list_deployments_via_api function following AAA pattern"""

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_ID': '/subscriptions/sub-id/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/test-account/projects/test',
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg'
    })
    @patch('function_app.requests.get')
    def test_list_deployments_success(self, mock_get):
        """Test successful deployment listing"""
        # Arrange
        mock_credential = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'value': [
                {'name': 'deployment1', 'properties': {
                    'provisioningState': 'Succeeded'}},
                {'name': 'deployment2', 'properties': {
                    'provisioningState': 'Succeeded'}},
                {'name': 'deployment3', 'properties': {
                    'provisioningState': 'Failed'}}
            ]
        }
        mock_get.return_value = mock_response
        expected_deployments = ['deployment1', 'deployment2']

        # Act
        result = function_app.list_deployments_via_api(mock_credential)

        # Assert
        assert result == expected_deployments
        mock_credential.get_token.assert_called_once_with(
            "https://management.azure.com/.default")
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert 'test-account' in call_args[0][0]  # URL contains account name
        assert call_args[1]['headers']['Authorization'] == 'Bearer test-token'

    @patch.dict(os.environ, {}, clear=True)
    def test_list_deployments_missing_endpoint(self):
        """Test deployment listing with missing endpoint"""
        # Arrange
        mock_credential = Mock()
        expected_result = []

        # Act
        result = function_app.list_deployments_via_api(mock_credential)

        # Assert
        assert result == expected_result
        mock_credential.get_token.assert_not_called()

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_ID': 'invalid-format',
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg'
    })
    def test_list_deployments_invalid_project_id(self):
        """Test deployment listing with invalid project ID format"""
        # Arrange
        mock_credential = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token
        expected_result = []

        # Act
        result = function_app.list_deployments_via_api(mock_credential)

        # Assert
        assert result == expected_result
        mock_credential.get_token.assert_called_once()

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_ID': '/subscriptions/sub-id/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/test-account/projects/test',
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg'
    })
    @patch('function_app.requests.get')
    def test_list_deployments_api_error(self, mock_get):
        """Test deployment listing with API error response"""
        # Arrange
        mock_credential = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token

        mock_response = Mock()
        mock_response.status_code = 403
        mock_get.return_value = mock_response
        expected_result = []

        # Act
        result = function_app.list_deployments_via_api(mock_credential)

        # Assert
        assert result == expected_result
        mock_get.assert_called_once()


class TestHttpExample:
    """Test cases for HttpExample function following AAA pattern"""

    def test_http_example_with_query_param(self):
        """Test HttpExample with name in query parameters"""
        # Arrange
        test_name = 'TestUser'
        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/HttpExample',
            params={'name': test_name}
        )
        expected_message = f"Hello, {test_name}"

        # Act
        response = function_app.HttpExample(req)

        # Assert
        assert response.status_code == 200
        assert expected_message.encode() in response.get_body()

    def test_http_example_with_json_body(self):
        """Test HttpExample with name in JSON body"""
        # Arrange
        test_name = 'TestUser'
        request_body = json.dumps({'name': test_name}).encode('utf-8')
        req = func.HttpRequest(
            method='POST',
            body=request_body,
            url='/api/HttpExample',
            params={}
        )
        expected_message = f"Hello, {test_name}"

        # Act
        response = function_app.HttpExample(req)

        # Assert
        assert response.status_code == 200
        assert expected_message.encode() in response.get_body()

    def test_http_example_without_name(self):
        """Test HttpExample without name parameter"""
        # Arrange
        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/HttpExample',
            params={}
        )
        expected_message = "This HTTP triggered function executed successfully"

        # Act
        response = function_app.HttpExample(req)

        # Assert
        assert response.status_code == 200
        assert expected_message.encode() in response.get_body()
        assert b"Pass a name" in response.get_body()

    def test_http_example_with_invalid_json(self):
        """Test HttpExample with invalid JSON body"""
        # Arrange
        req = func.HttpRequest(
            method='POST',
            body=b'{"invalid json}',
            url='/api/HttpExample',
            params={}
        )
        expected_message = "This HTTP triggered function executed successfully"

        # Act
        response = function_app.HttpExample(req)

        # Assert
        assert response.status_code == 200
        assert expected_message.encode() in response.get_body()


class TestChatWithAI:
    """Test cases for chat_with_ai function following AAA pattern"""

    @patch.dict(os.environ, {'MODEL_DEPLOYMENT_NAME': 'gpt-35-turbo'})
    @patch('function_app.get_openai_client')
    def test_chat_success(self, mock_get_client):
        """Test successful chat completion"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)

        test_prompt = 'Hello AI'
        expected_ai_response = 'AI response'
        expected_model = 'gpt-35-turbo'

        mock_response = Mock()
        mock_response.choices = [
            Mock(message=Mock(content=expected_ai_response))]
        mock_response.model = expected_model
        mock_response.usage = Mock(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30
        )
        mock_client.chat.completions.create.return_value = mock_response

        req = func.HttpRequest(
            method='POST',
            body=json.dumps({'prompt': test_prompt}).encode('utf-8'),
            url='/api/chat',
            params={}
        )

        # Act
        response = function_app.chat_with_ai(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'success'
        assert response_data['response'] == expected_ai_response
        assert response_data['prompt'] == test_prompt
        assert response_data['deployment'] == expected_model
        assert response_data['usage']['total_tokens'] == 30
        mock_client.chat.completions.create.assert_called_once()

    def test_chat_missing_prompt(self):
        """Test chat endpoint with missing prompt"""
        # Arrange
        req = func.HttpRequest(
            method='POST',
            body=json.dumps({}).encode('utf-8'),
            url='/api/chat',
            params={}
        )
        expected_error_substring = 'prompt'

        # Act
        response = function_app.chat_with_ai(req)

        # Assert
        assert response.status_code == 400
        response_data = json.loads(response.get_body())
        assert 'error' in response_data
        assert expected_error_substring in response_data['error'].lower()

    def test_chat_prompt_in_query_params(self):
        """Test chat endpoint with prompt in query parameters"""
        # Arrange
        test_prompt = 'Query param prompt'
        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/chat',
            params={'prompt': test_prompt}
        )

        with patch('function_app.get_openai_client') as mock_get_client:
            mock_client = Mock()
            mock_credential = Mock()
            mock_get_client.return_value = (mock_client, mock_credential)

            mock_response = Mock()
            mock_response.choices = [Mock(message=Mock(content='Response'))]
            mock_response.model = 'model'
            mock_response.usage = Mock(
                prompt_tokens=1, completion_tokens=1, total_tokens=2)
            mock_client.chat.completions.create.return_value = mock_response

            with patch.dict(os.environ, {'MODEL_DEPLOYMENT_NAME': 'test-model'}):
                # Act
                response = function_app.chat_with_ai(req)

                # Assert
                assert response.status_code == 200
                response_data = json.loads(response.get_body())
                assert response_data['prompt'] == test_prompt

    @patch.dict(os.environ, {}, clear=True)
    @patch('function_app.get_openai_client')
    @patch('function_app.list_deployments_via_api')
    def test_chat_auto_discover_deployment(self, mock_list_deployments, mock_get_client):
        """Test chat with auto-discovery of deployment"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)

        discovered_model = 'auto-discovered-model'
        mock_list_deployments.return_value = [discovered_model]

        test_prompt = 'Hello'
        expected_ai_response = 'AI response'

        mock_response = Mock()
        mock_response.choices = [
            Mock(message=Mock(content=expected_ai_response))]
        mock_response.model = discovered_model
        mock_response.usage = Mock(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30
        )
        mock_client.chat.completions.create.return_value = mock_response

        req = func.HttpRequest(
            method='POST',
            body=json.dumps({'prompt': test_prompt}).encode('utf-8'),
            url='/api/chat',
            params={}
        )

        # Act
        response = function_app.chat_with_ai(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['deployment'] == discovered_model
        assert response_data['response'] == expected_ai_response
        mock_list_deployments.assert_called_once_with(mock_credential)

    @patch.dict(os.environ, {}, clear=True)
    @patch('function_app.get_openai_client')
    @patch('function_app.list_deployments_via_api')
    def test_chat_no_deployments_found(self, mock_list_deployments, mock_get_client):
        """Test chat when no deployments are found"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)
        mock_list_deployments.return_value = []

        test_prompt = 'Hello'
        req = func.HttpRequest(
            method='POST',
            body=json.dumps({'prompt': test_prompt}).encode('utf-8'),
            url='/api/chat',
            params={}
        )

        # Act
        response = function_app.chat_with_ai(req)

        # Assert
        assert response.status_code == 500
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'error'
        assert 'No model deployments found' in response_data['error']

    @patch.dict(os.environ, {'MODEL_DEPLOYMENT_NAME': 'gpt-35-turbo'})
    @patch('function_app.get_openai_client')
    def test_chat_openai_authentication_error(self, mock_get_client):
        """Test chat with OpenAI API authentication error"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)

        authentication_error_message = "Authentication error 401"
        mock_client.chat.completions.create.side_effect = Exception(
            authentication_error_message)

        test_prompt = 'Hello'
        req = func.HttpRequest(
            method='POST',
            body=json.dumps({'prompt': test_prompt}).encode('utf-8'),
            url='/api/chat',
            params={}
        )

        # Act
        response = function_app.chat_with_ai(req)

        # Assert
        assert response.status_code == 500
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'error'
        assert 'Authentication failed' in response_data['error']
        assert 'Cognitive Services OpenAI User' in response_data['error']

    @patch.dict(os.environ, {'MODEL_DEPLOYMENT_NAME': 'gpt-35-turbo'})
    @patch('function_app.get_openai_client')
    def test_chat_openai_general_error(self, mock_get_client):
        """Test chat with general OpenAI API error"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)

        error_message = "Rate limit exceeded"
        mock_client.chat.completions.create.side_effect = Exception(
            error_message)

        test_prompt = 'Hello'
        req = func.HttpRequest(
            method='POST',
            body=json.dumps({'prompt': test_prompt}).encode('utf-8'),
            url='/api/chat',
            params={}
        )

        # Act
        response = function_app.chat_with_ai(req)

        # Assert
        assert response.status_code == 500
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'error'
        assert error_message in response_data['error']


class TestHealthCheck:
    """Test cases for health_check function following AAA pattern"""

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_NAME': 'test-project',
        'AI_FOUNDRY_PROJECT_ID': 'test-id',
        'RESOURCE_GROUP': 'test-rg',
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'MODEL_DEPLOYMENT_NAME': 'gpt-35-turbo'
    })
    @patch('function_app.get_openai_client')
    @patch('function_app.list_deployments_via_api')
    def test_health_check_healthy(self, mock_list_deployments, mock_get_client):
        """Test health check with healthy status"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)

        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token

        test_deployments = ['deployment1', 'deployment2']
        mock_list_deployments.return_value = test_deployments

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/health',
            params={}
        )

        # Act
        response = function_app.health_check(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'healthy'
        assert response_data['function_app'] == 'running'
        assert response_data['azure_openai']['client_initialized'] == True
        assert response_data['azure_openai']['authentication'] == 'Success - Managed Identity working'
        assert response_data['azure_openai']['deployment_count'] == len(
            test_deployments)
        assert response_data['azure_openai']['available_deployments'] == test_deployments

    @patch.dict(os.environ, {}, clear=True)
    @patch('function_app.get_openai_client')
    def test_health_check_unhealthy(self, mock_get_client):
        """Test health check with unhealthy status"""
        # Arrange
        error_message = "Connection failed"
        mock_get_client.side_effect = Exception(error_message)

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/health',
            params={}
        )

        # Act
        response = function_app.health_check(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'unhealthy'
        assert response_data['azure_openai']['client_initialized'] == False
        assert error_message in response_data['azure_openai']['error']

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'MODEL_DEPLOYMENT_NAME': 'gpt-35-turbo'
    })
    @patch('function_app.get_openai_client')
    @patch('function_app.list_deployments_via_api')
    def test_health_check_no_deployments_warning(self, mock_list_deployments, mock_get_client):
        """Test health check with warning when no deployments found"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)

        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token

        mock_list_deployments.return_value = []  # No deployments

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/health',
            params={}
        )

        # Act
        response = function_app.health_check(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'warning'
        assert response_data['azure_openai']['deployment_count'] == 0
        assert 'No deployments found' in response_data['azure_openai']['warning']

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
    })
    @patch('function_app.get_openai_client')
    @patch('function_app.list_deployments_via_api')
    def test_health_check_authentication_failure(self, mock_list_deployments, mock_get_client):
        """Test health check with authentication failure"""
        # Arrange
        mock_client = Mock()
        mock_credential = Mock()
        mock_get_client.return_value = (mock_client, mock_credential)

        # Configure list_deployments to return an empty list
        mock_list_deployments.return_value = []

        auth_error_message = "Token acquisition failed"
        mock_credential.get_token.side_effect = Exception(auth_error_message)

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/health',
            params={}
        )

        # Act
        response = function_app.health_check(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'unhealthy'
        assert 'Failed' in response_data['azure_openai']['authentication']
        assert auth_error_message in response_data['azure_openai']['authentication']


class TestListDeployedModels:
    """Test cases for list_deployed_models function following AAA pattern"""

    @patch.dict(os.environ, {
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg',
        'AI_FOUNDRY_PROJECT_ID': '/subscriptions/sub-id/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/test-account/projects/test'
    })
    @patch('function_app.DefaultAzureCredential')
    @patch('function_app.requests.get')
    def test_list_models_success(self, mock_get, mock_credential):
        """Test successful model listing"""
        # Arrange
        mock_cred_instance = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_cred_instance.get_token.return_value = mock_token
        mock_credential.return_value = mock_cred_instance

        test_deployment_data = {
            'name': 'deployment1',
            'properties': {
                'model': {
                    'name': 'gpt-35-turbo',
                    'version': '0301',
                    'format': 'OpenAI'
                },
                'scaleSettings': {'capacity': 10},
                'provisioningState': 'Succeeded',
                'createdAt': '2024-01-01T00:00:00Z',
                'updatedAt': '2024-01-02T00:00:00Z'
            }
        }

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'value': [test_deployment_data]}
        mock_get.return_value = mock_response

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/list-models',
            params={}
        )

        # Act
        response = function_app.list_deployed_models(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'success'
        assert response_data['count'] == 1
        assert len(response_data['deployments']) == 1

        deployment = response_data['deployments'][0]
        assert deployment['deployment_name'] == 'deployment1'
        assert deployment['model_name'] == 'gpt-35-turbo'
        assert deployment['model_version'] == '0301'
        assert deployment['capacity'] == 10

        mock_cred_instance.get_token.assert_called_once_with(
            "https://management.azure.com/.default")
        mock_get.assert_called_once()

    @patch.dict(os.environ, {
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg',
        'AI_FOUNDRY_PROJECT_ID': 'invalid-format'
    })
    @patch('function_app.DefaultAzureCredential')
    @patch('function_app.requests.get')
    def test_list_models_with_fallback_account_name(self, mock_get, mock_credential):
        """Test model listing with fallback account name when project ID is invalid"""
        # Arrange
        mock_cred_instance = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_cred_instance.get_token.return_value = mock_token
        mock_credential.return_value = mock_cred_instance

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'value': []}
        mock_get.return_value = mock_response

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/list-models',
            params={}
        )

        # Act
        response = function_app.list_deployed_models(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'success'
        # Fallback account name
        assert response_data['account'] == 'cog-basic-k4qzw'
        mock_get.assert_called_once()

        # Verify the URL contains the fallback account name
        call_url = mock_get.call_args[0][0]
        assert 'cog-basic-k4qzw' in call_url

    @patch.dict(os.environ, {
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg',
        'AI_FOUNDRY_PROJECT_ID': '/subscriptions/sub-id/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/test-account/projects/test'
    })
    @patch('function_app.DefaultAzureCredential')
    @patch('function_app.requests.get')
    def test_list_models_api_forbidden_error(self, mock_get, mock_credential):
        """Test model listing with API forbidden error"""
        # Arrange
        mock_cred_instance = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_cred_instance.get_token.return_value = mock_token
        mock_credential.return_value = mock_cred_instance

        error_text = 'Forbidden: Insufficient permissions'
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.text = error_text
        mock_get.return_value = mock_response

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/list-models',
            params={}
        )

        # Act
        response = function_app.list_deployed_models(req)

        # Assert
        assert response.status_code == 403
        response_data = json.loads(response.get_body())
        assert 'error' in response_data
        assert 'Failed to list deployments: HTTP 403' in response_data['error']
        assert error_text in response_data['details']
        assert 'managed identity' in response_data['hint']

    @patch('function_app.DefaultAzureCredential')
    def test_list_models_exception_handling(self, mock_credential):
        """Test model listing with exception during execution"""
        # Arrange
        error_message = "Network timeout"
        mock_credential.side_effect = Exception(error_message)

        req = func.HttpRequest(
            method='GET',
            body=b'',  # Use empty bytes instead of None
            url='/api/list-models',
            params={}
        )

        # Act
        response = function_app.list_deployed_models(req)

        # Assert
        assert response.status_code == 500
        response_data = json.loads(response.get_body())
        assert 'error' in response_data
        assert error_message in response_data['error']
        assert 'Azure AI Studio' in response_data['hint']
