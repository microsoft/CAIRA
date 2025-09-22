import os
import json
import sys
import pytest
from unittest.mock import Mock, patch, MagicMock, call
import azure.functions as func
from azure.core.exceptions import AzureError
from azure.identity import DefaultAzureCredential
import requests
import function_app


class TestGetMLClient:
    """Test cases for get_ml_client function"""

    @patch.dict(os.environ, {
        'AZURE_SUBSCRIPTION_ID': 'test-sub-id',
        'RESOURCE_GROUP': 'test-rg',
        'AI_FOUNDRY_PROJECT_NAME': 'test-project'
    })
    @patch('function_app.DefaultAzureCredential')
    @patch('function_app.MLClient')
    def test_get_ml_client_success(self, mock_ml_client_class, mock_credential):
        """Test successful ML client initialization"""
        # Arrange
        mock_cred_instance = Mock()
        mock_credential.return_value = mock_cred_instance

        mock_client = Mock()
        mock_ml_client_class.return_value = mock_client

        # Act
        client, credential = function_app.get_ml_client()

        # Assert
        assert client == mock_client
        assert credential == mock_cred_instance
        mock_ml_client_class.assert_called_once_with(
            credential=mock_cred_instance,
            subscription_id='test-sub-id',
            resource_group_name='test-rg',
            workspace_name='test-project'
        )

    @patch.dict(os.environ, {}, clear=True)
    def test_get_ml_client_missing_config(self):
        """Test ML client initialization with missing configuration"""
        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            function_app.get_ml_client()

        assert "Missing Azure configuration" in str(exc_info.value)


class TestGetChatClient:
    """Test cases for get_chat_client function"""

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AZURE_SUBSCRIPTION_ID': 'test-sub-id',
        'RESOURCE_GROUP': 'test-rg'
    })
    @patch('function_app.get_ml_client')
    @patch('function_app.ChatCompletionsClient')
    def test_get_chat_client_success(self, mock_chat_client_class, mock_get_ml_client):
        """Test successful chat client initialization"""
        # Arrange
        mock_ml_client = Mock()
        mock_ml_client.workspace_name = 'test-project'
        mock_credential = Mock()
        mock_get_ml_client.return_value = (mock_ml_client, mock_credential)

        mock_chat_client = Mock()
        mock_chat_client_class.return_value = mock_chat_client

        # Act
        chat_client, credential, ml_client = function_app.get_chat_client()

        # Assert
        assert chat_client == mock_chat_client
        assert credential == mock_credential
        assert ml_client == mock_ml_client
        mock_chat_client_class.assert_called_once_with(
            endpoint='https://test.cognitiveservices.azure.com',
            credential=mock_credential,
            api_version='2024-02-01'
        )

    @patch.dict(os.environ, {}, clear=True)
    @patch('function_app.get_ml_client')
    def test_get_chat_client_missing_endpoint(self, mock_get_ml_client):
        """Test chat client initialization with missing endpoint"""
        # Arrange
        mock_ml_client = Mock()
        mock_credential = Mock()
        mock_get_ml_client.return_value = (mock_ml_client, mock_credential)

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            function_app.get_chat_client()

        assert "AI_FOUNDRY_ENDPOINT environment variable is not set" in str(
            exc_info.value)


class TestChatWithAIInference:
    """Test cases for chat_with_ai_inference function"""

    def test_chat_with_ai_inference_success(self):
        """Test successful chat completion using AI Inference SDK"""
        # Arrange
        mock_chat_client = Mock()
        mock_ml_client = Mock()
        mock_ml_client.workspace_name = 'test-project'

        prompt = "Test prompt"
        deployment_name = "gpt-4"

        # Mock response
        mock_choice = Mock()
        mock_choice.message.content = "AI response"

        mock_response = Mock()
        mock_response.choices = [mock_choice]
        mock_response.model = "gpt-4"
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30

        mock_chat_client.complete.return_value = mock_response

        # Act
        result = function_app.chat_with_ai_inference(
            mock_chat_client, mock_ml_client, prompt, deployment_name
        )

        # Assert
        assert result['response'] == "AI response"
        assert result['deployment'] == deployment_name
        assert result['project'] == 'test-project'
        assert result['usage']['total_tokens'] == 30
        assert result['status'] == 'success'

        # Verify the call
        mock_chat_client.complete.assert_called_once()
        call_args = mock_chat_client.complete.call_args
        assert call_args[1]['model'] == deployment_name
        assert call_args[1]['max_tokens'] == 800
        assert call_args[1]['temperature'] == 0.7


class TestListProjectModels:
    """Test cases for list_project_models function"""

    def test_list_project_models_success(self):
        """Test successful project model listing"""
        # Arrange
        mock_ml_client = Mock()

        mock_model1 = Mock()
        mock_model1.name = "model1"
        mock_model1.version = "1.0"
        mock_model1.description = "Test model 1"
        mock_model1.tags = {"type": "nlp"}
        mock_model1.creation_context.created_by = "user1"
        mock_model1.creation_context.created_at = "2024-01-01"

        mock_model2 = Mock(spec=['name', 'version', 'description', 'tags'])
        mock_model2.name = "model2"
        mock_model2.version = "2.0"
        mock_model2.description = None
        mock_model2.tags = {}
        # Explicitly no creation_context attribute

        mock_ml_client.models.list.return_value = [mock_model1, mock_model2]

        # Act
        result = function_app.list_project_models(mock_ml_client)

        # Assert
        assert len(result) == 2
        assert result[0]['name'] == "model1"
        assert result[0]['version'] == "1.0"
        assert result[0]['created_by'] == "user1"
        assert result[1]['name'] == "model2"
        assert result[1]['created_by'] is None

    def test_list_project_models_error(self):
        """Test project model listing with error"""
        # Arrange
        mock_ml_client = Mock()
        mock_ml_client.models.list.side_effect = Exception("ML error")

        # Act
        result = function_app.list_project_models(mock_ml_client)

        # Assert
        assert result == []


class TestListDeploymentsViaAPI:
    """Test cases for list_deployments_via_api function"""

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test-account.cognitiveservices.azure.com',
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

        # Act
        result = function_app.list_deployments_via_api(mock_credential)

        # Assert
        assert result == ['deployment1', 'deployment2']
        mock_credential.get_token.assert_called_once_with(
            "https://management.azure.com/.default")
        mock_get.assert_called_once()
        call_url = mock_get.call_args[0][0]
        assert 'test-account' in call_url

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.openai.azure.com',
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg'
    })
    @patch('function_app.requests.get')
    def test_list_deployments_openai_endpoint(self, mock_get):
        """Test deployment listing with OpenAI endpoint format"""
        # Arrange
        mock_credential = Mock()
        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'value': []}
        mock_get.return_value = mock_response

        # Act
        result = function_app.list_deployments_via_api(mock_credential)

        # Assert
        mock_get.assert_called_once()
        call_url = mock_get.call_args[0][0]
        assert 'test' in call_url  # Should extract 'test' from the endpoint


class TestChatWithAI:
    """Test cases for chat_with_ai endpoint using AI Inference SDK"""

    @patch.dict(os.environ, {'MODEL_DEPLOYMENT_NAME': 'gpt-4'})
    @patch('function_app.get_chat_client')
    @patch('function_app.chat_with_ai_inference')
    def test_chat_success(self, mock_chat_inference, mock_get_client):
        """Test successful chat completion"""
        # Arrange
        mock_chat_client = Mock()
        mock_credential = Mock()
        mock_ml_client = Mock()
        mock_ml_client.workspace_name = 'test-project'
        mock_get_client.return_value = (
            mock_chat_client, mock_credential, mock_ml_client)

        test_prompt = 'Hello AI'
        chat_response = {
            'response': 'AI Inference response',
            'deployment': 'gpt-4',
            'project': 'test-project',
            'model': 'gpt-4',
            'usage': {'prompt_tokens': 10, 'completion_tokens': 20, 'total_tokens': 30},
            'status': 'success'
        }
        mock_chat_inference.return_value = chat_response

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
        assert response_data['response'] == 'AI Inference response'
        assert response_data['prompt'] == test_prompt
        assert response_data['project'] == 'test-project'
        mock_chat_inference.assert_called_once_with(
            mock_chat_client, mock_ml_client, test_prompt, 'gpt-4'
        )

    def test_chat_missing_prompt(self):
        """Test chat endpoint with missing prompt"""
        # Arrange
        req = func.HttpRequest(
            method='POST',
            body=json.dumps({}).encode('utf-8'),
            url='/api/chat',
            params={}
        )

        # Act
        response = function_app.chat_with_ai(req)

        # Assert
        assert response.status_code == 400
        response_data = json.loads(response.get_body())
        assert 'error' in response_data
        assert 'prompt' in response_data['error'].lower()

    @patch.dict(os.environ, {}, clear=True)
    @patch('function_app.get_chat_client')
    @patch('function_app.list_deployments_via_api')
    @patch('function_app.chat_with_ai_inference')
    def test_chat_auto_discover_deployment(self, mock_chat_inference, mock_list_deployments, mock_get_client):
        """Test chat with auto-discovery of deployment"""
        # Arrange
        mock_chat_client = Mock()
        mock_credential = Mock()
        mock_ml_client = Mock()
        mock_ml_client.workspace_name = 'test-project'
        mock_get_client.return_value = (
            mock_chat_client, mock_credential, mock_ml_client)

        discovered_model = 'auto-discovered-model'
        mock_list_deployments.return_value = [discovered_model]

        test_prompt = 'Hello'
        chat_response = {
            'response': 'Response from discovered model',
            'deployment': discovered_model,
            'project': 'test-project',
            'model': discovered_model,
            'usage': {'prompt_tokens': 5, 'completion_tokens': 10, 'total_tokens': 15},
            'status': 'success'
        }
        mock_chat_inference.return_value = chat_response

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
        mock_list_deployments.assert_called_once_with(mock_credential)


class TestHealthCheck:
    """Test cases for health_check function with AI Inference SDK"""

    @patch.dict(os.environ, {
        'AI_FOUNDRY_ENDPOINT': 'https://test.cognitiveservices.azure.com',
        'AI_FOUNDRY_PROJECT_NAME': 'test-project',
        'RESOURCE_GROUP': 'test-rg',
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'MODEL_DEPLOYMENT_NAME': 'gpt-4'
    })
    @patch('function_app.get_chat_client')
    @patch('function_app.list_project_models')
    @patch('function_app.list_deployments_via_api')
    def test_health_check_healthy(self, mock_list_deployments, mock_list_models, mock_get_client):
        """Test health check with healthy status"""
        # Arrange
        mock_chat_client = Mock()
        mock_credential = Mock()
        mock_ml_client = Mock()
        mock_ml_client.workspace_name = 'test-project'
        mock_get_client.return_value = (
            mock_chat_client, mock_credential, mock_ml_client)

        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token

        test_models = [
            {'name': 'model1', 'version': '1.0'},
            {'name': 'model2', 'version': '2.0'}
        ]
        mock_list_models.return_value = test_models

        test_deployments = ['deployment1', 'deployment2']
        mock_list_deployments.return_value = test_deployments

        req = func.HttpRequest(
            method='GET',
            body=b'',
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
        assert response_data['ai_foundry']['client_initialized'] == True
        assert response_data['ai_foundry'][
            'client_type'] == 'ChatCompletionsClient (AI Inference SDK)'
        assert response_data['ai_foundry']['authentication'] == 'Success - Managed Identity working'
        assert response_data['ai_foundry']['project_model_count'] == len(
            test_models)
        assert response_data['ai_foundry']['deployment_count'] == len(
            test_deployments)
        assert response_data['sdk'] == 'Azure AI Inference (No OpenAI SDK)'

    @patch.dict(os.environ, {}, clear=True)
    @patch('function_app.get_chat_client')
    def test_health_check_unhealthy(self, mock_get_client):
        """Test health check with unhealthy status"""
        # Arrange
        error_message = "Connection failed"
        mock_get_client.side_effect = Exception(error_message)

        req = func.HttpRequest(
            method='GET',
            body=b'',
            url='/api/health',
            params={}
        )

        # Act
        response = function_app.health_check(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'unhealthy'
        assert response_data['ai_foundry']['client_initialized'] == False
        assert error_message in response_data['ai_foundry']['error']


class TestListDeployedModels:
    """Test cases for list_deployed_models function"""

    @patch.dict(os.environ, {
        'AZURE_SUBSCRIPTION_ID': 'sub-id',
        'RESOURCE_GROUP': 'test-rg',
        'AI_FOUNDRY_ENDPOINT': 'https://test-account.cognitiveservices.azure.com'
    })
    @patch('function_app.get_chat_client')
    @patch('function_app.list_deployments_via_api')
    @patch('function_app.list_project_models')
    @patch('function_app.requests.get')
    def test_list_models_success(self, mock_get, mock_list_models, mock_list_deployments, mock_get_client):
        """Test successful model listing"""
        # Arrange
        mock_chat_client = Mock()
        mock_credential = Mock()
        mock_ml_client = Mock()
        mock_ml_client.workspace_name = 'test-project'
        mock_get_client.return_value = (
            mock_chat_client, mock_credential, mock_ml_client)

        mock_token = Mock()
        mock_token.token = 'test-token'
        mock_credential.get_token.return_value = mock_token

        # Mock deployments
        mock_list_deployments.return_value = ['deployment1']

        # Mock project models
        test_models = [{'name': 'model1', 'version': '1.0'}]
        mock_list_models.return_value = test_models

        # Mock detailed deployment info
        test_deployment_data = {
            'name': 'deployment1',
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
        }

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'value': [test_deployment_data]}
        mock_get.return_value = mock_response

        req = func.HttpRequest(
            method='GET',
            body=b'',
            url='/api/list-models',
            params={}
        )

        # Act
        response = function_app.list_deployed_models(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'success'
        assert response_data['deployment_count'] == 1
        assert response_data['project_model_count'] == 1
        assert response_data['sdk'] == 'Azure AI Inference SDK'
        assert 'Using AI Foundry native SDK without OpenAI dependency' in response_data[
            'hint']


class TestHttpExample:
    """Test cases for HttpExample function"""

    def test_http_example_with_name(self):
        """Test HttpExample with name parameter"""
        # Arrange
        test_name = 'TestUser'
        req = func.HttpRequest(
            method='GET',
            body=b'',
            url='/api/HttpExample',
            params={'name': test_name}
        )

        # Act
        response = function_app.HttpExample(req)

        # Assert
        assert response.status_code == 200
        assert f"Hello, {test_name}".encode() in response.get_body()

    def test_http_example_without_name(self):
        """Test HttpExample without name parameter"""
        # Arrange
        req = func.HttpRequest(
            method='GET',
            body=b'',
            url='/api/HttpExample',
            params={}
        )

        # Act
        response = function_app.HttpExample(req)

        # Assert
        assert response.status_code == 200
        assert b"This HTTP triggered function executed successfully" in response.get_body()
