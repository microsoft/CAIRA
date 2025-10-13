#!/bin/bash
#
# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------
#
# validate-markdown-frontmatter.sh
#
# Purpose: Validates frontmatter consistency across markdown files in the repository
# Author: CAIRA Team
# Created: 2025-08-05

set -euo pipefail

# Default values
PATHS=("docs" "modules" "reference_architectures" ".github" "copilot" "capabilities")
FILES=()
EXCLUDE_PATTERNS=("*/.terraform/*" "*/CHANGELOG.md")
WARNINGS_AS_ERRORS=false
CHANGED_FILES_ONLY=false
BASE_BRANCH="origin/main"
DEBUG_OUTPUT=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${CYAN}$*${NC}"; }
log_success() { echo -e "${GREEN}$*${NC}"; }
log_warning() { echo -e "${YELLOW}$*${NC}"; }
log_error() { echo -e "${RED}$*${NC}"; }
log_debug() {
  if [[ "$DEBUG_OUTPUT" == "true" ]]; then
    echo -e "${MAGENTA}🔧 DEBUG: $*${NC}"
  fi
}
log_verbose() {
  if [[ "$DEBUG_OUTPUT" == "true" ]]; then
    echo -e "${GRAY}$*${NC}"
  fi
}

# Usage function
usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Validates frontmatter consistency across markdown files in the repository.

OPTIONS:
    -p, --paths PATHS           Comma-separated list of paths to search (default: docs,modules,reference_architectures,.github)
    -f, --files FILES           Comma-separated list of specific files to validate
    -e, --exclude PATTERNS      Comma-separated list of path patterns to exclude (default: */.terraform/*)
    -w, --warnings-as-errors    Treat warnings as errors
    -c, --changed-files-only    Only validate changed files from git diff
    -b, --base-branch BRANCH    Base branch for git diff (default: origin/main)
    -d, --debug                 Enable debug output
    -h, --help                  Show this help message

EXAMPLES:
    $0                                              # Validate all default paths
    $0 -p "docs,modules"                           # Validate specific paths
    $0 -f "docs/README.md,modules/ai/README.md"   # Validate specific files
    $0 -e "*/.terraform/*,*/node_modules/*"       # Exclude custom patterns
    $0 -c                                          # Validate only changed files
    $0 -w                                          # Treat warnings as errors
    $0 -d                                          # Enable debug output

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -p | --paths)
      IFS=',' read -ra PATHS <<<"$2"
      shift 2
      ;;
    -f | --files)
      IFS=',' read -ra FILES <<<"$2"
      shift 2
      ;;
    -e | --exclude)
      IFS=',' read -ra EXCLUDE_PATTERNS <<<"$2"
      shift 2
      ;;
    -w | --warnings-as-errors)
      WARNINGS_AS_ERRORS=true
      shift
      ;;
    -c | --changed-files-only)
      CHANGED_FILES_ONLY=true
      shift
      ;;
    -b | --base-branch)
      BASE_BRANCH="$2"
      shift 2
      ;;
    -d | --debug)
      DEBUG_OUTPUT=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Function to extract and parse frontmatter using yq
extract_frontmatter_with_yq() {
  local file="$1"
  local temp_file
  temp_file=$(mktemp)

  # Extract frontmatter section - support both HTML comment and YAML formats
  awk '
    BEGIN {
      in_frontmatter = 0
      line_num = 0
      frontmatter_type = ""
    }
    {
      line_num++
      # Check for HTML comment format
      if (line_num == 1 && $0 == "<!--") {
        in_frontmatter = 1
        frontmatter_type = "html_comment"
        next
      }
      # Check for YAML frontmatter format
      if (line_num == 1 && $0 == "---") {
        in_frontmatter = 1
        frontmatter_type = "yaml"
        next
      }
      # End conditions based on format type
      if (in_frontmatter && frontmatter_type == "html_comment" && $0 == "-->") {
        exit
      }
      if (in_frontmatter && frontmatter_type == "yaml" && $0 == "---") {
        exit
      }
      # Extract content if we are in frontmatter
      if (in_frontmatter) {
        print $0
      }
    }
  ' "$file" >"$temp_file"

  # Check if we got any frontmatter content
  if [[ ! -s "$temp_file" ]]; then
    rm -f "$temp_file"
    return 1
  fi

  echo "$temp_file"
  return 0
}

# Function to check if a file has frontmatter and extract key fields
check_frontmatter() {
  local file="$1"
  declare -A fields

  # Extract frontmatter using yq if available
  local frontmatter_file
  if ! frontmatter_file=$(extract_frontmatter_with_yq "$file"); then
    echo "NO_FRONTMATTER"
    return 1
  fi

  # Use yq to parse YAML if available, otherwise fall back to regex
  if command -v yq >/dev/null 2>&1; then
    log_debug "Using yq for YAML parsing on $file"

    # Extract all keys and their values using yq
    local keys
    if keys=$(yq eval 'keys | .[]' "$frontmatter_file" 2>/dev/null); then
      while IFS= read -r key; do
        [[ -z "$key" ]] && continue

        local value
        local value_type
        value=$(yq eval ".\"$key\"" "$frontmatter_file" 2>/dev/null || echo "")
        value_type=$(yq eval ".\"$key\" | type" "$frontmatter_file" 2>/dev/null || echo "")

        case "$value_type" in
          "!!str" | "!!int" | "!!float")
            fields["$key"]="$value"
            log_debug "Parsed field: $key = $value (type: $value_type)"
            ;;
          "!!seq")
            # Handle arrays
            local array_length
            array_length=$(yq eval ".\"$key\" | length" "$frontmatter_file" 2>/dev/null || echo "0")
            fields["$key"]="ARRAY"
            fields["${key}_is_array"]="true"
            fields["${key}_length"]="$array_length"
            log_debug "Parsed array field: $key with $array_length items (type: $value_type)"
            ;;
          *)
            fields["$key"]="$value"
            log_debug "Parsed field: $key = $value (type: $value_type)"
            ;;
        esac
      done <<<"$keys"
    fi
  else
    log_debug "yq not available, using regex fallback for $file"
    # Fallback to regex parsing
    while IFS= read -r line; do
      # Skip empty lines and comments
      if [[ -z "${line// /}" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
      fi

      # Handle key-value pairs
      if [[ "$line" =~ ^([^:]+):[[:space:]]*(.*) ]]; then
        local key="${BASH_REMATCH[1]// /}"
        local value="${BASH_REMATCH[2]}"

        # Remove quotes if present
        if [[ "$value" =~ ^[\"\'](.*)[\"\']$ ]]; then
          value="${BASH_REMATCH[1]}"
        fi

        fields["$key"]="$value"
        log_debug "Regex parsed field: $key = $value"
      fi
    done <"$frontmatter_file"
  fi

  # Clean up temp file
  rm -f "$frontmatter_file"

  # Check for required fields (for main documentation)
  local is_main_doc=false
  if [[ ("$file" == *"docs"* || "$file" == *"modules"* || "$file" == *"reference_architectures"* || "$file" == *"copilot"* || "$file" == *"capabilities"*) && "$file" != *".github"* ]]; then
    is_main_doc=true
  fi

  local errors=()
  local warnings=()

  if [[ "$is_main_doc" == "true" ]]; then
    local required_fields=("title" "description" "author" "ms.date" "ms.topic")

    for field in "${required_fields[@]}"; do
      if [[ -z "${fields[$field]:-}" ]]; then
        errors+=("Missing required field '$field'")
      fi
    done

    # Validate date format
    if [[ -n "${fields['ms.date']:-}" ]]; then
      local date="${fields['ms.date']}"
      if [[ ! "$date" =~ ^[0-9]{2}/[0-9]{2}/[0-9]{4}$ ]]; then
        warnings+=("Invalid date format. Expected MM/DD/YYYY, got: $date")
      fi
    fi

    # Validate ms.topic values
    if [[ -n "${fields['ms.topic']:-}" ]]; then
      local valid_topics=("concept" "how-to" "reference" "tutorial" "overview" "architecture" "module" "guide")
      local topic="${fields['ms.topic']}"
      local valid=false

      for valid_topic in "${valid_topics[@]}"; do
        if [[ "$topic" == "$valid_topic" ]]; then
          valid=true
          break
        fi
      done

      if [[ "$valid" == "false" ]]; then
        warnings+=("Invalid ms.topic value '$topic'. Valid values: ${valid_topics[*]}")
      fi
    fi

    # Validate estimated_reading_time if present
    if [[ -n "${fields['estimated_reading_time']:-}" ]]; then
      local reading_time="${fields['estimated_reading_time']}"
      if [[ ! "$reading_time" =~ ^[0-9]+$ ]]; then
        warnings+=("Invalid estimated_reading_time format. Should be a number.")
      fi
    fi

    # Validate keywords array (applies to all content types) - EXACT MATCH TO POWERSHELL
    if [[ -n "${fields['keywords']:-}" ]]; then
      if [[ "${fields['keywords_is_array']:-}" == "true" ]]; then
        local array_length="${fields['keywords_length']:-0}"
        if [[ "$array_length" -eq 0 ]]; then
          warnings+=("Keywords array is empty")
        fi
        log_debug "Keywords validated as array with $array_length items"
      else
        # Check if keywords field exists but is not an array
        local keywords_value="${fields['keywords']}"
        if [[ -n "$keywords_value" && "$keywords_value" != "ARRAY" ]]; then
          warnings+=("Keywords should be a YAML array format. Use format:\nkeywords:\n    - item1\n    - item2")
        fi
      fi
    fi
  fi

  # Output results
  for error in "${errors[@]}"; do
    echo "ERROR:$error"
  done

  for warning in "${warnings[@]}"; do
    echo "WARNING:$warning"
  done

  return 0
}

# Function to get changed markdown files from git
get_changed_markdown_files() {
  local base_branch="$1"
  local changed_files=()

  log_debug "Getting changed files from git diff against $base_branch"

  # Try different git diff strategies
  local git_files
  if git_files=$(git diff --name-only "$(git merge-base HEAD "$base_branch")" HEAD 2>/dev/null); then
    log_debug "Using merge-base strategy"
  elif git_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null); then
    log_debug "Using HEAD~1 strategy"
  elif git_files=$(git diff --name-only HEAD 2>/dev/null); then
    log_debug "Using staged/unstaged files strategy"
  else
    log_warning "Unable to determine changed files from git"
    return 1
  fi

  # Filter for markdown files that exist
  while IFS= read -r file; do
    if [[ -n "$file" && "$file" == *.md && -f "$file" ]]; then
      changed_files+=("$file")
      log_debug "Found changed markdown file: $file"
    fi
  done <<<"$git_files"

  printf '%s\n' "${changed_files[@]}"
}

# Main validation function
validate_markdown_frontmatter() {
  log_info "🔍 Validating frontmatter across markdown files..."
  log_debug "Function started with CHANGED_FILES_ONLY=$CHANGED_FILES_ONLY"

  local all_errors=()
  local all_warnings=()
  local total_files=0
  local markdown_files=()

  # Get files to validate
  if [[ "$CHANGED_FILES_ONLY" == "true" ]]; then
    log_info "🔍 Detecting changed markdown files from git diff..."
    local changed_files
    if changed_files=$(get_changed_markdown_files "$BASE_BRANCH"); then
      readarray -t markdown_files <<<"$changed_files"
      # Remove empty entries
      markdown_files=("${markdown_files[@]}")
      if [[ ${#markdown_files[@]} -gt 0 ]]; then
        log_info "Found ${#markdown_files[@]} changed markdown files to validate"
      else
        log_success "No changed markdown files found - validation complete"
        return 0
      fi
    else
      log_success "No changed markdown files found - validation complete"
      return 0
    fi
  elif [[ ${#FILES[@]} -gt 0 ]]; then
    log_info "Validating specific files..."
    for file in "${FILES[@]}"; do
      if [[ -n "$file" && -f "$file" && "$file" == *.md ]]; then
        markdown_files+=("$file")
        log_verbose "Added specific file: $file"
      else
        log_warning "File not found or invalid: $file"
      fi
    done
  else
    log_info "Searching for markdown files in specified paths..."
    for path in "${PATHS[@]}"; do
      log_debug "Processing path: $path"
      if [[ -d "$path" ]]; then
        log_info "📁 Searching in path: $path"
        local path_files=()

        # Build find command with exclude patterns
        local find_cmd=("find" "$path" "-name" "*.md" "-type" "f")
        for pattern in "${EXCLUDE_PATTERNS[@]}"; do
          find_cmd+=("-not" "-path" "$pattern")
        done
        find_cmd+=("-print0")

        while IFS= read -r -d '' file; do
          if [[ "$file" == *.md ]]; then
            path_files+=("$file")
            log_debug "Added markdown file: $(basename "$file")"
          fi
        done < <("${find_cmd[@]}" 2>/dev/null)

        markdown_files+=("${path_files[@]}")
        log_info "  Found ${#path_files[@]} markdown files in $path"
      else
        log_warning "Path not found: $path"
      fi
    done
  fi

  total_files=${#markdown_files[@]}
  log_info "Found $total_files total markdown files to validate"

  # Validate each file
  for file in "${markdown_files[@]}"; do
    [[ -z "$file" ]] && continue

    log_verbose "Validating: $file"

    # Check frontmatter
    local result
    if result=$(check_frontmatter "$file"); then
      # Process validation results
      while IFS= read -r line; do
        if [[ "$line" =~ ^ERROR:(.*) ]]; then
          all_errors+=("${BASH_REMATCH[1]} in: $file")
        elif [[ "$line" =~ ^WARNING:(.*) ]]; then
          all_warnings+=("${BASH_REMATCH[1]} in: $file")
        fi
      done <<<"$result"
    else
      # Check if this file should have frontmatter
      local is_github=false
      local is_main_doc=false

      if [[ "$file" == *".github"* ]]; then
        is_github=true
      fi

      if [[ ("$file" == *"docs"* || "$file" == *"modules"* || "$file" == *"reference_architectures"*) && "$is_github" == "false" ]]; then
        is_main_doc=true
      fi

      if [[ "$is_main_doc" == "true" ]]; then
        all_warnings+=("No frontmatter found in: $file")
      fi
    fi
  done

  # Output summary
  local has_issues=false

  log_info "📊 Validation Summary:"
  log_info "  Total files checked: $total_files"
  log_info "  Warnings found: ${#all_warnings[@]}"
  log_info "  Errors found: ${#all_errors[@]}"

  if [[ ${#all_warnings[@]} -gt 0 ]]; then
    log_warning "⚠️ Warnings found:"
    for warning in "${all_warnings[@]}"; do
      log_warning "  $warning"
    done
    if [[ "$WARNINGS_AS_ERRORS" == "true" ]]; then
      has_issues=true
    fi
  fi

  if [[ ${#all_errors[@]} -gt 0 ]]; then
    log_error "❌ Errors found:"
    for error in "${all_errors[@]}"; do
      log_error "  $error"
    done
    has_issues=true
  fi

  if [[ "$has_issues" == "false" ]]; then
    if [[ ${#all_warnings[@]} -eq 0 && ${#all_errors[@]} -eq 0 ]]; then
      log_success "✅ Frontmatter validation completed successfully"
    else
      log_success "✅ Frontmatter validation completed with warnings (non-blocking)"
    fi
    return 0
  else
    return 1
  fi
}

# Main execution
main() {
  # Change to repository root if possible
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local workspace_root
  workspace_root="$(dirname "$(dirname "$script_dir")")"

  if [[ -d "$workspace_root" ]]; then
    cd "$workspace_root"
    log_verbose "Changed working directory to: $workspace_root"
  else
    log_warning "Could not change to repository root directory"
  fi

  # Run validation
  if validate_markdown_frontmatter; then
    log_success "✅ All frontmatter validation checks passed!"
    exit 0
  else
    exit 1
  fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
