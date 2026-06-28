"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Membership = {
  orgId: Id<"organizations">;
  role: "admin" | "member";
  org: {
    id: Id<"organizations">;
    name: string;
    slug: string;
    sheetUrl: string | null;
    sheetWebhookUrl: string | null;
    slackConnected: boolean;
  };
} | null;

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

  const authReadyRef = useRef(false);
  const membershipLoadedRef = useRef(false);
  const [stableMembership, setStableMembership] = useState<Membership | undefined>(
    undefined,
  );

  useEffect(() => {
    if (isLoaded) authReadyRef.current = true;
  }, [isLoaded]);

  useEffect(() => {
    if (membership === undefined) return;
    membershipLoadedRef.current = true;
    setStableMembership(membership);
  }, [membership]);

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

  if (!authReadyRef.current && !isLoaded) {
    return (
      <div className="western-page-shell flex h-screen items-center justify-center">
        <p className="western-title">Loading…</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="western-page-shell flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="western-title text-lg">Sign in to access HouseholdIQ</p>
        <a href="/sign-in" className="western-btn western-btn-primary px-5 py-2.5">
          Sign in
        </a>
      </div>
    );
  }

  const reconnecting =
    membership === undefined &&
    membershipLoadedRef.current &&
    stableMembership != null;

  if (membership === undefined && !membershipLoadedRef.current) {
    return (
      <div className="western-page-shell flex h-screen items-center justify-center">
        <p className="western-title">Loading organization…</p>
      </div>
    );
  }

  if (!stableMembership) {
    return (
      <div className="western-page-shell flex min-h-screen items-center justify-center p-6">
        <div className="western-panel w-full max-w-md p-6">
          <h1 className="western-title text-xl">Connect your agency</h1>
          <p className="western-body mt-2">
            Create an organization or join with an invite code to access the coverage board and
            Orange Slice outbound.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`western-btn flex-1 ${
                mode === "create" ? "western-btn-primary" : "western-btn-ghost"
              }`}
            >
              Create agency
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`western-btn flex-1 ${
                mode === "join" ? "western-btn-primary" : "western-btn-ghost"
              }`}
            >
              Join with code
            </button>
          </div>

          {mode === "create" ? (
            <label className="mt-4 block">
              <span className="western-label">Agency name</span>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="western-input mt-1"
                placeholder="Bay Area Home Insurance"
              />
            </label>
          ) : (
            <label className="mt-4 block">
              <span className="western-label">Invite code</span>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="western-input mt-1 font-mono"
                placeholder="ABCD1234"
              />
            </label>
          )}

          {error && <p className="western-error mt-3">{error}</p>}

          <button
            type="button"
            disabled={loading}
            onClick={() => void (mode === "create" ? handleCreate() : handleJoin())}
            className="western-btn western-btn-primary mt-4 w-full py-2.5 disabled:opacity-60"
          >
            {loading ? "Saving…" : mode === "create" ? "Create organization" : "Join organization"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {reconnecting && (
        <div className="western-toast fixed bottom-3 left-1/2 z-[70] -translate-x-1/2">
          Reconnecting…
        </div>
      )}
      {children({
        userId,
        orgId: stableMembership.orgId,
        role: stableMembership.role,
      })}
    </>
  );
}
