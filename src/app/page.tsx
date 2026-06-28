"use client";

import { OrgGate } from "@/components/auth/OrgGate";
import QuestBoard from "@/components/quest-board/QuestBoard";

export default function Home() {
  return (
    <OrgGate>
      {({ userId, orgId }) => <QuestBoard userId={userId} orgId={orgId} />}
    </OrgGate>
  );
}
