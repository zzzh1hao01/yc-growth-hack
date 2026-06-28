export type LassoPhase = "dragging" | "captured";

export type LassoState = {
  leadId: string;
  phase: LassoPhase;
};
