"use client";

import { OrgGate } from "@/components/auth/OrgGate";
import { PipelinePage } from "@/components/pipeline/PipelinePage";

export function PipelineClient() {
  return <OrgGate>{({ orgId }) => <PipelinePage orgId={orgId} />}</OrgGate>;
}
