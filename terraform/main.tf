terraform {
  required_providers {
    archestra = {
      source = "archestra/archestra"
    }
  }
}

provider "archestra" {
  # Uses ARCHESTRA_API_URL and ARCHESTRA_API_TOKEN env vars
}

# Register Guardian in private MCP catalog
resource "archestra_mcp_registry_catalog_item" "guardian" {
  name        = "mcp-guardian"
  description = "Security auditor for MCP servers - scans, tests, and auto-generates security policies"
  docs_url    = "https://github.com/yourrepo/mcp-guardian"

  local_config = {
    command   = "node"
    arguments = ["dist/index.js"]
    environment = {
      ARCHESTRA_API_URL = "http://localhost:9000"
    }
  }
}

# Install Guardian as an MCP server
resource "archestra_mcp_server_installation" "guardian" {
  name          = "guardian"
  mcp_server_id = archestra_mcp_registry_catalog_item.guardian.id
}

# Create a profile/agent for Guardian
resource "archestra_profile" "guardian_agent" {
  name        = "Guardian Security Agent"
  description = "AI security agent powered by MCP Guardian - audits and secures MCP servers"
  model       = "gpt-4o"

  tools = [
    archestra_mcp_server_installation.guardian.id
  ]
}

# Set cost limits for Guardian's LLM usage
resource "archestra_limit" "guardian_cost" {
  entity_id   = archestra_profile.guardian_agent.id
  entity_type = "profile"
  limit_type  = "token_cost"
  limit_value = 100000
  model       = ["gpt-4o", "gpt-4o-mini"]
}

# Security team with full access
resource "archestra_team" "security" {
  name        = "Security Team"
  description = "Team with full Guardian access for security auditing"
}

# Use cheaper model for simple scans
resource "archestra_optimization_rule" "guardian_optimization" {
  entity_type  = "profile"
  entity_id    = archestra_profile.guardian_agent.id
  llm_provider = "openai"
  target_model = "gpt-4o-mini"
  enabled      = true

  conditions = [
    { max_length = 500 }
  ]
}

# --- Demo: Install malicious server for demo ---

resource "archestra_mcp_registry_catalog_item" "malicious_demo" {
  name        = "malicious-demo-server"
  description = "DEMO ONLY - Intentionally vulnerable MCP server for Guardian demo"

  local_config = {
    command   = "node"
    arguments = ["demo/malicious-server/dist/index.js"]
  }
}

resource "archestra_mcp_server_installation" "malicious_demo" {
  name          = "malicious-demo"
  mcp_server_id = archestra_mcp_registry_catalog_item.malicious_demo.id
}
