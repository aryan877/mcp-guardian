terraform {
  required_providers {
    archestra = {
      source = "archestra-ai/archestra"
    }
  }
}

provider "archestra" {
  # Set via env vars:
  #   ARCHESTRA_API_URL  (e.g. http://localhost:9000)
  #   ARCHESTRA_API_KEY  (from Archestra Settings → API Keys)
}

# ─── Variables ───────────────────────────────────────────────────────────────

variable "guardian_docker_image" {
  description = "Docker image for MCP Guardian (must be pre-loaded into kind)"
  type        = string
  default     = "mcp-guardian:latest"
}

variable "malicious_demo_docker_image" {
  description = "Docker image for malicious demo server (must be pre-loaded into kind)"
  type        = string
  default     = "malicious-demo:latest"
}

variable "archestra_internal_url" {
  description = "Archestra API URL reachable from inside K8s pods"
  type        = string
  default     = "http://172.25.0.3:9000"
}

variable "archestra_api_key" {
  description = "API key for Guardian to call Archestra API (set via TF_VAR_archestra_api_key)"
  type        = string
  sensitive   = true
}

# ─── MCP Guardian ────────────────────────────────────────────────────────────

resource "archestra_mcp_registry_catalog_item" "guardian" {
  name        = "mcp-guardian"
  description = "Security auditor for MCP servers — scans vulnerabilities, generates policies, computes trust scores"
  docs_url    = "https://github.com/aryan877/mcp-guardian"

  local_config = {
    command        = "node"
    arguments      = ["dist/index.js"]
    docker_image   = var.guardian_docker_image != "" ? var.guardian_docker_image : null
    transport_type = "streamable-http"
    http_port      = 8080
    http_path      = "/mcp"

    environment = {
      TRANSPORT          = "sse"
      PORT               = "8080"
      ARCHESTRA_API_URL  = var.archestra_internal_url
      ARCHESTRA_API_KEY  = var.archestra_api_key
    }
  }
}

resource "archestra_mcp_server_installation" "guardian" {
  name          = "mcp-guardian"
  mcp_server_id = archestra_mcp_registry_catalog_item.guardian.id
}

# ─── Malicious Demo Server ──────────────────────────────────────────────────

resource "archestra_mcp_registry_catalog_item" "malicious_demo" {
  name        = "malicious-demo"
  description = "DEMO ONLY — Intentionally vulnerable MCP server with 7 dangerous tools for Guardian demo"

  local_config = {
    command        = "npx"
    arguments      = ["tsx", "index.ts"]
    docker_image   = var.malicious_demo_docker_image != "" ? var.malicious_demo_docker_image : null
    transport_type = "streamable-http"
    http_port      = 8081
    http_path      = "/mcp"

    environment = {
      TRANSPORT = "sse"
      PORT      = "8081"
    }
  }
}

resource "archestra_mcp_server_installation" "malicious_demo" {
  name          = "malicious-demo"
  mcp_server_id = archestra_mcp_registry_catalog_item.malicious_demo.id
}

# ─── Security Scanner Profile ───────────────────────────────────────────────

resource "archestra_profile" "guardian_agent" {
  name = "Guardian Security Agent"

  labels = [
    {
      key   = "purpose"
      value = "security-auditing"
    },
    {
      key   = "hackathon"
      value = "2-fast-2-mcp"
    }
  ]
}

# ─── Assign Guardian tools to profile ────────────────────────────────────────

# Look up each Guardian tool by name from the installed server
data "archestra_mcp_server_tool" "scan_server" {
  mcp_server_id = archestra_mcp_server_installation.guardian.id
  name          = "mcp-guardian__scan_server"
  depends_on    = [archestra_mcp_server_installation.guardian]
}

data "archestra_mcp_server_tool" "test_server" {
  mcp_server_id = archestra_mcp_server_installation.guardian.id
  name          = "mcp-guardian__test_server"
  depends_on    = [archestra_mcp_server_installation.guardian]
}

data "archestra_mcp_server_tool" "generate_policy" {
  mcp_server_id = archestra_mcp_server_installation.guardian.id
  name          = "mcp-guardian__generate_policy"
  depends_on    = [archestra_mcp_server_installation.guardian]
}

data "archestra_mcp_server_tool" "trust_score" {
  mcp_server_id = archestra_mcp_server_installation.guardian.id
  name          = "mcp-guardian__trust_score"
  depends_on    = [archestra_mcp_server_installation.guardian]
}

data "archestra_mcp_server_tool" "monitor" {
  mcp_server_id = archestra_mcp_server_installation.guardian.id
  name          = "mcp-guardian__monitor"
  depends_on    = [archestra_mcp_server_installation.guardian]
}

data "archestra_mcp_server_tool" "audit_report" {
  mcp_server_id = archestra_mcp_server_installation.guardian.id
  name          = "mcp-guardian__audit_report"
  depends_on    = [archestra_mcp_server_installation.guardian]
}

# Assign each tool to the profile
resource "archestra_profile_tool" "scan_server" {
  profile_id                                 = archestra_profile.guardian_agent.id
  tool_id                                    = data.archestra_mcp_server_tool.scan_server.id
  credential_source_mcp_server_id            = archestra_mcp_server_installation.guardian.id
  execution_source_mcp_server_id             = archestra_mcp_server_installation.guardian.id
  allow_usage_when_untrusted_data_is_present = true
  tool_result_treatment                      = "untrusted"

  lifecycle { ignore_changes = [allow_usage_when_untrusted_data_is_present, tool_result_treatment] }
}

resource "archestra_profile_tool" "test_server" {
  profile_id                                 = archestra_profile.guardian_agent.id
  tool_id                                    = data.archestra_mcp_server_tool.test_server.id
  credential_source_mcp_server_id            = archestra_mcp_server_installation.guardian.id
  execution_source_mcp_server_id             = archestra_mcp_server_installation.guardian.id
  allow_usage_when_untrusted_data_is_present = true
  tool_result_treatment                      = "untrusted"

  lifecycle { ignore_changes = [allow_usage_when_untrusted_data_is_present, tool_result_treatment] }
}

resource "archestra_profile_tool" "generate_policy" {
  profile_id                                 = archestra_profile.guardian_agent.id
  tool_id                                    = data.archestra_mcp_server_tool.generate_policy.id
  credential_source_mcp_server_id            = archestra_mcp_server_installation.guardian.id
  execution_source_mcp_server_id             = archestra_mcp_server_installation.guardian.id
  allow_usage_when_untrusted_data_is_present = true
  tool_result_treatment                      = "untrusted"

  lifecycle { ignore_changes = [allow_usage_when_untrusted_data_is_present, tool_result_treatment] }
}

resource "archestra_profile_tool" "trust_score" {
  profile_id                                 = archestra_profile.guardian_agent.id
  tool_id                                    = data.archestra_mcp_server_tool.trust_score.id
  credential_source_mcp_server_id            = archestra_mcp_server_installation.guardian.id
  execution_source_mcp_server_id             = archestra_mcp_server_installation.guardian.id
  allow_usage_when_untrusted_data_is_present = true
  tool_result_treatment                      = "untrusted"

  lifecycle { ignore_changes = [allow_usage_when_untrusted_data_is_present, tool_result_treatment] }
}

resource "archestra_profile_tool" "monitor" {
  profile_id                                 = archestra_profile.guardian_agent.id
  tool_id                                    = data.archestra_mcp_server_tool.monitor.id
  credential_source_mcp_server_id            = archestra_mcp_server_installation.guardian.id
  execution_source_mcp_server_id             = archestra_mcp_server_installation.guardian.id
  allow_usage_when_untrusted_data_is_present = true
  tool_result_treatment                      = "untrusted"

  lifecycle { ignore_changes = [allow_usage_when_untrusted_data_is_present, tool_result_treatment] }
}

resource "archestra_profile_tool" "audit_report" {
  profile_id                                 = archestra_profile.guardian_agent.id
  tool_id                                    = data.archestra_mcp_server_tool.audit_report.id
  credential_source_mcp_server_id            = archestra_mcp_server_installation.guardian.id
  execution_source_mcp_server_id             = archestra_mcp_server_installation.guardian.id
  allow_usage_when_untrusted_data_is_present = true
  tool_result_treatment                      = "untrusted"

  lifecycle { ignore_changes = [allow_usage_when_untrusted_data_is_present, tool_result_treatment] }
}

# ─── Optional: Team & Limits ────────────────────────────────────────────────

resource "archestra_team" "security" {
  name        = "Security Team"
  description = "Team with full Guardian access for security auditing"
}
