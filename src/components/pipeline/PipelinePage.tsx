"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { OUTREACH_STATUS_LABELS } from "@/types/lead";

type PipelinePageProps = {
  orgId: Id<"organizations">;
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PipelinePage({ orgId }: PipelinePageProps) {
  const { userId } = useAuth();
  const rows = useQuery(
    api.outreach.listOrgOutreach,
    userId ? { userId, orgId } : "skip",
  );
  const updateStatus = useMutation(api.outreach.updateOutreachStatus);

  if (rows === undefined) {
    return (
      <div className="western-page-shell flex min-h-screen items-center justify-center">
        <p className="western-title">Loading pipeline…</p>
      </div>
    );
  }

  const byStatus = rows.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="western-page-shell">
      <div className="western-page-inner mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="western-title text-2xl">Outreach pipeline</h1>
            <p className="western-body mt-1">
              Status updates from Orange Slice sync back here automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="western-btn western-btn-ghost western-btn-sm">
              Coverage board
            </Link>
            <Link href="/settings" className="western-btn western-btn-ghost western-btn-sm">
              Settings
            </Link>
            <UserButton />
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {Object.entries(byStatus).map(([status, count]) => (
            <span key={status} className="western-chip">
              {OUTREACH_STATUS_LABELS[status as keyof typeof OUTREACH_STATUS_LABELS] ?? status}:{" "}
              {count}
            </span>
          ))}
        </div>

        <div className="western-table-wrap">
          <table className="western-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Gap</th>
                <th>Score</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Last activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="western-body py-8 text-center">
                    No outreach yet — pursue a lead on the coverage board.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-[var(--foreground)]">
                      {row.address}
                      {row.neighborhood && (
                        <span className="western-body block text-xs">{row.neighborhood}</span>
                      )}
                    </td>
                    <td className="western-body">
                      {row.gapDollars != null ? formatCurrency(row.gapDollars) : "—"}
                    </td>
                    <td className="western-body">{row.matchScore ?? "—"}</td>
                    <td className="western-body">{row.agentName}</td>
                    <td>
                      <span className="western-chip">
                        {OUTREACH_STATUS_LABELS[
                          row.status as keyof typeof OUTREACH_STATUS_LABELS
                        ] ?? row.status}
                      </span>
                    </td>
                    <td className="western-body text-xs">{formatDate(row.lastActivityAt)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(["replied", "meeting", "won", "lost"] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() =>
                              userId &&
                              void updateStatus({
                                userId,
                                orgId,
                                outreachId: row.id,
                                status,
                              })
                            }
                            className="western-btn western-btn-ghost western-btn-sm px-2 py-0.5 normal-case"
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
