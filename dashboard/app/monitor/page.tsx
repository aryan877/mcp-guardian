"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Radio,
  Server,
  ShieldAlert,
  Info,
  BarChart3,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

const GUARDIAN_URL =
  process.env.NEXT_PUBLIC_GUARDIAN_URL || "http://localhost:8080";

interface Alert {
  type: string;
  severity: "critical" | "warning" | "info";
  description: string;
  timestamp: string;
}

interface ServerMonitor {
  serverName: string;
  totalCalls: number;
  errorCount: number;
  errorRate: number;
  topTools: { name: string; calls: number }[];
  alerts: Alert[];
}

interface MonitorResult {
  timeRange: string;
  servers: ServerMonitor[];
}

const alertSeverityConfig = {
  critical: {
    color: "bg-guardian-red/10 text-guardian-red border-guardian-red/20",
    icon: ShieldAlert,
  },
  warning: {
    color: "bg-guardian-orange/10 text-guardian-orange border-guardian-orange/20",
    icon: AlertTriangle,
  },
  info: {
    color: "bg-guardian-blue/10 text-guardian-blue border-guardian-blue/20",
    icon: Info,
  },
};

export default function MonitorPage() {
  const [serverName, setServerName] = useState("");
  const [lookback, setLookback] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MonitorResult | null>(null);
  const [expandedServer, setExpandedServer] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchMonitor() {
    setLoading(true);

    try {
      const jsonRpc = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "monitor",
          arguments: {
            ...(serverName ? { serverName } : {}),
            lookbackMinutes: lookback,
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
      console.error("Monitor failed:", err);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMonitor, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  const totalAlerts = result?.servers.reduce((sum, s) => sum + s.alerts.length, 0) ?? 0;
  const totalCalls = result?.servers.reduce((sum, s) => sum + s.totalCalls, 0) ?? 0;
  const totalErrors = result?.servers.reduce((sum, s) => sum + s.errorCount, 0) ?? 0;
  const criticalAlerts = result?.servers.reduce(
    (sum, s) => sum + s.alerts.filter((a) => a.severity === "critical").length, 0
  ) ?? 0;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">LIVE MONITOR</h1>
            <p className="text-xs text-muted-foreground tracking-wide">
              Real-time anomaly detection and call history analysis
            </p>
          </div>
          {autoRefresh && (
            <Badge variant="outline" className="ml-auto text-[10px] tracking-wider text-guardian-green border-guardian-green/20 animate-pulse">
              <Radio className="w-3 h-3 mr-1" />
              LIVE
            </Badge>
          )}
        </div>
      </div>

      {/* Controls */}
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
            <div className="w-48">
              <label className="text-[10px] tracking-widest text-muted-foreground mb-2 block">
                LOOKBACK
              </label>
              <div className="flex gap-2">
                {[15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setLookback(mins)}
                    className={`flex-1 h-11 rounded-lg border text-xs tracking-wider transition-all ${
                      lookback === mins
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-secondary border-border text-muted-foreground"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`h-11 px-4 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                autoRefresh
                  ? "bg-guardian-green/10 border-guardian-green/30 text-guardian-green"
                  : "bg-secondary border-border text-muted-foreground"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? "animate-spin" : ""}`} />
              Auto
            </button>

            <Button
              onClick={fetchMonitor}
              disabled={loading}
              className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  FETCHING...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  MONITOR
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && !result && (
        <Card className="mb-6 border-primary/20 bg-card overflow-hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 shimmer" />
            <div className="relative flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
              <Activity className="w-10 h-10 text-primary animate-float" />
            </div>
            <p className="text-sm font-bold tracking-widest text-primary">
              SCANNING TOOL CALLS
            </p>
            <p className="text-xs text-muted-foreground mt-2 tracking-wide">
              Analyzing last {lookback} minutes of activity...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-count-up">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground tracking-wider">SERVERS</span>
                </div>
                <p className="text-3xl font-bold text-primary">{result.servers.length}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-guardian-blue" />
                  <span className="text-xs text-muted-foreground tracking-wider">TOTAL CALLS</span>
                </div>
                <p className="text-3xl font-bold text-guardian-blue">{totalCalls}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-guardian-red" />
                  <span className="text-xs text-muted-foreground tracking-wider">ERRORS</span>
                </div>
                <p className="text-3xl font-bold text-guardian-red">{totalErrors}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-guardian-orange" />
                  <span className="text-xs text-muted-foreground tracking-wider">ALERTS</span>
                </div>
                <p className="text-3xl font-bold text-guardian-orange">{totalAlerts}</p>
                {criticalAlerts > 0 && (
                  <p className="text-[10px] text-guardian-red mt-1">{criticalAlerts} critical</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="tracking-wider">Time range: {result.timeRange}</span>
          </div>

          {/* Per-Server Breakdown */}
          <div>
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4">
              SERVER ACTIVITY
            </h2>
            <div className="space-y-2">
              {result.servers.map((server, i) => {
                const isExpanded = expandedServer === i;
                const errorRatePct = Math.round(server.errorRate * 100);

                return (
                  <Card
                    key={i}
                    className={`border bg-card cursor-pointer transition-all hover:bg-secondary/30 ${
                      isExpanded ? "border-primary/30" : "border-border"
                    }`}
                    onClick={() => setExpandedServer(isExpanded ? null : i)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <Server className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-bold tracking-wider flex-1">
                          {server.serverName}
                        </span>
                        <Badge variant="outline" className="text-[10px] tracking-wider text-muted-foreground border-border">
                          {server.totalCalls} calls
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] tracking-wider ${
                            errorRatePct > 10
                              ? "text-guardian-red border-guardian-red/20"
                              : "text-guardian-green border-guardian-green/20"
                          }`}
                        >
                          {errorRatePct}% errors
                        </Badge>
                        {server.alerts.length > 0 && (
                          <Badge variant="outline" className="text-[10px] tracking-wider text-guardian-orange border-guardian-orange/20">
                            {server.alerts.length} alerts
                          </Badge>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 ml-7 space-y-4">
                          {/* Top Tools */}
                          {server.topTools.length > 0 && (
                            <div>
                              <p className="text-[10px] tracking-widest text-muted-foreground mb-2">
                                TOP TOOLS
                              </p>
                              <div className="space-y-2">
                                {server.topTools.map((tool, j) => {
                                  const maxCalls = Math.max(...server.topTools.map((t) => t.calls));
                                  const pct = maxCalls > 0 ? (tool.calls / maxCalls) * 100 : 0;
                                  return (
                                    <div key={j} className="flex items-center gap-3">
                                      <span className="text-xs font-mono w-36 truncate">{tool.name}</span>
                                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary rounded-full"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground w-12 text-right">
                                        {tool.calls}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Alerts */}
                          {server.alerts.length > 0 && (
                            <div>
                              <p className="text-[10px] tracking-widest text-muted-foreground mb-2">
                                ALERTS
                              </p>
                              <div className="space-y-2">
                                {server.alerts.map((alert, j) => {
                                  const config = alertSeverityConfig[alert.severity];
                                  const AlertIcon = config.icon;
                                  return (
                                    <div
                                      key={j}
                                      className={`flex items-start gap-3 p-3 rounded-lg border ${config.color}`}
                                    >
                                      <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-xs">{alert.description}</p>
                                        <p className="text-[10px] opacity-60 mt-1">
                                          {new Date(alert.timestamp).toLocaleString()}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] tracking-widest ${config.color}`}
                                      >
                                        {alert.severity.toUpperCase()}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
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
      {!result && !loading && (
        <Card className="border-border border-dashed bg-card/50">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-secondary border border-border">
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-bold tracking-widest mb-2">NO MONITOR DATA</h3>
            <p className="text-xs text-muted-foreground max-w-md tracking-wide">
              Click MONITOR to fetch real-time tool call data from Archestra.
              Guardian will analyze for anomalies, high error rates, unusual volumes,
              and suspicious input patterns.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
