# Unit tests for Azure Functions with AI Foundry integration using Azure AI Projects SDK

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
import azure.functions as func
from datetime import datetime


class TestHealthCheck:
    """Test suite for health check endpoint"""

    def test_health_check_success(
            self, http_request_factory, azure_environment,
            mock_ai_project_client_class, mock_list_agents,
            mock_default_credential):
        """Test successful health check"""
        # Arrange
        from function_app import health_check
        req = http_request_factory(method='GET', url='/api/health')

        # Act
        response = health_check(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'healthy'
        assert response_data['function_app'] == 'running'
        assert 'configuration' in response_data
        assert 'ai_foundry' in response_data
        assert response_data['ai_foundry']['client_initialized'] == True

    def test_health_check_no_environment(self, http_request_factory):
        """Test health check with missing environment variables"""
        # Arrange
        from function_app import health_check
        req = http_request_factory(method='GET', url='/api/health')

        # Act
        response = health_check(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'unhealthy'
        assert response_data['ai_foundry']['client_initialized'] == False


class TestAgentOperations:
    """Test suite for unified agent operations endpoint"""

    def test_agent_no_action(self, http_request_factory, azure_environment):
        """Test agent endpoint without action parameter"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={}
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 400
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'error'
        assert 'Please provide an \'action\' parameter' in response_data['error']
        assert 'available_actions' in response_data

    def test_agent_invalid_action(self, http_request_factory, azure_environment):
        """Test agent endpoint with invalid action"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={'action': 'invalid'}
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 400
        response_data = json.loads(response.get_body())
        assert 'Unknown action' in response_data['error']
        assert 'available_actions' in response_data

    def test_agent_create_action(
            self, http_request_factory, azure_environment,
            mock_ai_project_client_class, mock_datetime):
        """Test agent creation through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={
                'action': 'create',
                'name': 'test-assistant',
                'instructions': 'You are a test assistant',
                'model': 'gpt-4',
                'enable_code_interpreter': True,
                'enable_file_search': False
            }
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 201
        response_data = json.loads(response.get_body())
        assert response_data['action'] == 'create'
        assert response_data['status'] == 'created'
        assert response_data['name'] == 'test-assistant'
        assert response_data['model'] == 'gpt-4'

    def test_agent_chat_action(
            self, http_request_factory, azure_environment,
            mock_get_or_create_agent, mock_run_agent_conversation,
            mock_datetime):
        """Test chat through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={
                'action': 'chat',
                'message': 'Hello, how are you?'
            }
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['action'] == 'chat'
        assert response_data['user_message'] == 'Hello, how are you?'
        assert response_data['response'] == 'Test response from agent'

    def test_agent_chat_with_thread_id(
            self, http_request_factory, azure_environment,
            mock_get_or_create_agent, mock_run_agent_conversation,
            mock_datetime):
        """Test chat with existing thread ID through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={
                'action': 'chat',
                'message': 'Continue our conversation',
                'thread_id': 'thread_existing123'
            }
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['action'] == 'chat'
        mock_run_agent_conversation.assert_called_once()
        call_args = mock_run_agent_conversation.call_args
        assert call_args[0][1] == 'Continue our conversation'
        assert call_args[0][2] == 'thread_existing123'

    def test_agent_chat_no_message(self, http_request_factory, azure_environment):
        """Test chat without message through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={'action': 'chat'}
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 400
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'error'
        assert 'Please provide a \'message\'' in response_data['error']

    def test_agent_list_action(
            self, http_request_factory, azure_environment,
            mock_list_agents):
        """Test listing agents through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={'action': 'list'}
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['action'] == 'list'
        assert response_data['status'] == 'success'
        assert response_data['count'] == 1
        assert len(response_data['agents']) == 1

    def test_agent_delete_action(
            self, http_request_factory, azure_environment,
            mock_ai_project_client_class, mock_datetime):
        """Test agent deletion through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={
                'action': 'delete',
                'agent_id': 'asst_test123'
            }
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['action'] == 'delete'
        assert response_data['status'] == 'deleted'
        assert response_data['agent_id'] == 'asst_test123'

    def test_agent_delete_no_id(self, http_request_factory, azure_environment):
        """Test agent deletion without ID through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={'action': 'delete'}
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 400
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'error'
        assert 'Please provide \'agent_id\'' in response_data['error']

    def test_agent_code_interpreter_action(
            self, http_request_factory, azure_environment,
            mock_ai_project_client_class, mock_datetime):
        """Test code interpreter through unified endpoint"""
        # Arrange
        from function_app import agent_operations
        mock_client = mock_ai_project_client_class.return_value

        # Setup the mock run to return completed status immediately
        mock_run = Mock()
        mock_run.status = 'completed'
        mock_client.agents.runs.create.return_value = mock_run
        mock_client.agents.runs.get.return_value = mock_run

        req = http_request_factory(
            method='POST',
            url='/api/agent',
            body={
                'action': 'code-interpreter',
                'code_task': 'Calculate fibonacci sequence'
            }
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['action'] == 'code-interpreter'
        assert response_data['status'] == 'completed'
        assert response_data['task'] == 'Calculate fibonacci sequence'

    def test_agent_query_params_fallback(
            self, http_request_factory, azure_environment,
            mock_list_agents):
        """Test agent endpoint with query parameters as fallback"""
        # Arrange
        from function_app import agent_operations
        req = http_request_factory(
            method='GET',
            url='/api/agent',
            params={'action': 'list'},
            body=b''  # Empty body to trigger ValueError
        )

        # Act
        response = agent_operations(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['action'] == 'list'
        assert response_data['status'] == 'success'


class TestDemo:
    """Test suite for demo endpoint"""

    def test_demo_success(
            self, http_request_factory, azure_environment,
            mock_ai_project_client_class, mock_datetime):
        """Test successful demo execution"""
        # Arrange
        from function_app import demo_agent_capabilities
        mock_client = mock_ai_project_client_class.return_value

        # Setup mock run
        mock_run = Mock()
        mock_run.status = 'completed'
        mock_client.agents.runs.create.return_value = mock_run
        mock_client.agents.runs.get.return_value = mock_run

        req = http_request_factory(method='GET', url='/api/demo')

        # Act
        response = demo_agent_capabilities(req)

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'success'
        assert response_data['demo'] == 'Complete Agent Integration Showcase'
        assert len(response_data['steps']) > 0
        assert 'agent_created' in response_data
        assert 'thread_id' in response_data
        assert 'conversation' in response_data
        assert 'summary' in response_data

    def test_demo_handles_error(
            self, http_request_factory, azure_environment,
            mock_ai_project_client_class):
        """Test demo error handling"""
        # Arrange
        from function_app import demo_agent_capabilities
        mock_ai_project_client_class.side_effect = Exception("API Error")
        req = http_request_factory(method='GET', url='/api/demo')

        # Act
        response = demo_agent_capabilities(req)

        # Assert
        assert response.status_code == 500
        response_data = json.loads(response.get_body())
        assert response_data['status'] == 'error'
        assert 'API Error' in response_data['error']


class TestProjectClientInitialization:
    """Test suite for AIProjectClient initialization"""

    def test_get_project_client_success(self, azure_environment, mock_default_credential):
        """Test successful project client initialization"""
        # Arrange
        from function_app import get_project_client
        import function_app
        function_app._project_client = None

        # Act
        with patch('function_app.AIProjectClient') as mock_client_class:
            client = get_project_client()

        # Assert
        mock_client_class.assert_called_once()
        call_args = mock_client_class.call_args
        assert 'endpoint' in call_args[1]
        assert 'credential' in call_args[1]
        assert 'services.ai.azure.com' in call_args[1]['endpoint']

    def test_get_project_client_cached(self, azure_environment):
        """Test that project client is cached after first initialization"""
        # Arrange
        from function_app import get_project_client
        import function_app
        mock_client = Mock()
        function_app._project_client = mock_client

        # Act
        client = get_project_client()

        # Assert
        assert client == mock_client

    def test_get_project_client_no_endpoint(self):
        """Test project client initialization without endpoint"""
        # Arrange
        from function_app import get_project_client
        import function_app
        function_app._project_client = None

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            get_project_client()
        assert "AI_FOUNDRY_ENDPOINT environment variable is not set" in str(
            exc_info.value)


class TestAgentHelperFunctions:
    """Test suite for agent helper functions"""

    def test_get_or_create_agent_existing(self, azure_environment, mock_project_client):
        """Test getting existing agent"""
        # Arrange
        from function_app import get_or_create_agent
        import function_app
        function_app._agent_instance = None

        mock_agent = Mock()
        mock_agent.name = 'azure-function-assistant'
        mock_agent.id = 'asst_existing'

        mock_project_client.agents.list_agents.return_value = [mock_agent]

        # Act
        with patch('function_app.get_project_client', return_value=mock_project_client):
            agent = get_or_create_agent()

        # Assert
        assert agent == mock_agent
        mock_project_client.agents.create_agent.assert_not_called()

    def test_get_or_create_agent_new(self, azure_environment, mock_project_client):
        """Test creating new agent when none exists"""
        # Arrange
        from function_app import get_or_create_agent
        import function_app
        function_app._agent_instance = None

        mock_project_client.agents.list_agents.return_value = []

        mock_new_agent = Mock()
        mock_new_agent.id = 'asst_new'
        mock_new_agent.name = 'azure-function-assistant'
        mock_project_client.agents.create_agent.side_effect = None
        mock_project_client.agents.create_agent.return_value = mock_new_agent

        # Act
        with patch('function_app.get_project_client', return_value=mock_project_client):
            agent = get_or_create_agent()

        # Assert
        assert agent == mock_new_agent
        assert agent.id == 'asst_new'
        mock_project_client.agents.create_agent.assert_called_once()

    def test_run_agent_conversation_new_thread(
            self, azure_environment, mock_project_client,
            mock_agent, mock_thread, mock_run, mock_message):
        """Test running agent conversation with new thread"""
        # Arrange
        from function_app import run_agent_conversation

        mock_project_client.agents.threads.create.return_value = mock_thread
        mock_project_client.agents.messages.create.return_value = mock_message
        mock_project_client.agents.messages.list.return_value = [mock_message]
        mock_project_client.agents.runs.create.return_value = mock_run
        mock_project_client.agents.runs.get.return_value = mock_run

        # Act
        with patch('function_app.get_project_client', return_value=mock_project_client):
            result = run_agent_conversation(mock_agent, "Test message")

        # Assert
        assert result['thread_id'] == 'thread_test123'
        assert result['response'] == 'Test response from assistant'
        assert result['status'] == 'completed'
        mock_project_client.agents.threads.create.assert_called_once()

    def test_run_agent_conversation_existing_thread(
            self, azure_environment, mock_project_client,
            mock_agent, mock_thread, mock_run, mock_message):
        """Test running agent conversation with existing thread"""
        # Arrange
        from function_app import run_agent_conversation

        mock_project_client.agents.threads.get.return_value = mock_thread
        mock_project_client.agents.messages.create.return_value = mock_message
        mock_project_client.agents.messages.list.return_value = [mock_message]
        mock_project_client.agents.runs.create.return_value = mock_run
        mock_project_client.agents.runs.get.return_value = mock_run

        # Act
        with patch('function_app.get_project_client', return_value=mock_project_client):
            result = run_agent_conversation(
                mock_agent, "Test message", "thread_existing")

        # Assert
        assert result['thread_id'] == 'thread_test123'
        mock_project_client.agents.threads.get.assert_called_once_with(
            'thread_existing')
        mock_project_client.agents.threads.create.assert_not_called()
