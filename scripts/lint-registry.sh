#!/bin/bash
# =============================================================================
# Registry Integrity Validator
# =============================================================================
# Validates that registry.yaml is the single source of truth:
# - All workflows/skills on disk must have registry entries
# - Deprecated entities must be removed from disk
# - MCP adapters must match registry declarations
#
# Usage: ./scripts/lint-registry.sh
# Exit code: 0 = pass, >0 = number of errors found
# =============================================================================

set -euo pipefail

ERRORS=0
WARNINGS=0
REGISTRY="/root/.claude/registry.yaml"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

error() {
  echo -e "${RED}ERROR:${NC} $1"
  ((ERRORS++))
}

warn() {
  echo -e "${YELLOW}WARN:${NC} $1"
  ((WARNINGS++))
}

info() {
  echo -e "${GREEN}INFO:${NC} $1"
}

# -----------------------------------------------------------------------------
# Check 0: JSON Schema validation (if ajv available)
# -----------------------------------------------------------------------------
if command -v npx &> /dev/null && [ -f "/root/.claude/registry.schema.json" ]; then
  info "Validating YAML schema..."
  
  if npx ajv-cli validate -s /root/.claude/registry.schema.json -d "$REGISTRY" 2>/dev/null; then
    info "✓ Schema validation passed"
  else
    error "Schema validation failed (run: npx ajv-cli validate -s registry.schema.json -d registry.yaml)"
  fi
fi

# -----------------------------------------------------------------------------
# Check 1: All workflows on disk have registry entries
# -----------------------------------------------------------------------------
info "Checking workflow inventory completeness..."

for workflow_dir in /root/.claude/workflows/*/; do
  # Skip template
  [[ "$workflow_dir" == *"_template"* ]] && continue

  workflow_name=$(basename "$workflow_dir")

  # Check if WORKFLOW.md exists
  if [ -f "$workflow_dir/WORKFLOW.md" ]; then
    # Check if in registry
    if ! grep -q "^  $workflow_name:" "$REGISTRY" 2>/dev/null; then
      error "Workflow '$workflow_name' has WORKFLOW.md but no registry entry"
    fi
  fi
done

# -----------------------------------------------------------------------------
# Check 2: All skills on disk have registry entries
# -----------------------------------------------------------------------------
info "Checking skill inventory completeness..."

for skill_dir in /root/.claude/skills/*/; do
  # Skip template
  [[ "$skill_dir" == *"_template"* ]] && continue

  skill_name=$(basename "$skill_dir")

  # Check if SKILL.md exists
  if [ -f "$skill_dir/SKILL.md" ]; then
    # Check if in registry
    if ! grep -q "^  $skill_name:" "$REGISTRY" 2>/dev/null; then
      error "Skill '$skill_name' has SKILL.md but no registry entry"
    fi
  fi
done

# -----------------------------------------------------------------------------
# Check 3: Deprecated workflows must be removed from disk
# -----------------------------------------------------------------------------
info "Checking for deprecated entities on disk..."

# Check if yq is available
if command -v yq &> /dev/null; then
  # Parse deprecated workflows using yq
  deprecated_workflows=$(yq '.workflows | to_entries | .[] | select(.value.status == "deprecated") | .key' "$REGISTRY" 2>/dev/null || echo "")

  for workflow in $deprecated_workflows; do
    if [ -d "/root/.claude/workflows/$workflow" ]; then
      error "Deprecated workflow '$workflow' still exists on disk at workflows/$workflow/"
    fi
  done
else
  # Fallback: manual grep for deprecated
  warn "yq not installed, skipping automated deprecated entity check"
fi

# -----------------------------------------------------------------------------
# Check 4: Implemented workflows must have required fields
# -----------------------------------------------------------------------------
info "Checking implemented workflows have required metadata..."

# This requires yq to parse YAML properly
if command -v yq &> /dev/null; then
  implemented_workflows=$(yq '.workflows | to_entries | .[] | select(.value.status == "implemented") | .key' "$REGISTRY" 2>/dev/null || echo "")

  for workflow in $implemented_workflows; do
    # Check for required fields
    if ! yq ".workflows.$workflow | has(\"version\")" "$REGISTRY" | grep -q true; then
      error "Implemented workflow '$workflow' missing 'version' field"
    fi

    if ! yq ".workflows.$workflow | has(\"failure_model\")" "$REGISTRY" | grep -q true; then
      error "Implemented workflow '$workflow' missing 'failure_model' field"
    fi

    if ! yq ".workflows.$workflow | has(\"replay_safety\")" "$REGISTRY" | grep -q true; then
      error "Implemented workflow '$workflow' missing 'replay_safety' field"
    fi

    if ! yq ".workflows.$workflow | has(\"done_when\")" "$REGISTRY" | grep -q true; then
      error "Implemented workflow '$workflow' missing 'done_when' field"
    fi
  done
fi

# -----------------------------------------------------------------------------
# Check 5: MCP adapters should match registry
# -----------------------------------------------------------------------------
info "Checking MCP adapter alignment..."

for adapter_dir in /root/.claude/mcp-server/src/adapters/*/; do
  # Skip test directories and special cases
  [[ "$adapter_dir" == *"__tests__"* ]] && continue

  adapter_name=$(basename "$adapter_dir")

  # Check if adapter is referenced in registry (workflows, connectors, or skills)
  if ! grep -rq "$adapter_name" "$REGISTRY" 2>/dev/null; then
    warn "MCP adapter '$adapter_name' exists but not referenced in registry"
  fi
done

# -----------------------------------------------------------------------------
# Check 6: agents/ folder should not exist (per registry L36)
# -----------------------------------------------------------------------------
info "Checking for forbidden directories..."

if [ -d "/root/.claude/agents" ]; then
  # Check if it has actual content (not just README)
  content_files=$(find /root/.claude/agents -type f ! -name "README.md" | wc -l)
  if [ "$content_files" -gt 0 ]; then
    error "agents/ folder exists with content, but registry declares it DELETED (L36-38)"
  fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  info "✓ Registry validation PASSED"
  echo "=========================================="
  exit 0
elif [ $ERRORS -eq 0 ]; then
  warn "Registry validation passed with $WARNINGS warnings"
  echo "=========================================="
  exit 0
else
  error "Registry validation FAILED with $ERRORS errors and $WARNINGS warnings"
  echo "=========================================="
  exit $ERRORS
fi
