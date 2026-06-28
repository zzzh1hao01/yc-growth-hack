"use client";

import { OrgGate } from "@/components/auth/OrgGate";
import QuestBoard from "@/components/quest-board/QuestBoard";
import { isClerkEnabled } from "@/lib/clerk-config";

export default function Home() {
  if (!isClerkEnabled()) {
    return <QuestBoard />;
  }

  return (
    <OrgGate>
      {({ userId, orgId }) => <QuestBoard userId={userId} orgId={orgId} />}
    </OrgGate>
  );
}
