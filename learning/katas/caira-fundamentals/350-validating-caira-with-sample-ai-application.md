---
# Core Metadata
title: "Kata: Validating CAIRA with Sample AI Application"
description: Learn to validate deployed CAIRA infrastructure by deploying and testing a sample Python AI application with end-to-end inference and authentication verification.
author: HVE Essentials Team
ms.date: 12/10/2024

# Kata Identity
kata_id: caira-fundamentals-350-validating-with-sample-app
kata_category:
  - caira-fundamentals
kata_difficulty: 3
estimated_time_minutes: 45
requires_dev_container: true

# Learning Content
learning_objectives:
  - Build systematic deployment validation methodology for CAIRA infrastructure
  - Deploy and configure sample AI applications on CAIRA infrastructure
  - Test infrastructure components through real application workloads
  - Verify end-to-end AI inference workflows with authentication
  - Document validation procedures for team knowledge sharing
technologies:
  - Azure AI Foundry
  - Python
  - Azure CLI
  - Azure AI Foundry SDK
  - REST APIs
  - CAIRA
  - Managed Identity
prerequisite_katas:
  - caira-fundamentals-200-devcontainer-foundry-basic-deployment
success_criteria:
  - Created comprehensive validation checklist with 15+ infrastructure checks
  - Sample AI application deployed and successfully connected to CAIRA resources
  - Successful AI inference calls completed through application
  - RBAC and managed identity authentication verified from application context
  - End-to-end workflow documented with validation evidence

# AI Coaching
ai_coaching_level: guided
scaffolding_level: medium-heavy
hint_frequency: strategic
common_pitfalls:
  - Attempting to connect application before verifying resource deployment status
  - Using incorrect endpoint URLs or resource names from Azure Portal
  - Missing required Python SDK packages or environment configuration
  - Not configuring authentication properly (API keys vs managed identity)
  - Skipping systematic validation steps and jumping to application testing

# Requirements
requires_azure_subscription: true
requires_local_environment: true
requires_github_account: false

# SEO & Discoverability
tags:
  - caira-validation
  - ai-application
  - end-to-end-testing
  - model-deployment
  - infrastructure-validation
search_keywords:
  - CAIRA validation
  - AI Foundry testing
  - sample application deployment
  - end-to-end inference testing
  - infrastructure validation
  - deployment verification
  - AI application testing
  - managed identity authentication
  - Azure AI SDK
  - Python AI application
---

## Quick Context

**You'll Learn**: How to systematically validate deployed CAIRA infrastructure by deploying a sample Python AI application, testing end-to-end inference workflows, and verifying authentication mechanisms work correctly.

**Real Challenge**: You're a platform engineer at a financial services company that just deployed CAIRA foundry_basic for an AI-powered customer insights project. Before handing off to the application development team, you need to prove the infrastructure works end-to-end with a real application. Deploy a sample chatbot to test model connectivity, authentication, and performance under realistic conditions.

**Your Task**: Create a validation checklist, deploy a sample Python AI application, configure it to connect to your CAIRA deployment, execute successful inference calls, and document the entire validation process for your team.

## Essential Setup

**Required** (check these first):

- [ ] **CRITICAL**: Completed Kata 200 with a deployed foundry_basic architecture
- [ ] Python 3.9+ installed (check with `python3 --version`)
- [ ] Azure CLI authenticated (verify with `az account show`)
- [ ] Access to Azure Portal (https://portal.azure.com)

**Find Your CAIRA Resource Group**:

If you completed Kata 200, you should have a resource group with a name like `rg-basic-xxxxx`. Find it:

```bash
az group list --query "[?contains(name, 'basic')].{Name:name, Location:location}" --output table
```

**Quick Validation**: Once you have your resource group name, verify it exists:

```bash
az group show --name <your-rg-name>
```

**Don't have a deployment?** You must complete Kata 200 first to deploy foundry_basic infrastructure before starting this validation kata.

> **🤖 Want Interactive AI Coaching?**
>
> Load the **Learning Kata Coach** chat mode for task check-offs, progress tracking, progressive hints, and personalized guidance.
>
> In GitHub Copilot Chat, select **Learning Kata Coach** mode and say:
> ```text
> I'm working on Kata 350: Validating CAIRA with Sample AI Application and want interactive coaching with progress tracking.
> ```

## Practice Tasks

### Task 1: Build Infrastructure Validation Checklist (10 minutes)

<!-- AI_COACH: Guide learners to think systematically about what "working infrastructure" means. Rather than providing the checklist directly, prompt them to consider: What resources should exist? What endpoints need to be accessible? What authentication mechanisms should be configured? Encourage them to reference their Kata 200 deployment outputs. -->

**What You'll Do**: Create a systematic checklist to verify your CAIRA deployment is ready for application workloads.

**Steps**:

1. **List** expected Azure resources from foundry_basic deployment
   - [ ] Find your resource group name from Kata 200 (format: `rg-basic-xxxxx`)
   - [ ] Run: `az resource list --resource-group <your-rg-name> --output table`
   - [ ] Document each resource type and name you see in the output
   - **Pro tip**: You should see resources like AI Foundry (Cognitive Services), Storage Account, Log Analytics, Application Insights
   - [ ] **Expected result**: List of 5-10 resources from your foundry_basic deployment

   **Example command**:
   ```bash
   # Replace rg-basic-xxxxx with your actual resource group name
   az resource list --resource-group rg-basic-xxxxx --output table
   ```

2. **Identify** critical configuration values needed for application connection
   - [ ] Get your subscription ID: `az account show --query id -o tsv`
   - [ ] Find AI Foundry (Cognitive Services) account:
     ```bash
     az cognitiveservices account list --resource-group <your-rg-name> --output table
     ```
   - [ ] Get the **base Cognitive Services endpoint** URL (this is what your application needs):
     ```bash
     az cognitiveservices account show --name <ai-foundry-account-name> \
       --resource-group <your-rg-name> --query properties.endpoint -o tsv
     ```
     **Important**: Use the base endpoint URL (e.g., `https://cog-xxxxx.cognitiveservices.azure.com/`) - do NOT add `/openai` or other paths
   - [ ] From Kata 200, you deployed three models: **gpt-4.1**, **text-embedding-3-large**, and **o4-mini**
   - [ ] Find the **exact model deployment name** (critical - portal display names can be misleading):
     - Navigate to Azure AI Portal (https://ai.azure.com)
     - Select your AI Foundry project (should match your resource group name pattern)
     - Go to **Models + endpoints** in the left navigation
     - Click on your gpt-4 deployment to view details
     - **CRITICAL**: Look for a "Test in playground" or "Code" section that shows the REST API endpoint
     - The deployment name is in the URL path: `.../deployments/{DEPLOYMENT-NAME}/...`
     - **Common confusion**: Portal may show "gpt-4.1" as the model name, but the actual deployment name might be `gpt-4.1` or something different
     - Copy the exact deployment name from the REST API URL path
     - Verify the deployment status shows as healthy/ready
   - **Validation checkpoint**: Can you explain why the base endpoint URL (without `/openai` path) is used with the Python SDK?
   - [ ] **Expected result**: You have: subscription ID, resource group name, base Cognitive Services endpoint URL, and the exact deployment name (not display name) documented

3. **Create** validation checklist with 15+ verification points
   - [ ] Include resource existence checks (AI Foundry account, project, storage)
   - [ ] Add connectivity checks (can reach endpoints, models deployed and available)
   - [ ] Include authentication checks (RBAC roles assigned, managed identity configured)
   - [ ] Add performance checks (model responds within acceptable latency, no quota errors)
   - **Pro tip**: Organize by category: Resources, Connectivity, Authentication, Performance, Documentation
   - [ ] **Expected result**: Structured checklist ready to execute systematically

### Task 2: Deploy Sample Python AI Application (15 minutes)

<!-- AI_COACH: Application deployment often reveals infrastructure issues. If learners struggle with connection errors, guide them to verify their checklist items first. Encourage systematic debugging: check resource names, verify endpoints, confirm authentication is configured. Rather than solving connection issues directly, prompt them to trace the error back to which checklist item might be incomplete. -->

**What You'll Do**: Deploy a simple Python CLI application that connects to your CAIRA AI Foundry project and performs inference.

**Steps**:

1. **Create** sample application structure
   - [ ] Create a new directory: `mkdir ~/caira-validation-app && cd ~/caira-validation-app`
   - [ ] Initialize Python virtual environment: `python3 -m venv venv && source venv/bin/activate`
   - [ ] Install required packages: `pip install openai azure-identity python-dotenv`
   - **Note**: We use the `openai` SDK (not `azure-ai-inference`) as it provides better compatibility with Azure AI Foundry deployments
   - [ ] **Expected result**: Virtual environment active with Azure OpenAI SDK installed

2. **Configure** application with CAIRA connection details
   - [ ] Create `.env` file with your configuration values:
     ```bash
     AZURE_AI_PROJECT_ENDPOINT=<your-endpoint-from-task-1>
     AZURE_AI_MODEL_NAME=<your-model-name>
     AZURE_SUBSCRIPTION_ID=<your-subscription-id>
     AZURE_RESOURCE_GROUP=<your-resource-group-name>
     ```
   - [ ] Verify each value matches your Azure Portal information exactly
   - **Pro tip**: Use `az cognitiveservices account show` to confirm AI Foundry account details if needed
   - [ ] **Expected result**: `.env` file populated with correct CAIRA infrastructure values

3. **Create** comprehensive validation test script
   - [ ] Create `comprehensive_test.py` with the following multi-scenario test suite:
     ```python
     import os
     import time
     from openai import AzureOpenAI
     from azure.identity import DefaultAzureCredential, get_bearer_token_provider
     from dotenv import load_dotenv

     # Load configuration
     load_dotenv()

     endpoint = os.getenv("AZURE_AI_PROJECT_ENDPOINT")
     model = os.getenv("AZURE_AI_MODEL_NAME")

     # Authentication with Azure CLI credentials
     token_provider = get_bearer_token_provider(
         DefaultAzureCredential(),
         "https://cognitiveservices.azure.com/.default"
     )

     # Create Azure OpenAI client with timeout
     client = AzureOpenAI(
         azure_endpoint=endpoint,
         azure_ad_token_provider=token_provider,
         api_version="2024-10-21",
         timeout=30.0  # 30 second timeout
     )

     print("=" * 60)
     print("CAIRA Validation Test Suite")
     print("=" * 60)
     print(f"\n✓ Authenticated with Azure CLI credentials")
     print(f"✓ Endpoint: {endpoint}")
     print(f"✓ Model: {model}")

     # Test scenarios: (name, prompt, max_tokens)
     test_cases = [
         ("Simple Math", "What is 2+2?", 50),
         ("Technical Question", "What is Infrastructure as Code?", 100),
         ("Comparison", "Name 2 differences between Terraform and ARM.", 100),
     ]

     results = []
     print(f"\n{'=' * 60}")
     print("Running Validation Tests")
     print("=" * 60)

     # Run inference tests
     for name, prompt, max_tokens in test_cases:
         print(f"\n[Test: {name}]")
         print(f"Prompt: {prompt}")

         try:
             start_time = time.time()
             response = client.chat.completions.create(
                 model=model,
                 messages=[
                     {"role": "system", "content": "You are a helpful assistant."},
                     {"role": "user", "content": prompt}
                 ],
                 max_tokens=max_tokens,
                 temperature=0.7
             )
             elapsed = time.time() - start_time

             content = response.choices[0].message.content
             tokens = response.usage.total_tokens if response.usage else 0

             print(f"✓ Success (Response time: {elapsed:.2f}s)")
             print(f"Response: {content[:100]}..." if len(content) > 100 else f"Response: {content}")

             results.append((name, "PASS", elapsed, tokens))

         except Exception as e:
             elapsed = time.time() - start_time
             print(f"✗ Failed after {elapsed:.2f}s: {e}")
             results.append((name, "FAIL", elapsed, 0))

     # Test error handling
     print(f"\n[Test: Error Handling]")
     print("Testing with invalid model name...")
     try:
         client.chat.completions.create(
             model="invalid-model-name",
             messages=[{"role": "user", "content": "test"}],
             max_tokens=10
         )
         print("✗ Should have raised an error!")
         results.append(("Error Handling", "FAIL", 0, 0))
     except Exception as e:
         print(f"✓ Correctly caught error: {type(e).__name__}")
         results.append(("Error Handling", "PASS", 0, 0))

     # Print summary
     print(f"\n{'=' * 60}")
     print("Test Summary")
     print("=" * 60)
     for name, status, elapsed, tokens in results:
         time_str = f"Time: {elapsed:.2f}s" if elapsed > 0 else "Time: N/A"
         token_str = f"Tokens: {tokens}" if tokens > 0 else "Tokens: N/A"
         symbol = "✓" if status == "PASS" else "✗"
         print(f"{symbol} {name}: {status} ({time_str}, {token_str})")

     passed = sum(1 for _, status, _, _ in results if status == "PASS")
     print(f"\nTotal: {passed}/{len(results)} tests passed")
     print("=" * 60)

     exit(0 if passed == len(results) else 1)
     ```
   - [ ] Save the file and review the test structure (4 scenarios: 3 inference + 1 error handling)
   - **Validation checkpoint**: Can you identify what each test validates? (connectivity, reasoning, error handling)
   - [ ] **Expected result**: Comprehensive test script ready to validate multiple deployment scenarios

4. **Execute** validation test suite
   - [ ] Run the comprehensive tests: `python comprehensive_test.py`
   - [ ] **⚠️ IMPORTANT**: Complex queries may take 30-60 seconds to complete - this is normal for longer responses
   - [ ] Observe test progress:
     - Simple Math test should complete quickly (1-2 seconds)
     - Technical questions may take 30-60 seconds for detailed responses
     - Error handling test validates proper exception handling
   - [ ] Review test summary showing pass/fail status and performance metrics
   - **Success check**: All 4 tests pass (3 inference scenarios + 1 error handling)
   - **Troubleshooting**: If tests hang beyond 60 seconds, check network connectivity and model availability
   - [ ] **Expected result**: Complete validation suite passing with performance baselines established (fast: <5s, complex: 30-60s)

### Task 3: Run Comprehensive Tests and Document Results (20 minutes)

<!-- AI_COACH: Focus on comprehensive validation testing and professional documentation. Since learners deployed the infrastructure in Kata 200, they already have sufficient permissions. The value here is in systematic testing, performance measurement, and creating reusable validation artifacts for their team. Guide them to think about: What test scenarios prove the infrastructure is production-ready? How would application teams use this validation? What documentation helps others reproduce and understand this validation? -->

**What You'll Do**: Execute comprehensive validation tests across multiple scenarios, measure performance, and create professional documentation for team handoff.

**Steps**:

1. **Create** comprehensive validation test suite
   - [ ] Create `comprehensive_test.py` that tests multiple scenarios:
     ```python
     import os
     import time
     from openai import AzureOpenAI
     from azure.identity import DefaultAzureCredential, get_bearer_token_provider
     from dotenv import load_dotenv

     load_dotenv()

     endpoint = os.getenv("AZURE_AI_PROJECT_ENDPOINT")
     model = os.getenv("AZURE_AI_MODEL_NAME")

     print("=" * 60)
     print("CAIRA Validation Test Suite")
     print("=" * 60)

     # Authentication
     token_provider = get_bearer_token_provider(
         DefaultAzureCredential(),
         "https://cognitiveservices.azure.com/.default"
     )

     client = AzureOpenAI(
         azure_endpoint=endpoint,
         azure_ad_token_provider=token_provider,
         api_version="2024-10-21"
     )

     print(f"\n✓ Authenticated with Azure CLI credentials")
     print(f"✓ Endpoint: {endpoint}")
     print(f"✓ Model: {model}")

     # Test scenarios
     test_cases = [
         ("Simple Math", "What is 2+2?", 20),
         ("Technical Explanation", "Explain Infrastructure as Code in 2 sentences.", 100),
         ("Complex Reasoning", "Compare Terraform and ARM templates. List 3 key differences.", 150),
     ]

     print("\n" + "=" * 60)
     print("Running Validation Tests")
     print("=" * 60)

     results = []

     for test_name, prompt, max_tokens in test_cases:
         print(f"\n[Test: {test_name}]")
         print(f"Prompt: {prompt}")

         try:
             start_time = time.time()
             response = client.chat.completions.create(
                 model=model,
                 messages=[
                     {"role": "system", "content": "You are a helpful assistant. Be concise."},
                     {"role": "user", "content": prompt}
                 ],
                 max_tokens=max_tokens
             )
             elapsed = time.time() - start_time

             answer = response.choices[0].message.content
             print(f"✓ Success (Response time: {elapsed:.2f}s)")
             print(f"Response: {answer[:100]}..." if len(answer) > 100 else f"Response: {answer}")

             results.append({
                 "test": test_name,
                 "status": "PASS",
                 "time": f"{elapsed:.2f}s",
                 "tokens": response.usage.total_tokens
             })

         except Exception as e:
             print(f"✗ Failed: {e}")
             results.append({
                 "test": test_name,
                 "status": "FAIL",
                 "time": "N/A",
                 "tokens": "N/A"
             })

     # Error handling test
     print(f"\n[Test: Error Handling]")
     print("Testing with invalid model name...")
     try:
         client_test = AzureOpenAI(
             azure_endpoint=endpoint,
             azure_ad_token_provider=token_provider,
             api_version="2024-10-21"
         )
         response = client_test.chat.completions.create(
             model="invalid-model-name",
             messages=[{"role": "user", "content": "test"}],
             max_tokens=10
         )
         print("✗ Should have failed with invalid model")
         results.append({"test": "Error Handling", "status": "FAIL", "time": "N/A", "tokens": "N/A"})
     except Exception as e:
         print(f"✓ Correctly caught error: {type(e).__name__}")
         results.append({"test": "Error Handling", "status": "PASS", "time": "N/A", "tokens": "N/A"})

     # Summary
     print("\n" + "=" * 60)
     print("Test Summary")
     print("=" * 60)
     for r in results:
         status_icon = "✓" if r["status"] == "PASS" else "✗"
         print(f"{status_icon} {r['test']}: {r['status']} (Time: {r['time']}, Tokens: {r['tokens']})")

     passed = sum(1 for r in results if r["status"] == "PASS")
     total = len(results)
     print(f"\nTotal: {passed}/{total} tests passed")
     print("=" * 60)

     exit(0 if passed == total else 1)
     ```
   - [ ] **Expected result**: Automated test suite ready to execute

2. **Execute** comprehensive validation tests
   - [ ] Run the comprehensive test suite: `python comprehensive_test.py`
   - [ ] Observe test execution:
     - Simple math test completes successfully
     - Technical explanation test completes successfully
     - Complex reasoning test completes successfully
     - Error handling test correctly catches invalid model name
   - [ ] Review performance metrics (response times should be < 5 seconds per test)
   - [ ] Verify test summary shows all tests passing
   - **Pro tip**: Save the test output to a log file: `python comprehensive_test.py | tee test_results.log`
   - [ ] **Expected result**: All 4 tests passing with documented response times and token usage

3. **Create** professional validation report
   - [ ] Create `VALIDATION_REPORT.md` with comprehensive documentation:
     - **Infrastructure Summary**: List all deployed resources from Task 1
     - **Configuration Values**: Document subscription, resource group, endpoint, model name
     - **Authentication Model**: Explain DefaultAzureCredential pattern (dev vs prod)
     - **Test Results**: Include all test outcomes with performance metrics
     - **Troubleshooting Guide**: Document issues encountered and resolutions (e.g., endpoint format, deployment name discovery)
     - **Production Readiness**: Note that infrastructure is validated for application team handoff
     - **Next Steps**: Guide for application teams (required roles, SDK usage, configuration)
   - [ ] Include example code snippets for connecting from applications
   - [ ] Add references to this kata and related documentation
   - **Success check**: A teammate could use this report to deploy their own AI application without additional help
   - [ ] **Expected result**: Professional validation report ready for team knowledge base

4. **Save** validation artifacts for reuse
   - [ ] Commit `comprehensive_test.py` as reusable validation script
   - [ ] Commit `VALIDATION_REPORT.md` as validation evidence
   - [ ] Save `.env` file template (without secrets) for future reference
   - **Pro tip**: This validation suite becomes your "smoke test" for future CAIRA deployments
   - [ ] **Expected result**: Reusable validation toolkit for other deployments

## Completion Check

**You've Succeeded When**:

- [ ] Created and executed comprehensive validation checklist with 15+ infrastructure verification points
- [ ] Sample Python application deployed and successfully connected to CAIRA AI Foundry resources
- [ ] Completed multiple successful inference calls demonstrating end-to-end functionality
- [ ] Verified authentication works using managed identity (DefaultAzureCredential with Azure CLI)
- [ ] Documented complete validation process with test results and troubleshooting guidance
- [ ] Created reusable validation script for future CAIRA deployments
- [ ] Can confidently hand off infrastructure to application development team with validation evidence

**Next Steps**:
- Explore Kata 400 (Customizing CAIRA for Your Requirements) to learn advanced configuration
- Consider Kata 450 (Securing CAIRA for Production) for production-ready security hardening
- Review Kata 300 (Troubleshooting CAIRA Deployments) if you encountered issues during validation

---

## Reference Appendix

### Help Resources

- **Azure AI Foundry SDK**: Use for understanding authentication and client configuration - [Azure AI Inference Python SDK](https://learn.microsoft.com/python/api/overview/azure/ai-inference-readme)
- **DefaultAzureCredential**: Reference for authentication chain behavior - [Azure Identity Docs](https://learn.microsoft.com/python/api/azure-identity/azure.identity.defaultazurecredential)
- **Kata 200 Reference**: Review deployment outputs and resource names from your previous deployment

### Professional Tips

- Always validate infrastructure systematically before application deployment - saves debugging time
- Use DefaultAzureCredential in development to avoid hardcoding credentials - matches production patterns
- Document not just what works but also what failed and how you fixed it - valuable for team knowledge
- Performance baseline from validation becomes your reference for detecting infrastructure degradation
- Reusable validation scripts should be part of every infrastructure deployment workflow

### Troubleshooting

**Issue**: Connection errors to AI Foundry endpoint

- **Quick Fix**: Verify endpoint URL exactly matches Azure Portal (including https:// and trailing paths). Confirm AI Foundry project is in "Succeeded" provisioning state. Check network connectivity with `curl <endpoint>`.

**Issue**: Authentication fails with "Unauthorized" or "Forbidden"

- **Quick Fix**: Verify your Azure CLI identity has Cognitive Services User role minimum on the AI Foundry resource. Run `az account show` to confirm correct subscription is active. Try `az logout && az login` to refresh credentials.

**Issue**: Model not found error (404 DeploymentNotFound)

- **Quick Fix**: The error "DeploymentNotFound" means the model deployment name doesn't match. Go to Azure AI Portal (ai.azure.com) → your project → Models + endpoints → click your deployment → find the REST API endpoint URL. The deployment name is in the URL path: `.../deployments/{EXACT-NAME}/...`. Copy this exact name to your `.env` file. **Common mistake**: Using the portal display name (e.g., "gpt-4.1") when the actual deployment name might be different. The deployment name in the REST API URL is the source of truth.

**Issue**: Wrong endpoint format causing connection errors

- **Quick Fix**: Use the **base Cognitive Services endpoint** without any path suffixes. Correct: `https://cog-xxxxx.cognitiveservices.azure.com/`. Incorrect: Adding `/openai` or other paths. Get the correct endpoint with: `az cognitiveservices account show --name <account-name> --resource-group <rg-name> --query properties.endpoint -o tsv`

**Issue**: Inference calls timeout or rate limited

- **Quick Fix**: Check AI Foundry project quotas in Azure Portal. Verify no other processes are consuming quota. Consider SKU limitations for concurrent requests. Review model deployment capacity settings.

**Issue**: Python package installation fails

- **Quick Fix**: Ensure Python 3.9+ is installed (`python3 --version`). Use fresh virtual environment (`rm -rf venv && python3 -m venv venv`). Update pip before installing: `pip install --upgrade pip`. Check network proxy settings if in corporate environment.

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->
