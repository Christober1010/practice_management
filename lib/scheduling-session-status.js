/**
 * Whether a scheduling session is completed (rendered / billed).
 * Matches calendar "green" completed state in scheduling-view.
 */
export function sessionIsRenderedOrReadyToBill(session) {
  if (!session) return false;
  const st = String(session.status || session.STATUS || "").toLowerCase();
  if (st === "rendered" || st === "completed") return true;
  const hrs = Number.parseFloat(
    session.renderedHours ?? session.rendered_hours ?? 0
  );
  if (hrs > 0) return true;
  const cs = String(
    session.claimStatus ?? session.claim_status ?? ""
  ).toLowerCase();
  if (cs.includes("ready to bill")) return true;
  const claimId = session.claimId ?? session.claim_id;
  if (claimId != null && String(claimId).trim() !== "") return true;
  return false;
}

export function canDeleteScheduledSession(session) {
  return session != null && !sessionIsRenderedOrReadyToBill(session);
}
