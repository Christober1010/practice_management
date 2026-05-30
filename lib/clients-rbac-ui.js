/**
 * Client module UI permission checks — align with backend/rbac_helpers.php
 * rbac_user_may_client_action, add-clients.php, update-clients.php, get-clients.php
 */
import { PERM } from "@/lib/rbac-permission-keys";

/** add-clients.php: clients.create OR clients.write */
export function allowsClientCreate(canAny) {
  return canAny([PERM.CLIENTS_CREATE, PERM.CLIENTS_WRITE]);
}

/**
 * Same as rbac_user_may_client_action('update'|'archive') when scope unset:
 * clients.update OR clients.archive OR clients.write
 */
export function allowsClientUpdate(canAny) {
  return canAny([
    PERM.CLIENTS_UPDATE,
    PERM.CLIENTS_ARCHIVE,
    PERM.CLIENTS_WRITE,
  ]);
}

/**
 * Archive/restore: clients.archive || clients.update || clients.write
 * (see rbac_user_may_client_action for 'update' | 'archive')
 */
export function allowsClientArchive(canAny) {
  return canAny([
    PERM.CLIENTS_ARCHIVE,
    PERM.CLIENTS_UPDATE,
    PERM.CLIENTS_WRITE,
  ]);
}

/** Expand details, documents: clients.read or clients.view */
export function allowsReadClientDetails(canAny) {
  return canAny([PERM.CLIENTS_READ, PERM.CLIENTS_VIEW]);
}

/**
 * Session notes on a client: session notes perm or read access to client.
 * (APIs may add stricter rules later.)
 */
export function allowsClientSessionNotes(canAny) {
  return canAny([
    PERM.SCHEDULING_SESSION_NOTES,
    PERM.CLIENTS_READ,
    PERM.CLIENTS_VIEW,
  ]);
}

const VIEW_BY_SUB = {
  domains: PERM.VIEW_DOMAINS,
  programs: PERM.VIEW_PROGRAMS,
  targets: PERM.VIEW_TARGETS,
};

/** Master data nav from client row (Domains/Programs/Targets) */
export function canOpenClientMasterDataNav(can, subId) {
  return can(VIEW_BY_SUB[subId] ?? PERM.VIEW_MASTER_DATA);
}
