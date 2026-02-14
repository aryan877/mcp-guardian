"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  Zap,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

const GUARDIAN_URL =
  process.env.NEXT_PUBLIC_GUARDIAN_URL || "http://localhost:8080";

interface Policy {
  type: "tool_invocation" | "trusted_data";
  toolName: string;
  action: string;
  reason: string;
  applied: boolean;
}

interface PolicyResult {
  serverName: string;
  policiesGenerated: number;
  policies: Policy[];
}

const modeConfig = {
  recommended: {
    label: "Recommended",
    desc: "Balanced security based on risk",
    icon: ShieldCheck,
    color: "text-guardian-green",
  },
  strict: {
    label: "Strict",
    desc: "Maximum security, blocks risky tools",
    icon: ShieldAlert,
    color: "text-guardian-red",
  },
  permissive: {
    label: "Permissive",
    desc: "Minimal blocking, monitors only",
    icon: Eye,
    color: "text-guardian-blue",
  },
};

const actionConfig: Record<string, { color: string; icon: typeof Lock; label: string }> = {
  block_always: {
    color: "bg-guardian-red/10 text-guardian-red border-guardian-red/20",
    icon: ShieldOff,
    label: "BLOCK ALWAYS",
  },
  block_when_context_is_untrusted: {
    color: "bg-guardian-orange/10 text-guardian-orange border-guardian-orange/20",
    icon: Lock,
    label: "BLOCK UNTRUSTED",
  },
  allow_when_context_is_untrusted: {
    color: "bg-guardian-green/10 text-guardian-green border-guardian-green/20",
    icon: CheckCircle2,
    label: "ALLOW",
  },
  mark_as_untrusted: {
    color: "bg-guardian-orange/10 text-guardian-orange border-guardian-orange/20",
    icon: EyeOff,
    label: "MARK UNTRUSTED",
  },
  mark_as_trusted: {
    color: "bg-guardian-green/10 text-guardian-green border-guardian-green/20",
    icon: CheckCircle2,
    label: "MARK TRUSTED",
  },
  sanitize_with_dual_llm: {
    color: "bg-guardian-blue/10 text-guardian-blue border-guardian-blue/20",
    icon: Zap,
    label: "DUAL LLM SANITIZE",
  },
};

export default function PoliciesPage() {
  const [serverName, setServerName] = useState("malicious-demo");
  const [mode, setMode] = useState<"recommended" | "strict" | "permissive">("recommended");
  const [dryRun, setDryRun] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PolicyResult | null>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<number | null>(null);

  async function generatePolicies() {
    setGenerating(true);
    setResult(null);
    setExpandedPolicy(null);

    try {
      const jsonRpc = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "generate_policy",
          arguments: { serverName, mode, dryRun },
        },
      };

      const res = await fetch(`${GUARDIAN_URL}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonRpc),
      });

      const rpcResponse = await res.json();
      if (rpcResponse.result?.content?.[0]?.text) {
        setResult(JSON.parse(rpcResponse.result.content[0].text));
      }
    } catch (err) {
      console.error("Policy generation failed:", err);
    }

    setGenerating(false);
  }

  const policyByType = result
    ? {
        tool_invocation: result.policies.filter((p) => p.type === "tool_invocation"),
        trusted_data: result.policies.filter((p) => p.type === "trusted_data"),
      }
    : null;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">POLICY ENGINE</h1>
            <p className="text-xs text-muted-foreground tracking-wide">
              Auto-generate and apply Archestra security policies from scan results
            </p>
          </div>
        </div>
      </div>

      {/* Config */}
      <Card className="mb-6 border-border bg-card">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-[10px] tracking-widest text-muted-foreground mb-2 block">
                SERVER NAME
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter MCP server name..."
                className="w-full h-11 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono"
              />
            </div>
          </div>

          {/* Mode Selection */}
          <div>
            <label className="text-[10px] tracking-widest text-muted-foreground mb-2 block">
              POLICY MODE
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(modeConfig) as Array<keyof typeof modeConfig>).map((key) => {
                const config = modeConfig[key];
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      mode === key
                        ? "bg-primary/5 border-primary/30"
                        : "bg-secondary border-border hover:border-primary/10"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${config.color}`} />
                    <p className="text-sm font-bold tracking-wider">{config.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{config.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDryRun(!dryRun)}
              className={`flex items-center gap-2 px-4 h-11 rounded-lg border text-sm transition-all ${
                dryRun
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-guardian-red/10 border-guardian-red/30 text-guardian-red"
              }`}
            >
              {dryRun ? <Eye className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              <span>{dryRun ? "Preview Only" : "APPLY LIVE"}</span>
            </button>

            {!dryRun && (
              <div className="flex items-center gap-2 text-xs text-guardian-red">
                <AlertTriangle className="w-4 h-4" />
                <span className="tracking-wider">Policies will be applied to Archestra</span>
              </div>
            )}

            <Button
              onClick={generatePolicies}
              disabled={generating || !serverName}
              className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider ml-auto"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  GENERATING...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  GENERATE POLICIES
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generating Animation */}
      {generating && (
        <Card className="mb-6 border-primary/20 bg-card overflow-hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 shimmer" />
            <div className="relative flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
              <ShieldCheck className="w-10 h-10 text-primary animate-float" />
            </div>
            <p className="text-sm font-bold tracking-widest text-primary">
              GENERATING POLICIES
            </p>
            <p className="text-xs text-muted-foreground mt-2 tracking-wide">
              Scanning vulnerabilities and mapping to Archestra policies...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !generating && (
        <div className="space-y-6 animate-count-up">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-primary">{result.policiesGenerated}</p>
                <p className="text-xs text-muted-foreground tracking-wider mt-2">POLICIES GENERATED</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-guardian-green">
                  {result.policies.filter((p) => p.applied).length}
                </p>
                <p className="text-xs text-muted-foreground tracking-wider mt-2">APPLIED</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-guardian-orange">
                  {result.policies.filter((p) => !p.applied).length}
                </p>
                <p className="text-xs text-muted-foreground tracking-wider mt-2">PENDING</p>
              </CardContent>
            </Card>
          </div>

          {/* Tool Invocation Policies */}
          {policyByType && policyByType.tool_invocation.length > 0 && (
            <div>
              <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                TOOL INVOCATION POLICIES
              </h2>
              <div className="space-y-2">
                {policyByType.tool_invocation.map((policy, i) => {
                  const config = actionConfig[policy.action] || actionConfig.block_always;

                  const isExpanded = expandedPolicy === i;

                  return (
                    <Card
                      key={i}
                      className={`border bg-card cursor-pointer transition-all hover:bg-secondary/30 ${
                        isExpanded ? "border-primary/30" : "border-border"
                      }`}
                      onClick={() => setExpandedPolicy(isExpanded ? null : i)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] tracking-widest px-2 py-0.5 ${config.color} border flex-shrink-0`}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-sm font-mono flex-1">{policy.toolName}</span>
                          {policy.applied && (
                            <Badge variant="outline" className="text-[10px] tracking-wider text-guardian-green border-guardian-green/20">
                              APPLIED
                            </Badge>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="mt-4 ml-7 pl-4 border-l-2 border-primary/20">
                            <p className="text-[10px] tracking-widest text-muted-foreground mb-1">REASON</p>
                            <p className="text-sm">{policy.reason}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trusted Data Policies */}
          {policyByType && policyByType.trusted_data.length > 0 && (
            <div>
              <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                TRUSTED DATA POLICIES
              </h2>
              <div className="space-y-2">
                {policyByType.trusted_data.map((policy, i) => {
                  const globalIndex = (policyByType?.tool_invocation.length || 0) + i;
                  const config = actionConfig[policy.action] || actionConfig.mark_as_untrusted;

                  const isExpanded = expandedPolicy === globalIndex;

                  return (
                    <Card
                      key={globalIndex}
                      className={`border bg-card cursor-pointer transition-all hover:bg-secondary/30 ${
                        isExpanded ? "border-primary/30" : "border-border"
                      }`}
                      onClick={() => setExpandedPolicy(isExpanded ? null : globalIndex)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] tracking-widest px-2 py-0.5 ${config.color} border flex-shrink-0`}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-sm font-mono flex-1">{policy.toolName}</span>
                          {policy.applied && (
                            <Badge variant="outline" className="text-[10px] tracking-wider text-guardian-green border-guardian-green/20">
                              APPLIED
                            </Badge>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="mt-4 ml-7 pl-4 border-l-2 border-primary/20">
                            <p className="text-[10px] tracking-widest text-muted-foreground mb-1">REASON</p>
                            <p className="text-sm">{policy.reason}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !generating && (
        <Card className="border-border border-dashed bg-card/50">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-secondary border border-border">
              <ShieldCheck className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-bold tracking-widest mb-2">NO POLICIES GENERATED</h3>
            <p className="text-xs text-muted-foreground max-w-md tracking-wide">
              Guardian will scan the server for vulnerabilities, then auto-generate Archestra
              security policies. Use Preview mode to review before applying.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
