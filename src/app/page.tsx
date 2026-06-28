"use client";

import { OrgGate } from "@/components/auth/OrgGate";
import QuestBoard from "@/components/quest-board/QuestBoard";
import QuestBoardDemo from "@/components/quest-board/QuestBoardDemo";
import { isClerkEnabled } from "@/lib/clerk-config";
import { isUiDemoMode } from "@/lib/ui-demo";

export default function Home() {
  if (isUiDemoMode()) {
    return <QuestBoardDemo />;
  }

  if (!isClerkEnabled()) {
    return <QuestBoard />;
  }

  return (
    <OrgGate>
      {({ userId, orgId }) => <QuestBoard userId={userId} orgId={orgId} />}
    </OrgGate>
  );
}
