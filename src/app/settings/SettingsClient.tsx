"use client";

import { OrgGate } from "@/components/auth/OrgGate";
import { SettingsPage } from "@/components/settings/SettingsPage";

export function SettingsClient() {
  return <OrgGate>{({ orgId }) => <SettingsPage orgId={orgId} />}</OrgGate>;
}
