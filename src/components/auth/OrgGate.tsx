"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type OrgGateProps = {
  children: (ctx: {
    userId: string;
    orgId: Id<"organizations">;
    role: "admin" | "member";
  }) => React.ReactNode;
};

export function OrgGate({ children }: OrgGateProps) {
  const { userId, isLoaded } = useAuth();
  const membership = useQuery(
    api.organizations.getMyMembership,
    userId ? { userId } : "skip",
  );
  const createOrg = useMutation(api.organizations.createOrganization);
  const joinOrg = useMutation(api.organizations.joinOrganization);

  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      await createOrg({ userId, name: orgName.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create organization");
    } finally {
      setLoading(false);
    }
  }, [createOrg, orgName, userId]);

  const handleJoin = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      await joinOrg({ userId, inviteCode: inviteCode.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join organization");
    } finally {
      setLoading(false);
    }
  }, [inviteCode, joinOrg, userId]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5e6c8] text-amber-950">
        Loading…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f5e6c8] p-6 text-center">
        <p className="text-lg font-bold text-amber-950">Sign in to access HouseholdIQ</p>
        <a
          href="/sign-in"
          className="rounded-xl bg-amber-900 px-5 py-2.5 text-sm font-bold text-white"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (membership === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5e6c8] text-amber-950">
        Loading organization…
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5e6c8] p-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-300/70 bg-[#fff9f0] p-6 shadow-xl">
          <h1 className="text-xl font-bold text-amber-950">Connect your agency</h1>
          <p className="mt-2 text-sm text-amber-900/70">
            Create an organization or join with an invite code to access the coverage board and
            Orange Slice outbound.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                mode === "create"
                  ? "bg-amber-900 text-white"
                  : "bg-white text-amber-900 border border-amber-200"
              }`}
            >
              Create agency
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                mode === "join"
                  ? "bg-amber-900 text-white"
                  : "bg-white text-amber-900 border border-amber-200"
              }`}
            >
              Join with code
            </button>
          </div>

          {mode === "create" ? (
            <label className="mt-4 block text-xs font-semibold text-amber-900">
              Agency name
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                placeholder="Bay Area Home Insurance"
              />
            </label>
          ) : (
            <label className="mt-4 block text-xs font-semibold text-amber-900">
              Invite code
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-mono"
                placeholder="ABCD1234"
              />
            </label>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800">{error}</p>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void (mode === "create" ? handleCreate() : handleJoin())}
            className="mt-4 w-full rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Saving…" : mode === "create" ? "Create organization" : "Join organization"}
          </button>
        </div>
      </div>
    );
  }

  return children({
    userId,
    orgId: membership.orgId,
    role: membership.role,
  });
}
