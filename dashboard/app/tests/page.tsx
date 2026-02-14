"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Shield,
  XCircle,
  AlertCircle,
  Play,
  Filter,
} from "lucide-react";
import { useState } from "react";

const GUARDIAN_URL =
  process.env.NEXT_PUBLIC_GUARDIAN_URL || "http://localhost:8080";

interface TestCase {
  tool: string;
  testType: string;
  input: unknown;
  expectedBehavior: string;
  actualResult: string;
  status: "pass" | "fail" | "error";
  issue?: string;
}

interface TestResult {
  serverName: string;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  results: TestCase[];
}

const testTypeLabels: Record<string, string> = {
  valid_input: "Valid Input",
  edge_cases: "Edge Cases",
  malformed_input: "Malformed Input",
  injection: "Injection",
  overflow: "Overflow",
};

const statusConfig = {
  pass: {
    color: "bg-guardian-green/10 text-guardian-green border-guardian-green/20",
    icon: CheckCircle2,
    label: "PASS",
  },
  fail: {
    color: "bg-guardian-red/10 text-guardian-red border-guardian-red/20",
    icon: XCircle,
    label: "FAIL",
  },
  error: {
    color: "bg-guardian-orange/10 text-guardian-orange border-guardian-orange/20",
    icon: AlertCircle,
    label: "ERROR",
  },
};

export default function TestsPage() {
  const [serverName, setServerName] = useState("malicious-demo");
  const [toolName, setToolName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "valid_input",
    "malformed_input",
    "injection",
  ]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [expandedTest, setExpandedTest] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }

  async function runTests() {
    setRunning(true);
    setResult(null);
    setExpandedTest(null);
    setFilterStatus(null);

    try {
      const jsonRpc = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "test_server",
          arguments: {
            serverName,
            ...(toolName ? { toolName } : {}),
            testTypes: selectedTypes,
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
      console.error("Tests failed:", err);
    }

    setRunning(false);
  }

  const filteredResults = result?.results.filter(
    (r) => !filterStatus || r.status === filterStatus
  );

  const passRate = result
    ? Math.round((result.passed / result.totalTests) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <FlaskConical className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">
              SECURITY TESTS
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide">
              Auto-generate and run security test cases against MCP tools
            </p>
          </div>
        </div>
      </div>

      {/* Test Config */}
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
            <div className="w-48">
              <label className="text-[10px] tracking-widest text-muted-foreground mb-2 block">
                TOOL (OPTIONAL)
              </label>
              <input
                type="text"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="All tools"
                className="w-full h-11 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono"
              />
            </div>
          </div>

          {/* Test Types */}
          <div>
            <label className="text-[10px] tracking-widest text-muted-foreground mb-2 block">
              TEST TYPES
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(testTypeLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleType(key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs tracking-wider transition-all ${
                    selectedTypes.includes(key)
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={runTests}
            disabled={running || !serverName || selectedTypes.length === 0}
            className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                RUNNING TESTS...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                RUN TESTS
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Running Animation */}
      {running && (
        <Card className="mb-6 border-primary/20 bg-card overflow-hidden">
          <CardContent className="py-12 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 shimmer" />
            <div className="relative flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
              <FlaskConical className="w-10 h-10 text-primary animate-float" />
            </div>
            <p className="text-sm font-bold tracking-widest text-primary">
              TESTING {serverName.toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground mt-2 tracking-wide">
              Generating and executing {selectedTypes.length} test types...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !running && (
        <div className="space-y-6 animate-count-up">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Pass Rate Gauge */}
            <Card className="border-border bg-card col-span-2 lg:col-span-1">
              <CardContent className="pt-6 text-center">
                <div className="relative inline-flex items-center justify-center w-24 h-24 mb-3">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#2A2A2A" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={passRate >= 70 ? "#22C55E" : passRate >= 40 ? "#F97316" : "#EF4444"}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${passRate * 2.64} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${passRate >= 70 ? "text-guardian-green" : passRate >= 40 ? "text-guardian-orange" : "text-guardian-red"}`}>
                      {passRate}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground tracking-wider">PASS RATE</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground tracking-wider">TOTAL</span>
                </div>
                <p className="text-3xl font-bold text-primary">{result.totalTests}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-guardian-green" />
                  <span className="text-xs text-muted-foreground tracking-wider">PASSED</span>
                </div>
                <p className="text-3xl font-bold text-guardian-green">{result.passed}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-4 h-4 text-guardian-red" />
                  <span className="text-xs text-muted-foreground tracking-wider">FAILED</span>
                </div>
                <p className="text-3xl font-bold text-guardian-red">{result.failed}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-guardian-orange" />
                  <span className="text-xs text-muted-foreground tracking-wider">ERRORS</span>
                </div>
                <p className="text-3xl font-bold text-guardian-orange">{result.errors}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground tracking-wider mr-2">FILTER:</span>
            {[null, "pass", "fail", "error"].map((status) => (
              <button
                key={status ?? "all"}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-lg border text-xs tracking-wider transition-all ${
                  filterStatus === status
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {status ? status.toUpperCase() : "ALL"}
              </button>
            ))}
          </div>

          {/* Test Results List */}
          <div>
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4">
              TEST RESULTS
            </h2>
            <div className="space-y-2">
              {filteredResults?.map((test, i) => {
                const config = statusConfig[test.status];
                const Icon = config.icon;
                const isExpanded = expandedTest === i;

                return (
                  <Card
                    key={i}
                    className={`border bg-card cursor-pointer transition-all hover:bg-secondary/30 ${
                      isExpanded ? "border-primary/30" : "border-border"
                    }`}
                    onClick={() => setExpandedTest(isExpanded ? null : i)}
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
                          {config.label}
                        </Badge>
                        <span className="text-sm flex-1 truncate">
                          {test.expectedBehavior}
                        </span>
                        <Badge variant="outline" className="text-[10px] tracking-wider text-muted-foreground border-border flex-shrink-0">
                          {test.tool}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] tracking-wider text-primary/60 border-primary/20 flex-shrink-0">
                          {testTypeLabels[test.testType] || test.testType}
                        </Badge>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 ml-7 pl-4 border-l-2 border-primary/20 space-y-3">
                          <div>
                            <p className="text-[10px] tracking-widest text-muted-foreground mb-1">INPUT</p>
                            <pre className="text-xs bg-secondary/50 rounded-lg p-3 overflow-x-auto">
                              {JSON.stringify(test.input, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] tracking-widest text-muted-foreground mb-1">EXPECTED</p>
                            <p className="text-sm">{test.expectedBehavior}</p>
                          </div>
                          <div>
                            <p className="text-[10px] tracking-widest text-muted-foreground mb-1">ACTUAL RESULT</p>
                            <p className="text-sm">{test.actualResult}</p>
                          </div>
                          {test.issue && (
                            <div>
                              <p className="text-[10px] tracking-widest text-guardian-red mb-1">SECURITY ISSUE</p>
                              <p className="text-sm text-guardian-red">{test.issue}</p>
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
      {!result && !running && (
        <Card className="border-border border-dashed bg-card/50">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-secondary border border-border">
              <FlaskConical className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-bold tracking-widest mb-2">NO TEST RESULTS</h3>
            <p className="text-xs text-muted-foreground max-w-md tracking-wide">
              Select test types and click RUN TESTS to auto-generate security test cases
              including injection attacks, malformed inputs, edge cases, and overflow tests.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
