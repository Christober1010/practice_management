/**
 * Staff module UI checks — align with backend/staff.php:
 * GET → staff.read ; POST/PUT/DELETE → staff.write
 * Fine-grained staff.archive is expanded to satisfy staff.write checks server-side (rbac_helpers).
 */
import { PERM } from "@/lib/rbac-permission-keys";

/** View list, expand row, documents (read path) */
export function allowsStaffRead(canAny) {
  return canAny([PERM.STAFF_READ, PERM.STAFF_WRITE]);
}

export function allowsStaffWrite(canAny) {
  return canAny([PERM.STAFF_WRITE]);
}

/** Archive/restore — DELETE / mutations */
export function allowsStaffArchive(canAny) {
  return canAny([PERM.STAFF_ARCHIVE, PERM.STAFF_WRITE]);
}
