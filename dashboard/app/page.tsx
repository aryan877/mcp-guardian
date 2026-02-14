"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  ScanSearch,
  Server,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { useState } from "react";

const ARCHESTRA_API =
  process.env.NEXT_PUBLIC_ARCHESTRA_API || "http://localhost:9000";
const GUARDIAN_URL =
  process.env.NEXT_PUBLIC_GUARDIAN_URL || "http://localhost:8080";

interface Vulnerability {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  tool: string;
  description: string;
  recommendation: string;
}

interface ScanResult {
  serverName: string;
  toolCount: number;
  vulnerabilities: Vulnerability[];
  trustScore: number;
  scannedAt: string;
}

const severityConfig = {
  critical: {
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: ShieldAlert,
    order: 0,
  },
  high: {
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    icon: AlertTriangle,
    order: 1,
  },
  medium: {
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    icon: AlertTriangle,
    order: 2,
  },
  low: {
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Info,
    order: 3,
  },
  info: {
    color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    icon: Info,
    order: 4,
  },
};

function getGrade(score: number): { letter: string; class: string } {
  if (score >= 95) return { letter: "A+", class: "text-guardian-green" };
  if (score >= 85) return { letter: "A", class: "text-guardian-green" };
  if (score >= 70) return { letter: "B", class: "text-primary" };
  if (score >= 55) return { letter: "C", class: "text-guardian-orange" };
  if (score >= 40) return { letter: "D", class: "text-guardian-orange" };
  return { letter: "F", class: "text-guardian-red" };
}

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-guardian-green";
  if (score >= 40) return "bg-guardian-orange";
  return "bg-guardian-red";
}

export default function ScanPage() {
  const [serverName, setServerName] = useState("malicious-demo");
  const [deepScan, setDeepScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);
  const [servers, setServers] = useState<string[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);

  async function fetchServers() {
    setLoadingServers(true);
    try {
      const res = await fetch(`${ARCHESTRA_API}/api/mcp_server`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const names = (Array.isArray(data) ? data : data.servers || []).map(
          (s: { name: string }) => s.name,
        );
        setServers(names);
      }
    } catch {
      // silently fail, user can type manually
    }
    setLoadingServers(false);
  }

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    setExpandedVuln(null);

    try {
      // Call Guardian's scan_server tool via its MCP endpoint
      const jsonRpc = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "scan_server",
          arguments: {
            serverName,
            deep: deepScan,
          },
        },
      };

      const res = await fetch(`${GUARDIAN_URL}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonRpc),
      });

      const rpcResponse = await res.json();

      if (rpcResponse.result?.content?.[0]?.text) {
        const parsed = JSON.parse(rpcResponse.result.content[0].text);
        setScanResult(parsed);
      } else if (rpcResponse.error) {
        console.error("RPC error:", rpcResponse.error);
      }
    } catch (err) {
      console.error("Scan failed:", err);
    }

    setScanning(false);
  }

  const vulnCounts = scanResult
    ? {
        critical: scanResult.vulnerabilities.filter(
          (v) => v.severity === "critical",
        ).length,
        high: scanResult.vulnerabilities.filter((v) => v.severity === "high")
          .length,
        medium: scanResult.vulnerabilities.filter(
          (v) => v.severity === "medium",
        ).length,
        low: scanResult.vulnerabilities.filter((v) => v.severity === "low")
          .length,
      }
    : null;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <ScanSearch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">
              VULNERABILITY SCAN
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide">
              Analyze MCP servers for security vulnerabilities
            </p>
          </div>
        </div>
      </div>

      {/* Scan Form */}
      <Card className="mb-6 border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter MCP server name..."
                className="w-full h-11 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono"
              />
              {servers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-10">
                  {servers.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setServerName(s);
                        setServers([]);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-secondary/50 first:rounded-t-lg last:rounded-b-lg font-mono"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setDeepScan(!deepScan)}
              className={`flex items-center gap-2 px-4 h-11 rounded-lg border text-sm transition-all ${
                deepScan
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Deep Scan</span>
            </button>

            <Button
              onClick={runScan}
              disabled={scanning || !serverName}
              className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  SCANNING...
                </>
              ) : (
                <>
                  <ScanSearch className="w-4 h-4 mr-2" />
                  SCAN
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scanning Animation */}
      {scanning && (
        <Card className="mb-6 border-primary/20 bg-card overflow-hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 shimmer" />
            <div className="relative flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
              <Shield className="w-10 h-10 text-primary animate-float" />
            </div>
            <p className="text-sm font-bold tracking-widest text-primary">
              ANALYZING {serverName.toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground mt-2 tracking-wide">
              {deepScan
                ? "Running deep LLM analysis..."
                : "Running static pattern analysis..."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {scanResult && !scanning && (
        <div className="space-y-6 animate-count-up">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Trust Score */}
            <Card className="border-border bg-card col-span-2 lg:col-span-1">
              <CardContent className="pt-6 text-center">
                <div className="relative inline-flex items-center justify-center w-24 h-24 mb-3">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#2A2A2A"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke={
                        scanResult.trustScore >= 70
                          ? "#22C55E"
                          : scanResult.trustScore >= 40
                            ? "#F97316"
                            : "#EF4444"
                      }
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${scanResult.trustScore * 2.64} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className={`text-2xl font-bold ${getGrade(scanResult.trustScore).class}`}
                    >
                      {scanResult.trustScore}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground tracking-wider">
                  TRUST SCORE
                </p>
                <p
                  className={`text-lg font-bold ${getGrade(scanResult.trustScore).class}`}
                >
                  Grade: {getGrade(scanResult.trustScore).letter}
                </p>
              </CardContent>
            </Card>

            {/* Vulnerability Counts */}
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-muted-foreground tracking-wider">
                    CRITICAL
                  </span>
                </div>
                <p className="text-3xl font-bold text-red-400">
                  {vulnCounts?.critical}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-muted-foreground tracking-wider">
                    HIGH
                  </span>
                </div>
                <p className="text-3xl font-bold text-orange-400">
                  {vulnCounts?.high}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-muted-foreground tracking-wider">
                    MEDIUM
                  </span>
                </div>
                <p className="text-3xl font-bold text-yellow-400">
                  {vulnCounts?.medium}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Server Info Bar */}
          <Card className="border-border bg-card">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-bold tracking-wider">
                    {scanResult.serverName}
                  </span>
                  <Badge variant="outline" className="text-xs tracking-wider">
                    {scanResult.toolCount} TOOLS
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {scanResult.vulnerabilities.length} vulnerabilities found
                  </span>
                  <span className="opacity-50">|</span>
                  <span>{new Date(scanResult.scannedAt).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vulnerability List */}
          <div>
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4">
              VULNERABILITIES
            </h2>
            <div className="space-y-2">
              {scanResult.vulnerabilities
                .sort(
                  (a, b) =>
                    severityConfig[a.severity].order -
                    severityConfig[b.severity].order,
                )
                .map((vuln, i) => {
                  const config = severityConfig[vuln.severity];
                  const Icon = config.icon;
                  const isExpanded = expandedVuln === i;

                  return (
                    <Card
                      key={i}
                      className={`border bg-card cursor-pointer transition-all hover:bg-secondary/30 ${
                        isExpanded ? "border-primary/30" : "border-border"
                      }`}
                      onClick={() => setExpandedVuln(isExpanded ? null : i)}
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
                            className={`text-[10px] tracking-widest uppercase px-2 py-0.5 ${config.color} border flex-shrink-0`}
                          >
                            {vuln.severity}
                          </Badge>
                          <span className="text-sm flex-1">
                            {vuln.description}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] tracking-wider text-muted-foreground border-border flex-shrink-0"
                          >
                            {vuln.tool}
                          </Badge>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 ml-7 pl-4 border-l-2 border-primary/20 space-y-3">
                            <div>
                              <p className="text-[10px] tracking-widest text-muted-foreground mb-1">
                                CATEGORY
                              </p>
                              <p className="text-sm">{vuln.category}</p>
                            </div>
                            <div>
                              <p className="text-[10px] tracking-widest text-muted-foreground mb-1">
                                RECOMMENDATION
                              </p>
                              <p className="text-sm text-guardian-green">
                                {vuln.recommendation}
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!scanResult && !scanning && (
        <Card className="border-border border-dashed bg-card/50">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/empty-scan.png" alt="" width="120" height="120" className="mb-6 opacity-60" />
            <h3 className="text-sm font-bold tracking-widest mb-2">
              NO SCAN RESULTS
            </h3>
            <p className="text-xs text-muted-foreground max-w-md tracking-wide">
              Enter an MCP server name above and click SCAN to analyze it for
              security vulnerabilities, prompt injection, data exfiltration
              risks, and more.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
