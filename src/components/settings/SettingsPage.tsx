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
      <p className="western-label">{label}</p>
      <div className="mt-1 flex gap-2">
        <code className="western-code flex-1 overflow-x-auto py-1.5">{value}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="western-btn western-btn-ghost western-btn-sm shrink-0"
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
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setSheetUrl(settings.sheetUrl ?? "");
    setSheetWebhookUrl(settings.sheetWebhookUrl ?? "");
    setSlackWebhookUrl(settings.slackWebhookUrl ?? "");
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
        slackWebhookUrl: slackWebhookUrl.trim() || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }, [orgId, sheetUrl, sheetWebhookUrl, slackWebhookUrl, updateIntegrations, userId]);

  if (!settings || !outreachConfig) {
    return (
      <div className="western-page-shell flex min-h-screen items-center justify-center">
        <p className="western-title">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="western-page-shell">
      <div className="western-page-inner mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="western-title text-2xl">Agency settings</h1>
            <p className="western-body mt-1">{settings.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="western-btn western-btn-ghost western-btn-sm">
              Coverage board
            </Link>
            <Link href="/pipeline" className="western-btn western-btn-ghost western-btn-sm">
              Pipeline
            </Link>
            <UserButton />
          </div>
        </header>

        <section className="western-panel p-5">
          <h2 className="western-label">Orange Slice setup (5 min)</h2>
          <ol className="western-body mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed">
            <li>Create a new Orange Slice spreadsheet (or reuse your insurance sheet).</li>
            <li>
              Paste{" "}
              <code className="western-code">docs/ORANGE_SLICE_INSURANCE_CHAT_PROMPT.txt</code> into
              Orange Slice chat — replace{" "}
              <code className="western-code">YOUR_OUTREACH_WEBHOOK_SECRET</code> with your Convex
              secret.
            </li>
            <li>In the sheet, add an <strong>Import from webhook</strong> column and copy its URL.</li>
            <li>Paste that webhook URL below and save.</li>
            <li>Pursue a lead on the map → row appears in sheet → run Find contact → Send touch 1.</li>
          </ol>

          {outreachConfig.importApiUrl && (
            <div className="mt-4 space-y-3 border-t border-[rgba(166,124,82,0.45)] pt-4">
              <CopyField label="Import API (fallback)" value={outreachConfig.importApiUrl} />
              <CopyField label="Status webhook" value={outreachConfig.statusWebhookUrl ?? ""} />
              <p className="western-body text-[10px]">
                Header on all Orange Slice HTTP calls:{" "}
                <code className="western-code">Authorization: Bearer &lt;OUTREACH_WEBHOOK_SECRET&gt;</code>
              </p>
            </div>
          )}
        </section>

        <section className="western-panel p-5">
          <h2 className="western-label">Team invite</h2>
          <p className="western-body mt-2 text-sm">
            Share this code with agents:{" "}
            <code className="western-code text-base font-bold">{settings.inviteCode}</code>
          </p>
          <p className="western-body mt-1 text-xs">
            {settings.memberCount} member{settings.memberCount === 1 ? "" : "s"}
          </p>
        </section>

        <section className="western-panel space-y-4 p-5">
          <h2 className="western-label">Orange Slice integration</h2>

          <label className="block">
            <span className="western-label">Sheet URL</span>
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="western-input mt-1"
              placeholder="https://www.orangeslice.ai/spreadsheets/..."
            />
          </label>

          <label className="block">
            <span className="western-label">Import webhook URL</span>
            <input
              value={sheetWebhookUrl}
              onChange={(e) => setSheetWebhookUrl(e.target.value)}
              className="western-input mt-1"
              placeholder="https://..."
            />
          </label>

          <p className="western-body text-xs">
            Status:{" "}
            {outreachConfig.sheetWebhookConfigured || settings.sheetWebhookUrl
              ? "Webhook configured — Pursue will auto-push rows"
              : "Webhook missing — Pursue queues rows; run Import from API in Orange Slice"}
          </p>

          {error && <p className="western-error">{error}</p>}
          {saved && (
            <p className="western-card border-green-700 bg-green-50 text-xs text-green-900">
              Saved.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            className="western-btn western-btn-primary px-4 py-2"
          >
            Save Orange Slice settings
          </button>
        </section>

        <section className="western-panel p-5 space-y-4">
          <h2 className="western-label">Slack alerts (2 min)</h2>
          <ol className="western-body mt-1 list-decimal space-y-2 pl-5 text-xs leading-relaxed">
            <li>
              In Slack, open your alerts channel → <strong>Integrations</strong> →{" "}
              <strong>Incoming Webhooks</strong> → Add to Slack.
            </li>
            <li>Copy the webhook URL (starts with <code className="western-code">https://hooks.slack.com/</code>).</li>
            <li>Paste it below and save.</li>
          </ol>
          <p className="western-body text-xs leading-relaxed">
            HouseholdIQ will ping that channel when you pursue a lead, when Orange Slice finds
            contact info, and when pipeline status changes sync back from the sheet.
          </p>
          <p className="western-body text-xs">
            {settings.slackConnected
              ? "Slack alerts active — pursue a lead to test."
              : "Not configured — add an incoming webhook below."}
          </p>

          <label className="block">
            <span className="western-label">Slack incoming webhook URL</span>
            <input
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              className="western-input mt-1 font-mono text-xs"
              placeholder="https://hooks.slack.com/services/..."
              type="url"
              autoComplete="off"
            />
          </label>
          <p className="western-body text-[10px]">
            Optional: also connect Orange Slice to Slack inside{" "}
            <a
              href="https://www.orangeslice.ai"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              orangeslice.ai
            </a>{" "}
            for native sheet-side notifications from the Orange Slice bot.
          </p>

          <button
            type="button"
            onClick={() => void handleSave()}
            className="western-btn western-btn-primary px-4 py-2"
          >
            Save Slack webhook
          </button>
        </section>
      </div>
    </div>
  );
}
