#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_npm_deps() {
  local dir="$1"
  if [[ ! -x "${dir}/node_modules/.bin/tsc" ]]; then
    echo "Missing TypeScript dependencies in ${dir}. Run 'task bootstrap' first." >&2
    exit 1
  fi
}

require_dotnet_restore() {
  local project_dir="$1"
  if [[ ! -f "${project_dir}/obj/project.assets.json" ]]; then
    echo "Missing .NET restore assets in ${project_dir}. Run 'task bootstrap' first." >&2
    exit 1
  fi
}

run_npm() {
  local dir="$1"
  require_npm_deps "${dir}"
  npm run typecheck --prefix "${dir}" --silent
  npm run build --prefix "${dir}" --silent
}

run_terraform() {
  local dir="$1"
  terraform -chdir="${dir}" fmt -check
  terraform -chdir="${dir}" init -backend=false -input=false
  terraform -chdir="${dir}" validate
}

run_npm "${ROOT_DIR}/reference-architectures/app/api/typescript/openai-agents-sdk"
run_npm "${ROOT_DIR}/reference-architectures/app/api/typescript/foundry-agent-service"
run_npm "${ROOT_DIR}/reference-architectures/app/frontend/typescript/react"

DOTNET_PROJECT_DIR="${ROOT_DIR}/reference-architectures/app/api/csharp/microsoft-agent-framework"
DOTNET_PROJECT="${DOTNET_PROJECT_DIR}/Caira.Api.MicrosoftAgentFramework.csproj"

require_dotnet_restore "${DOTNET_PROJECT_DIR}"
dotnet build "${DOTNET_PROJECT}" --no-restore

run_terraform "${ROOT_DIR}/reference-architectures/iac/foundry"
run_terraform "${ROOT_DIR}/reference-architectures/iac/container-apps"
