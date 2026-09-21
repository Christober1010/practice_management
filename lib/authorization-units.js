/** 15-minute billing units (4 units per hour). */
export function hoursToAuthUnits(hours) {
  const h = Number.parseFloat(hours) || 0;
  if (h <= 0) return 0;
  return Math.round(h * 4 * 100) / 100;
}

export function authorizationApprovedUnits(auth) {
  return Number.parseFloat(auth?.units_approved_per_15_min) || 0;
}

/** Scheduled + billed units already using this authorization. */
export function authorizationCommittedUnits(auth) {
  const committed = Number.parseFloat(auth?.units_committed);
  if (Number.isFinite(committed) && committed >= 0) return committed;
  return Number.parseFloat(auth?.units_serviced) || 0;
}

export function authorizationRemainingUnits(auth) {
  return authorizationApprovedUnits(auth) - authorizationCommittedUnits(auth);
}
