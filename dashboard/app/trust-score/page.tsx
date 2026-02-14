"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Gauge,
  Loader2,
  Shield,
  FileText,
  Lock,
  Eye,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { useState } from "react";

const GUARDIAN_URL =
  process.env.NEXT_PUBLIC_GUARDIAN_URL || "http://localhost:8080";

interface TrustScoreResult {
  serverName: string;
  overallScore: number;
  breakdown: {
    toolDescriptionSafety: number;
    inputValidation: number;
    permissionScope: number;
    dataHandling: number;
    errorHandling: number;
    policyCompliance: number;
  };
  grade: string;
  recommendations: string[];
}

const dimensionConfig = [
  { key: "toolDescriptionSafety", label: "Description Safety", weight: "25%", icon: FileText, desc: "Are tool descriptions free from prompt injection?" },
  { key: "inputValidation", label: "Input Validation", weight: "20%", icon: Shield, desc: "Do tools validate and sanitize inputs?" },
  { key: "permissionScope", label: "Permission Scope", weight: "20%", icon: Lock, desc: "Are permissions minimal and well-scoped?" },
  { key: "dataHandling", label: "Data Handling", weight: "15%", icon: Eye, desc: "Is sensitive data handled safely?" },
  { key: "errorHandling", label: "Error Handling", weight: "10%", icon: AlertCircle, desc: "Are errors handled without leaking info?" },
  { key: "policyCompliance", label: "Policy Compliance", weight: "10%", icon: CheckCircle2, desc: "Are Archestra policies configured?" },
];

function getGrade(score: number): { letter: string; class: string } {
  if (score >= 95) return { letter: "A+", class: "text-guardian-green" };
  if (score >= 85) return { letter: "A", class: "text-guardian-green" };
  if (score >= 70) return { letter: "B", class: "text-primary" };
  if (score >= 55) return { letter: "C", class: "text-guardian-orange" };
  if (score >= 40) return { letter: "D", class: "text-guardian-orange" };
  return { letter: "F", class: "text-guardian-red" };
}

function getBarColor(score: number): string {
  if (score >= 70) return "bg-guardian-green";
  if (score >= 40) return "bg-guardian-orange";
  return "bg-guardian-red";
}

export default function TrustScorePage() {
  const [serverName, setServerName] = useState("malicious-demo");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrustScoreResult | null>(null);

  async function fetchScore() {
    setLoading(true);
    setResult(null);

    try {
      const jsonRpc = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "trust_score",
          arguments: { serverName },
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
      console.error("Trust score failed:", err);
    }

    setLoading(false);
  }

  const grade = result ? getGrade(result.overallScore) : null;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <Gauge className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">TRUST SCORE</h1>
            <p className="text-xs text-muted-foreground tracking-wide">
              6-dimension security scoring with weighted analysis
            </p>
          </div>
        </div>
      </div>

      {/* Input */}
      <Card className="mb-6 border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter MCP server name..."
                className="w-full h-11 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono"
              />
            </div>
            <Button
              onClick={fetchScore}
              disabled={loading || !serverName}
              className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  SCORING...
                </>
              ) : (
                <>
                  <Gauge className="w-4 h-4 mr-2" />
                  CALCULATE
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading Animation */}
      {loading && (
        <Card className="mb-6 border-primary/20 bg-card overflow-hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 shimmer" />
            <div className="relative flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
              <Gauge className="w-10 h-10 text-primary animate-float" />
            </div>
            <p className="text-sm font-bold tracking-widest text-primary">
              CALCULATING TRUST SCORE
            </p>
            <p className="text-xs text-muted-foreground mt-2 tracking-wide">
              Analyzing 6 security dimensions...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6 animate-count-up">
          {/* Big Score Display */}
          <Card className="border-border bg-card">
            <CardContent className="py-8">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Circular Gauge */}
                <div className="relative inline-flex items-center justify-center w-40 h-40">
                  <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#2A2A2A" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={result.overallScore >= 70 ? "#22C55E" : result.overallScore >= 40 ? "#F97316" : "#EF4444"}
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${result.overallScore * 2.64} 264`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${grade?.class}`}>
                      {result.overallScore}
                    </span>
                    <span className="text-xs text-muted-foreground tracking-wider mt-1">/ 100</span>
                  </div>
                </div>

                {/* Grade + Server Info */}
                <div className="text-center lg:text-left">
                  <div className="flex items-center gap-3 mb-2 justify-center lg:justify-start">
                    <span className={`text-6xl font-bold ${grade?.class}`}>
                      {result.grade}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground tracking-wider">
                    {result.serverName}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1 tracking-wide">
                    {result.overallScore >= 70
                      ? "This server meets security standards"
                      : result.overallScore >= 40
                        ? "This server needs security improvements"
                        : "This server has critical security issues"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 6-Dimension Breakdown */}
          <div>
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4">
              DIMENSION BREAKDOWN
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {dimensionConfig.map((dim) => {
                const score = result.breakdown[dim.key as keyof typeof result.breakdown];
                const Icon = dim.icon;
                return (
                  <Card key={dim.key} className="border-border bg-card">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-bold tracking-wider">{dim.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] tracking-wider text-muted-foreground border-border">
                            {dim.weight}
                          </Badge>
                          <span className={`text-sm font-bold ${getGrade(score).class}`}>
                            {score}
                          </span>
                        </div>
                      </div>
                      {/* Score Bar */}
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getBarColor(score)}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{dim.desc}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                RECOMMENDATIONS
              </h2>
              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <Card key={i} className="border-border bg-card">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                        </div>
                        <p className="text-sm">{rec}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && (
        <Card className="border-border border-dashed bg-card/50">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-secondary border border-border">
              <Gauge className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-bold tracking-widest mb-2">NO TRUST SCORE</h3>
            <p className="text-xs text-muted-foreground max-w-md tracking-wide">
              Enter a server name and click CALCULATE to get a comprehensive 6-dimension
              trust score covering description safety, input validation, permissions, data handling,
              error handling, and policy compliance.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
