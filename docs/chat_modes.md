<!-- META
title: CAIRA Chat Modes Guide
description: Complete guide for new users to understand CAIRA's AI assistants and deploy Azure AI infrastructure with ease.
author: CAIRA Team
ms.date: 09/25/2025
ms.topic: guide
estimated_reading_time: 3
keywords:
    - caira assistant
    - chat modes
    - deployment guide
    - reference architectures
    - azure ai foundry
    - getting started
    - user guide
-->

# CAIRA Chat Modes Guide

## 🧠 CAIRA's AI Assistant System

CAIRA includes a number of [chat modes](https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes) that make working with Azure AI infrastructure as simple as having a conversation.

## Available AI Assistants (Chat modes)

| Assistant              | Purpose                              | Best For                                        |
|------------------------|--------------------------------------|-------------------------------------------------|
| **CAIRA Assistant**    | Deploy and manage AI infrastructure  | New users, architecture selection, deployments  |
| **Task Planner**       | Create implementation plans          | Project planning, complex implementations       |
| **Prompt Builder**     | Engineer high-quality prompts        | AI application development, prompt optimization |
| **ADR Creation Coach** | Architectural decision documentation | Enterprise governance, decision tracking        |

This page will focus primarily on the CAIRA Assistant chatmode.

## The CAIRA Assistant - Your Deployment Guide

The **CAIRA Assistant** is your primary guide for deploying Azure AI infrastructure.

**What it does for you:**

- 🔍 **Smart Architecture Selection** - Analyzes your requirements and recommends a relevant architecture
- 📋 **Step-by-Step Guidance** - Breaks down complex deployments into simple, actionable steps
- ⚡ **Interactive Deployment** - Can execute commands for you or guide you through manual steps
- 🛠️ **Real-Time Problem Solving** - Troubleshoots issues as they arise
- 📊 **Complete Visibility** - Shows exactly what will be deployed before you commit

**Sample Conversation:**

```text
You: "I need to deploy AI infrastructure for my team"

CAIRA Assistant: "I'll help you choose and deploy the perfect AI architecture!
Let me show you the options based on your needs:

1. foundry_basic - Great for learning and simpler usage scenarios.
2. foundry_standard - Enterprise features with data sovereignty.
3. Private variants available for both with network isolation

What's your primary use case - development, production, or enterprise compliance?"
```

## Getting Started - Your First Deployment

### Step 1: Access CAIRA Assistant

In your development environment, select the `caira-assistant` chat mode.

**Example ways to start:**

- "Deploy a basic AI Foundry architecture"
- "What architecture should I choose for production workloads?"
- "I need Azure AI Foundry with private networking"

### Step 2: Let CAIRA Guide Architecture Selection

The CAIRA Assistant will:

1. **Ask about your requirements** (development vs. production, security needs, etc.)
1. **Present relevant options** with clear explanations of each architecture along with key pre-requisites.
1. **Show deployment complexity** and time estimates
1. **Wait for your choice** - never auto-selects without your confirmation

### Step 3: Interactive Deployment Options

Once you choose an architecture, CAIRA Assistant provides different options for interaction:

**Option A: Guided Assistance** (Recommended for new users)

- CAIRA executes commands for you
- Provides real-time feedback and progress updates
- Handles errors and troubleshooting automatically
- You see exactly what's happening at each step

**Option B: Manual Execution**

- CAIRA provides all commands with explanations
- You copy and paste commands in your terminal
- CAIRA explains what each command does
- Great for learning the underlying process

**Sample Guided Deployment:**

```text
CAIRA Assistant: "I'll deploy foundry_basic for you. Here's what will happen:
1. Configure Azure authentication ✓
2. Initialize Terraform ✓
3. Create deployment plan (17 resources)
4. Deploy AI Foundry with GPT-4o model (estimated: 15-20 minutes)

Ready to proceed? This will create resources in your Azure subscription."

You: "yes"

CAIRA Assistant: "Starting deployment...
✓ Azure authentication configured
✓ Terraform initialized
✓ Creating deployment plan...
Here's what will be deployed: [shows detailed resource list]
Applying deployment... (progress updates continue)"
```

### Additional Resources

- 📚 [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- 🛠️ [Environment Setup](./environment_setup.md) - Development environment configuration
