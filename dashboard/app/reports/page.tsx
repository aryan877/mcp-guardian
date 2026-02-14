"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ClipboardList,
  Download,
  Loader2,
  ShieldAlert,
  Server,
  FileText,
  Lock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

const GUARDIAN_URL =
  process.env.NEXT_PUBLIC_GUARDIAN_URL || "http://localhost:8080";

interface AuditSummary {
  totalServers: number;
  totalTools: number;
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  averageTrustScore: number;
  policiesConfigured: number;
  policiesMissing: number;
}

interface AuditReportResult {
  generatedAt: string;
  summary: AuditSummary;
  report: string;
}

function getGrade(score: number): { letter: string; class: string } {
  if (score >= 95) return { letter: "A+", class: "text-guardian-green" };
  if (score >= 85) return { letter: "A", class: "text-guardian-green" };
  if (score >= 70) return { letter: "B", class: "text-primary" };
  if (score >= 55) return { letter: "C", class: "text-guardian-orange" };
  if (score >= 40) return { letter: "D", class: "text-guardian-orange" };
  return { letter: "F", class: "text-guardian-red" };
}

export default function ReportsPage() {
  const [serverName, setServerName] = useState("");
  const [format, setFormat] = useState<"markdown" | "json">("markdown");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditReportResult | null>(null);

  async function generateReport() {
    setLoading(true);
    setResult(null);

    try {
      const jsonRpc = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "audit_report",
          arguments: {
            ...(serverName ? { serverName } : {}),
            format,
            includeRecommendations: true,
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
        setResult(JSON.parse(rpcResponse.result.content[0].text));
      }
    } catch (err) {
      console.error("Report failed:", err);
    }

    setLoading(false);
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([result.report], {
      type: format === "markdown" ? "text/markdown" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guardian-audit-${new Date().toISOString().split("T")[0]}.${format === "markdown" ? "md" : "json"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grade = result ? getGrade(result.summary.averageTrustScore) : null;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">AUDIT REPORT</h1>
            <p className="text-xs text-muted-foreground tracking-wide">
              Generate comprehensive security audit reports across all servers
            </p>
          </div>
        </div>
      </div>

      {/* Config */}
      <Card className="mb-6 border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-[10px] tracking-widest text-muted-foreground mb-2 block">
                SERVER (LEAVE EMPTY FOR ALL)
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="All servers"
                className="w-full h-11 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] tracking-widest text-muted-foreground mb-2 block">
                FORMAT
              </label>
              <div className="flex gap-2">
                {(["markdown", "json"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-4 h-11 rounded-lg border text-xs tracking-wider transition-all ${
                      format === f
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-secondary border-border text-muted-foreground"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={generateReport}
              disabled={loading}
              className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  GENERATING...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  GENERATE REPORT
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <Card className="mb-6 border-primary/20 bg-card overflow-hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 shimmer" />
            <div className="relative flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
              <ClipboardList className="w-10 h-10 text-primary animate-float" />
            </div>
            <p className="text-sm font-bold tracking-widest text-primary">
              GENERATING AUDIT REPORT
            </p>
            <p className="text-xs text-muted-foreground mt-2 tracking-wide">
              Running full scan + trust score + monitor across all servers...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6 animate-count-up">
          {/* Executive Summary */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold tracking-widest text-muted-foreground">
                EXECUTIVE SUMMARY
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground tracking-wider">
                  {new Date(result.generatedAt).toLocaleString()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadReport}
                  className="h-8 text-xs tracking-wider"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  DOWNLOAD
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Trust Score */}
              <Card className="border-border bg-card col-span-2 lg:col-span-1">
                <CardContent className="pt-6 text-center">
                  <div className="relative inline-flex items-center justify-center w-24 h-24 mb-3">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#2A2A2A" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={result.summary.averageTrustScore >= 70 ? "#22C55E" : result.summary.averageTrustScore >= 40 ? "#F97316" : "#EF4444"}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${result.summary.averageTrustScore * 2.64} 264`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold ${grade?.class}`}>
                        {Math.round(result.summary.averageTrustScore)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground tracking-wider">AVG TRUST</p>
                  <p className={`text-lg font-bold ${grade?.class}`}>
                    {grade?.letter}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground tracking-wider">SERVERS</span>
                  </div>
                  <p className="text-3xl font-bold text-primary">{result.summary.totalServers}</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.summary.totalTools} tools</p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-guardian-red" />
                    <span className="text-xs text-muted-foreground tracking-wider">VULNS</span>
                  </div>
                  <p className="text-3xl font-bold text-guardian-red">{result.summary.totalVulnerabilities}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-guardian-red">{result.summary.criticalCount} crit</span>
                    <span className="text-[10px] text-guardian-orange">{result.summary.highCount} high</span>
                    <span className="text-[10px] text-yellow-400">{result.summary.mediumCount} med</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-guardian-green" />
                    <span className="text-xs text-muted-foreground tracking-wider">POLICIES</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-guardian-green" />
                    <span className="text-lg font-bold text-guardian-green">{result.summary.policiesConfigured}</span>
                  </div>
                  {result.summary.policiesMissing > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <XCircle className="w-3.5 h-3.5 text-guardian-red" />
                      <span className="text-[10px] text-guardian-red">{result.summary.policiesMissing} missing</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Vulnerability Severity Breakdown Bar */}
          <Card className="border-border bg-card">
            <CardContent className="py-5 px-6">
              <p className="text-[10px] tracking-widest text-muted-foreground mb-3">VULNERABILITY DISTRIBUTION</p>
              <div className="flex h-4 rounded-full overflow-hidden bg-secondary">
                {result.summary.criticalCount > 0 && (
                  <div
                    className="bg-guardian-red h-full"
                    style={{
                      width: `${(result.summary.criticalCount / result.summary.totalVulnerabilities) * 100}%`,
                    }}
                  />
                )}
                {result.summary.highCount > 0 && (
                  <div
                    className="bg-guardian-orange h-full"
                    style={{
                      width: `${(result.summary.highCount / result.summary.totalVulnerabilities) * 100}%`,
                    }}
                  />
                )}
                {result.summary.mediumCount > 0 && (
                  <div
                    className="bg-yellow-400 h-full"
                    style={{
                      width: `${(result.summary.mediumCount / result.summary.totalVulnerabilities) * 100}%`,
                    }}
                  />
                )}
                {result.summary.lowCount > 0 && (
                  <div
                    className="bg-guardian-blue h-full"
                    style={{
                      width: `${(result.summary.lowCount / result.summary.totalVulnerabilities) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-guardian-red" />
                  <span className="text-[10px] text-muted-foreground">Critical ({result.summary.criticalCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-guardian-orange" />
                  <span className="text-[10px] text-muted-foreground">High ({result.summary.highCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span className="text-[10px] text-muted-foreground">Medium ({result.summary.mediumCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-guardian-blue" />
                  <span className="text-[10px] text-muted-foreground">Low ({result.summary.lowCount})</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full Report */}
          <div>
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              FULL REPORT
            </h2>
            <Card className="border-border bg-card">
              <CardContent className="py-6">
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-xs bg-secondary/50 rounded-lg p-6 overflow-x-auto font-mono leading-relaxed max-h-[600px] overflow-y-auto">
                    {result.report}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && (
        <Card className="border-border border-dashed bg-card/50">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-secondary border border-border">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-bold tracking-widest mb-2">NO AUDIT REPORT</h3>
            <p className="text-xs text-muted-foreground max-w-md tracking-wide">
              Generate a comprehensive audit report combining vulnerability scans,
              trust scores, and monitoring data. Leave server empty to audit all
              installed MCP servers.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
