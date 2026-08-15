"use client";

import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:3001/api";

type GenState =
  | "DRAFT"
  | "INITIALIZING"
  | "ARCHITECTING"
  | "PLANNING"
  | "GENERATING_CHAPTERS"
  | "GENERATING_SCENES"
  | "GENERATING_PROSE"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED";

interface GenStatus {
  novelId: string;
  state: GenState;
  autoContinue: boolean;
  targetChapters: number | null;
  completedChapters: number;
  progressPercent: number;
  activeJobs: number;
  queuedJobs: number;
  failedJobs: number;
  retryPendingJobs: number;
  currentStage: string | null;
  budget: {
    maxGenerationCostUsd?: number;
    estimatedTotalCostUsd: number;
    totalTokens: number;
    remainingBudgetUsd?: number;
  };
  correlationId: string | null;
  blockers: string[];
}

interface GenProgress {
  targetChapters: number | null;
  completedChapters: number;
  plannedChapters: number;
  scenePlannedChapters: number;
  proseCompletedChapters: number;
  currentWindow: { start: number; end: number } | null;
  percent: number;
}

// ── colours per state ──────────────────────────────────────────────
const STATE_COLOR: Record<string, string> = {
  DRAFT: "#94a3b8",
  INITIALIZING: "#60a5fa",
  ARCHITECTING: "#a78bfa",
  PLANNING: "#f59e0b",
  GENERATING_CHAPTERS: "#34d399",
  GENERATING_SCENES: "#22d3ee",
  GENERATING_PROSE: "#818cf8",
  PAUSED: "#fbbf24",
  COMPLETED: "#10b981",
  FAILED: "#f87171",
  BLOCKED: "#fb923c",
};

// ── progress bar ────────────────────────────────────────────────────
function ProgressBar({ value, color = "#818cf8" }: { value: number; color?: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 8, overflow: "hidden", height: 14, width: "100%" }}>
      <div
        style={{
          width: `${Math.min(100, value)}%`,
          height: "100%",
          background: color,
          borderRadius: 8,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

// ── stat badge ─────────────────────────────────────────────────────
function Stat({ label, value, color = "#94a3b8" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 16px", background: "#1e293b", borderRadius: 12 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── control button ─────────────────────────────────────────────────
function Btn({
  label,
  onClick,
  color = "#6366f1",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 20px",
        background: disabled ? "#334155" : color,
        color: disabled ? "#64748b" : "#fff",
        border: "none",
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.2s",
      }}
    >
      {label}
    </button>
  );
}

interface Props {
  novelId: string;
}

export default function NovelGenerationDashboard({ novelId }: Props) {
  const [status, setStatus] = useState<GenStatus | null>(null);
  const [progress, setProgress] = useState<GenProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`${API}/novels/${novelId}/generation/status`),
        fetch(`${API}/novels/${novelId}/generation/progress`),
      ]);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.success) setStatus(sData.data);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.success) setProgress(pData.data);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [novelId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const call = async (endpoint: string, method = "POST", body?: any) => {
    setLoading(true);
    try {
      await fetch(`${API}/novels/${novelId}/generation/${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const state = status?.state ?? "DRAFT";
  const stateColor = STATE_COLOR[state] ?? "#94a3b8";
  const isActive = ["ARCHITECTING", "PLANNING", "GENERATING_CHAPTERS", "GENERATING_SCENES", "GENERATING_PROSE"].includes(state);
  const isPaused = state === "PAUSED";
  const isCompleted = state === "COMPLETED";
  const isBlocked = state === "BLOCKED" || state === "FAILED";

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: 20,
        padding: 32,
        marginTop: 40,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#e2e8f0",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
            ⚙ Autonomous Generation
          </h2>
          {status?.correlationId && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>
              Run: {status.correlationId.slice(0, 24)}…
            </div>
          )}
        </div>
        <span
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            background: `${stateColor}22`,
            color: stateColor,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 1,
          }}
        >
          {state}
        </span>
      </div>

      {/* Stage + progress */}
      {status && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              Stage: <strong style={{ color: "#e2e8f0" }}>{status.currentStage ?? "—"}</strong>
            </span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              {status.completedChapters} / {status.targetChapters ?? "∞"} chapters (
              <strong style={{ color: stateColor }}>{status.progressPercent}%</strong>)
            </span>
          </div>
          <ProgressBar value={status.progressPercent} color={stateColor} />
        </div>
      )}

      {/* Chapter-level progress */}
      {progress && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, fontWeight: 700, letterSpacing: 0.5 }}>
            CHAPTER PIPELINE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Blueprinted</div>
              <ProgressBar
                value={progress.targetChapters ? (progress.plannedChapters / progress.targetChapters) * 100 : 0}
                color="#f59e0b"
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{progress.plannedChapters}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Scene Planned</div>
              <ProgressBar
                value={progress.targetChapters ? (progress.scenePlannedChapters / progress.targetChapters) * 100 : 0}
                color="#22d3ee"
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{progress.scenePlannedChapters}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Prose Complete</div>
              <ProgressBar
                value={progress.targetChapters ? (progress.proseCompletedChapters / progress.targetChapters) * 100 : 0}
                color="#10b981"
              />
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{progress.proseCompletedChapters}</div>
            </div>
          </div>
          {progress.currentWindow && (
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              Current window: chapters {progress.currentWindow.start}–{progress.currentWindow.end}
            </div>
          )}
        </div>
      )}

      {/* Job stats */}
      {status && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            marginBottom: 28,
          }}
        >
          <Stat label="ACTIVE" value={status.activeJobs} color="#818cf8" />
          <Stat label="QUEUED" value={status.queuedJobs} color="#60a5fa" />
          <Stat label="FAILED" value={status.failedJobs} color="#f87171" />
          <Stat label="RETRY" value={status.retryPendingJobs} color="#fbbf24" />
        </div>
      )}

      {/* Usage / budget */}
      {status?.budget && (
        <div
          style={{
            background: "#0f172a",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 28,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "#64748b" }}>TOKENS USED</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>
              {(status.budget.totalTokens / 1000).toFixed(1)}K
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b" }}>ESTIMATED COST</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>
              ${status.budget.estimatedTotalCostUsd.toFixed(4)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b" }}>BUDGET REMAINING</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>
              {status.budget.remainingBudgetUsd !== undefined
                ? `$${status.budget.remainingBudgetUsd.toFixed(2)}`
                : "∞"}
            </div>
          </div>
        </div>
      )}

      {/* Blockers */}
      {status?.blockers && status.blockers.length > 0 && (
        <div
          style={{
            background: "#431407",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 24,
            borderLeft: "4px solid #f87171",
          }}
        >
          <div style={{ fontSize: 12, color: "#f87171", fontWeight: 700, marginBottom: 6 }}>⚠ BLOCKERS</div>
          {status.blockers.map((b) => (
            <div key={b} style={{ fontSize: 12, color: "#fca5a5" }}>
              {b}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, padding: "8px 12px", background: "#1e1010", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Btn
          label="▶ START"
          onClick={() => call("start", "POST", { autoContinue: true })}
          color="#6366f1"
          disabled={loading || isCompleted}
        />
        <Btn
          label="⏸ PAUSE"
          onClick={() => call("pause")}
          color="#f59e0b"
          disabled={loading || isPaused || isCompleted || state === "DRAFT"}
        />
        <Btn
          label="▶▶ RESUME"
          onClick={() => call("resume")}
          color="#10b981"
          disabled={loading || !isPaused}
        />
        <Btn
          label="⬛ CANCEL"
          onClick={() => call("cancel")}
          color="#ef4444"
          disabled={loading || isCompleted || state === "DRAFT"}
        />
        <Btn
          label="⚡ ADVANCE"
          onClick={() => call("advance")}
          color="#8b5cf6"
          disabled={loading || isCompleted}
        />
        <Btn
          label="↺ RETRY FAILED"
          onClick={() => call("retry-failed")}
          color="#ec4899"
          disabled={loading || !status?.failedJobs}
        />
      </div>

      <div style={{ fontSize: 11, color: "#334155", marginTop: 16 }}>
        Auto-refreshes every 5 s · autoContinue:{" "}
        <strong style={{ color: status?.autoContinue ? "#10b981" : "#64748b" }}>
          {status?.autoContinue ? "ON" : "OFF"}
        </strong>
      </div>
    </div>
  );
}
