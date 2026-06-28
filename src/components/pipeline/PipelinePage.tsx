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
      <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8]">
        Loading pipeline…
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
    <div className="min-h-screen bg-[#f5e6c8] p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-950">Outreach pipeline</h1>
            <p className="text-sm text-amber-900/70">
              Status updates from Orange Slice sync back here automatically.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              Coverage board
            </Link>
            <Link
              href="/settings"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              Settings
            </Link>
            <UserButton />
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {Object.entries(byStatus).map(([status, count]) => (
            <span
              key={status}
              className="rounded-full border border-amber-300 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-950"
            >
              {OUTREACH_STATUS_LABELS[status as keyof typeof OUTREACH_STATUS_LABELS] ?? status}:{" "}
              {count}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-amber-300/70 bg-[#fff9f0] shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-amber-200 bg-amber-100/50 text-xs uppercase tracking-wide text-amber-800">
              <tr>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Gap</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-amber-900/60">
                    No outreach yet — pursue a lead on the coverage board.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-amber-100/80">
                    <td className="px-4 py-3 font-medium text-amber-950">
                      {row.address}
                      {row.neighborhood && (
                        <span className="block text-xs text-amber-800/60">{row.neighborhood}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.gapDollars != null ? formatCurrency(row.gapDollars) : "—"}
                    </td>
                    <td className="px-4 py-3">{row.matchScore ?? "—"}</td>
                    <td className="px-4 py-3">{row.agentName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold">
                        {OUTREACH_STATUS_LABELS[
                          row.status as keyof typeof OUTREACH_STATUS_LABELS
                        ] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-900/70">
                      {formatDate(row.lastActivityAt)}
                    </td>
                    <td className="px-4 py-3">
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
                            className="rounded border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-50"
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
