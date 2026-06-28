"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type SettingsPageProps = {
  orgId: Id<"organizations">;
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/70">
        {label}
      </p>
      <div className="mt-1 flex gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-[11px] text-amber-950">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function SettingsPage({ orgId }: SettingsPageProps) {
  const { userId } = useAuth();
  const settings = useQuery(
    api.organizations.getOrgSettings,
    userId ? { userId, orgId } : "skip",
  );
  const outreachConfig = useQuery(
    api.outreach.getOutreachConfig,
    userId ? { orgId, userId } : "skip",
  );
  const updateIntegrations = useMutation(api.organizations.updateOrgIntegrations);

  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetWebhookUrl, setSheetWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setSheetUrl(settings.sheetUrl ?? "");
    setSheetWebhookUrl(settings.sheetWebhookUrl ?? "");
  }, [settings]);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setSaved(false);
    try {
      await updateIntegrations({
        userId,
        orgId,
        sheetUrl,
        sheetWebhookUrl,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }, [orgId, sheetUrl, sheetWebhookUrl, updateIntegrations, userId]);

  if (!settings || !outreachConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8]">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5e6c8] p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-950">Agency settings</h1>
            <p className="text-sm text-amber-900/70">{settings.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              Coverage board
            </Link>
            <Link
              href="/pipeline"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              Pipeline
            </Link>
            <UserButton />
          </div>
        </header>

        <section className="rounded-2xl border border-amber-300/70 bg-[#fff9f0] p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">
            Orange Slice setup (5 min)
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-amber-900/85">
            <li>
              Create a new Orange Slice spreadsheet (or reuse your insurance sheet).
            </li>
            <li>
              Paste{" "}
              <code className="rounded bg-white px-1">docs/ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt</code>{" "}
              into Orange Slice chat — replace{" "}
              <code className="rounded bg-white px-1">YOUR_OUTREACH_WEBHOOK_SECRET</code> with your
              Convex secret.
            </li>
            <li>
              In the sheet, add an <strong>Import from webhook</strong> column and copy its URL.
            </li>
            <li>Paste that webhook URL below and save.</li>
            <li>
              Pursue a lead on the map → row appears in sheet → run Find contact → Send touch 1.
            </li>
          </ol>

          {outreachConfig.importApiUrl && (
            <div className="mt-4 space-y-3 border-t border-amber-200/60 pt-4">
              <CopyField label="Import API (fallback)" value={outreachConfig.importApiUrl} />
              <CopyField label="Status webhook" value={outreachConfig.statusWebhookUrl ?? ""} />
              <p className="text-[10px] text-amber-800/60">
                Header on all Orange Slice HTTP calls:{" "}
                <code>Authorization: Bearer &lt;OUTREACH_WEBHOOK_SECRET&gt;</code>
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-300/70 bg-[#fff9f0] p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">
            Team invite
          </h2>
          <p className="mt-2 text-sm text-amber-900/80">
            Share this code with agents:{" "}
            <code className="rounded bg-white px-2 py-1 font-mono text-base font-bold">
              {settings.inviteCode}
            </code>
          </p>
          <p className="mt-1 text-xs text-amber-800/60">
            {settings.memberCount} member{settings.memberCount === 1 ? "" : "s"}
          </p>
        </section>

        <section className="rounded-2xl border border-amber-300/70 bg-[#fff9f0] p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">
            Orange Slice integration
          </h2>

          <label className="block text-xs font-semibold text-amber-900">
            Sheet URL
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="https://www.orangeslice.ai/spreadsheets/..."
            />
          </label>

          <label className="block text-xs font-semibold text-amber-900">
            Import webhook URL
            <input
              value={sheetWebhookUrl}
              onChange={(e) => setSheetWebhookUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </label>

          <p className="text-xs text-amber-800/70">
            Status:{" "}
            {outreachConfig.sheetWebhookConfigured || settings.sheetWebhookUrl
              ? "Webhook configured — Pursue will auto-push rows"
              : "Webhook missing — Pursue queues rows; run Import from API in Orange Slice"}
          </p>

          {error && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800">{error}</p>
          )}
          {saved && (
            <p className="rounded-lg bg-green-100 px-3 py-2 text-xs text-green-800">Saved.</p>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white"
          >
            Save Orange Slice settings
          </button>
        </section>

        <section className="rounded-2xl border border-amber-300/70 bg-[#fff9f0] p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">Slack</h2>
          <p className="mt-2 text-xs text-amber-900/70">
            {settings.slackConnected
              ? `Connected to channel ${settings.slackChannelId}`
              : "Connect Slack to post pursue / reply / meeting notifications."}
          </p>
          <a
            href={`/api/slack/oauth?orgId=${orgId}`}
            className="mt-3 inline-block rounded-xl bg-[#4A154B] px-4 py-2 text-sm font-bold text-white"
          >
            {settings.slackConnected ? "Reconnect Slack" : "Connect Slack"}
          </a>
        </section>
      </div>
    </div>
  );
}
