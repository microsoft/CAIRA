#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_npm_audit() {
  local dir="$1"
  npm audit --prefix "${dir}" --audit-level=moderate
}

run_npm_audit "${ROOT_DIR}/reference-architectures/app/api/typescript/openai-agents-sdk"
run_npm_audit "${ROOT_DIR}/reference-architectures/app/api/typescript/foundry-agent-service"
run_npm_audit "${ROOT_DIR}/reference-architectures/app/frontend/typescript/react"

DOTNET_PROJECT="${ROOT_DIR}/reference-architectures/app/api/csharp/microsoft-agent-framework/Caira.Api.MicrosoftAgentFramework.csproj"

dotnet list "${DOTNET_PROJECT}" package --vulnerable --include-transitive \
  | tee /tmp/caira-dotnet-vulnerable.txt
if grep -q "has the following vulnerable packages" /tmp/caira-dotnet-vulnerable.txt; then
  exit 1
fi
