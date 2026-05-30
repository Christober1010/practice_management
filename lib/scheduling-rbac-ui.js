/**
 * Scheduling UI checks — aligned with backend/rbac_helpers.php rbac_user_may_session_action:
 * Fine keys: scheduling.session.{create|view|notes|update|delete}; legacy fallbacks scheduling.read/write.
 */
import { PERM } from "@/lib/rbac-permission-keys";

/** List/load sessions & open session detail (maps to "view") */
export function allowsSchedulingReadSessions(canAny) {
  return canAny([
    PERM.SCHEDULING_SESSION_VIEW,
    PERM.SCHEDULING_READ,
    PERM.SCHEDULING_WRITE,
  ]);
}

export function allowsSchedulingCreateSession(canAny) {
  return canAny([
    PERM.SCHEDULING_SESSION_CREATE,
    PERM.SCHEDULING_WRITE,
  ]);
}

export function allowsSchedulingUpdateSession(canAny) {
  return canAny([
    PERM.SCHEDULING_SESSION_UPDATE,
    PERM.SCHEDULING_WRITE,
  ]);
}

export function allowsSchedulingDeleteSession(canAny) {
  return canAny([
    PERM.SCHEDULING_SESSION_DELETE,
    PERM.SCHEDULING_WRITE,
  ]);
}

export function allowsSchedulingSessionNotes(canAny) {
  return canAny([
    PERM.SCHEDULING_SESSION_NOTES,
    PERM.SCHEDULING_READ,
    PERM.SCHEDULING_WRITE,
  ]);
}
