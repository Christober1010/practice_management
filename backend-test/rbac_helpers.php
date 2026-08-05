<?php
/**
 * DB-backed RBAC with legacy fallback when tables are missing or a role has no rows.
 * Supports access_scope (all|self) on rbac_role_grants for matrix-aligned checks.
 */

if (!function_exists('rbac_mahaverse_perm_keys')) {
    function rbac_mahaverse_perm_keys() {
        return array_values(array_unique(array_merge([
            'nav.dashboard','nav.scheduling','nav.clients','nav.staff','nav.users','nav.master_data','nav.manage_data','nav.reports','nav.launchpad','nav.billing',
            'view.dashboard','view.scheduling','view.clients','view.staff','view.users','view.master_data','view.manage_data','view.reports','view.launchpad','view.billing',
            'view.domains','view.programs','view.targets','view.prompts','view.behavior_categories','view.behaviors','view.mileage_rate','view.provider','view.provider_service_code','view.service_code','view.diagnosis','view.locations','view.facility_types','view.treatment_types','view.document_types',
            'view.reports_session_log','view.reports_session_log_billing','view.reports_session_import','view.reports_insurance_utilization','view.reports_mileage',
            'clients.read','clients.write','staff.read','staff.write','users.read','users.write','scheduling.read','scheduling.write','reports.read','reports.write','master_data.read','master_data.write','manage_data.read','manage_data.write','billing.read','billing.write',
            'scheduling.session.create','scheduling.session.view','scheduling.session.notes','scheduling.session.update','scheduling.session.delete',
            'clients.create','clients.view','clients.update','clients.archive',
            'staff.archive','users.delete','users.deactivate',
            'master_data.domains','master_data.programs','master_data.targets','master_data.prompts','master_data.behavior_categories','master_data.behaviors',
            'manage_data.provider','manage_data.provider_service','manage_data.service_code','manage_data.diagnosis','manage_data.mileage_rate',
        ])));
    }

    function rbac_launchpad_perm_keys() {
        return [
            'launchpad.dashboard','launchpad.offer_letter','launchpad.profile_form','launchpad.users','launchpad.profile_submit',
        ];
    }

    function rbac_legacy_mahaverse($role) {
        $r = strtolower(trim((string) $role));
        $all = rbac_mahaverse_perm_keys();
        if ($r === 'admin') {
            return $all;
        }
        if ($r === 'client') {
            return ['nav.dashboard','nav.clients','view.dashboard','view.clients','clients.read','clients.view','clients.update'];
        }
        if ($r === 'planner') {
            return [
                'nav.scheduling','view.scheduling',
                'scheduling.read','scheduling.write',
                'scheduling.session.create','scheduling.session.view','scheduling.session.notes','scheduling.session.update','scheduling.session.delete',
            ];
        }
        if ($r === 'parent') {
            return ['nav.dashboard', 'view.dashboard'];
        }
        if ($r === 'biller') {
            return [
                'nav.dashboard','nav.clients','nav.billing','nav.manage_data',
                'view.dashboard','view.clients','view.billing','view.manage_data',
                'view.provider','view.provider_service_code','view.service_code','view.diagnosis',
                'clients.read','clients.write','clients.view','clients.update',
                'manage_data.read','manage_data.write','manage_data.provider','manage_data.provider_service','manage_data.service_code','manage_data.diagnosis',
                'billing.read','billing.write',
            ];
        }
        if ($r === 'bcba') {
            return [
                'nav.scheduling','nav.clients','nav.launchpad','nav.staff',
                'view.scheduling','view.clients','view.launchpad','view.staff',
                'view.domains','view.programs','view.targets','view.prompts','view.behavior_categories','view.behaviors',
                'clients.read','clients.write','clients.view',
                'staff.read','staff.write',
                'scheduling.read','scheduling.write',
                'scheduling.session.create','scheduling.session.view','scheduling.session.notes','scheduling.session.update',
                'master_data.read','master_data.write','master_data.domains','master_data.programs','master_data.targets','master_data.behavior_categories','master_data.behaviors',
                'manage_data.read',
            ];
        }
        if ($r === 'rbt') {
            return [
                'nav.scheduling','nav.clients','nav.launchpad','nav.staff',
                'view.scheduling','view.clients','view.launchpad','view.staff',
                'clients.read','clients.view','staff.read',
                'scheduling.read',
                'scheduling.session.view','scheduling.session.notes',
            ];
        }
        return rbac_legacy_mahaverse('rbt');
    }

    function rbac_legacy_launchpad($role) {
        $r = strtolower(trim((string) $role));
        if ($r === 'admin') {
            return rbac_launchpad_perm_keys();
        }
        if ($r === 'hr' || $r === 'staff') {
            return [
                'launchpad.dashboard','launchpad.offer_letter','launchpad.profile_form','launchpad.profile_submit',
            ];
        }
        if ($r === 'viewer' || $r === 'reader') {
            return ['launchpad.dashboard','launchpad.offer_letter'];
        }
        return rbac_legacy_launchpad('staff');
    }

    function rbac_tables_exist($conn) {
        if (!$conn) return false;
        $r = @$conn->query("SHOW TABLES LIKE 'rbac_permissions'");
        return $r && $r->num_rows > 0;
    }

    function rbac_role_grants_have_scope_column($conn) {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        $cached = false;
        if (!$conn) {
            return false;
        }
        $r = @$conn->query("SHOW COLUMNS FROM rbac_role_grants LIKE 'access_scope'");
        $cached = $r && $r->num_rows > 0;
        return $cached;
    }

    /**
     * @return array<string, string> perm_key => access_scope (all|self)
     */
    function rbac_fetch_grant_map_from_db($conn, $roleName) {
        $roleName = strtolower(trim((string) $roleName));
        if ($roleName === '') {
            return [];
        }
        $hasScope = rbac_role_grants_have_scope_column($conn);
        $scopeCol = $hasScope ? 'rg.access_scope' : "'all'";
        $sql = "
            SELECT p.perm_key, {$scopeCol} AS access_scope
            FROM rbac_role_grants rg
            JOIN rbac_permissions p ON p.id = rg.permission_id
            WHERE LOWER(rg.role_name) = ? AND p.app_scope = 'mahaverse'
        ";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return [];
        }
        $stmt->bind_param('s', $roleName);
        $stmt->execute();
        $res = $stmt->get_result();
        $map = [];
        while ($row = $res->fetch_assoc()) {
            $pk = $row['perm_key'];
            $sc = strtolower((string) ($row['access_scope'] ?? 'all')) === 'self' ? 'self' : 'all';
            if (!isset($map[$pk]) || $map[$pk] === 'self' && $sc === 'all') {
                $map[$pk] = $sc;
            }
        }
        $stmt->close();
        return $map;
    }

    /**
     * @param mysqli $conn
     * @return string[]
     */
    function rbac_fetch_grants_from_db($conn, $roleName) {
        return array_keys(rbac_fetch_grant_map_from_db($conn, $roleName));
    }

    /**
     * @param string $scope 'mahaverse'|'launchpad'
     * @return string[]
     */
    function rbac_get_effective_permissions($roleName, $scope = 'mahaverse') {
        $useDb = getenv('RBAC_USE_DB');
        if ($useDb === '0' || $useDb === 'false') {
            return $scope === 'launchpad'
                ? rbac_legacy_launchpad($roleName)
                : rbac_legacy_mahaverse($roleName);
        }

        try {
            $conn = getDBConnection();
        } catch (Exception $e) {
            return $scope === 'launchpad'
                ? rbac_legacy_launchpad($roleName)
                : rbac_legacy_mahaverse($roleName);
        }

        if (!rbac_tables_exist($conn)) {
            return $scope === 'launchpad'
                ? rbac_legacy_launchpad($roleName)
                : rbac_legacy_mahaverse($roleName);
        }

        if ($scope === 'launchpad') {
            $fromDb = rbac_fetch_grants_from_db($conn, $roleName);
            if (count($fromDb) === 0) {
                return rbac_legacy_launchpad($roleName);
            }
            $scopeSet = array_flip(rbac_launchpad_perm_keys());
            $filtered = [];
            foreach ($fromDb as $k) {
                if (isset($scopeSet[$k])) {
                    $filtered[] = $k;
                }
            }
            return count($filtered) > 0 ? $filtered : rbac_legacy_launchpad($roleName);
        }

        $map = rbac_fetch_grant_map_from_db($conn, $roleName);
        if (count($map) === 0) {
            return rbac_legacy_mahaverse($roleName);
        }

        // Return all keys granted in DB (joined from rbac_permissions). Do not strip keys
        // missing from rbac_mahaverse_perm_keys() — new SQL-seeded permissions must work
        // without redeploying this whitelist.
        return array_keys($map);
    }

    /**
     * Legacy coarse permission check: true if role has the key OR a mapped fine key.
     *
     * @param array<string,string>|null $grantMap
     */
    function rbac_user_has_permission_key($roleName, $permKey, $scope = 'mahaverse', $grantMap = null) {
        if ($scope !== 'mahaverse') {
            $perms = rbac_get_effective_permissions($roleName, $scope);
            return in_array($permKey, $perms, true);
        }

        $roleName = strtolower(trim((string) $roleName));
        $permKey = (string) $permKey;

        $map = $grantMap;
        if ($map === null) {
            try {
                $conn = getDBConnection();
                if (rbac_tables_exist($conn)) {
                    $map = rbac_fetch_grant_map_from_db($conn, $roleName);
                }
            } catch (Exception $e) {
                $map = [];
            }
        }

        if (is_array($map) && count($map) > 0) {
            $candidates = rbac_expand_perm_aliases($permKey);
            foreach ($candidates as $c) {
                if (isset($map[$c])) {
                    return true;
                }
            }
            return false;
        }

        $perms = rbac_get_effective_permissions($roleName, $scope);
        return in_array($permKey, $perms, true);
    }

    /** @return string[] */
    function rbac_expand_perm_aliases($permKey) {
        $aliases = [
            'clients.read' => ['clients.read', 'clients.view'],
            'clients.write' => ['clients.write', 'clients.create', 'clients.update', 'clients.archive'],
            'staff.write' => ['staff.write', 'staff.archive'],
            'scheduling.read' => ['scheduling.read', 'scheduling.session.view', 'scheduling.session.notes'],
            'scheduling.write' => ['scheduling.write', 'scheduling.session.create', 'scheduling.session.update', 'scheduling.session.delete'],
            'master_data.write' => ['master_data.write', 'master_data.domains', 'master_data.programs', 'master_data.targets', 'master_data.prompts', 'master_data.behavior_categories', 'master_data.behaviors'],
            'manage_data.write' => ['manage_data.write', 'manage_data.provider', 'manage_data.provider_service', 'manage_data.service_code', 'manage_data.diagnosis', 'manage_data.mileage_rate'],
        ];
        return $aliases[$permKey] ?? [$permKey];
    }

    function rbac_require_permission_user($user, $permKey, $scope = 'mahaverse') {
        if (!$user || empty($user['role'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Permission denied']);
            exit;
        }
        if (!rbac_user_has_permission_key($user['role'], $permKey, $scope)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Permission denied']);
            exit;
        }
    }

    function rbac_enforce_if_authenticated($permKey, $scope = 'mahaverse') {
        if (!function_exists('getAuthenticatedUser')) {
            return;
        }
        $user = getAuthenticatedUser();
        if ($user) {
            rbac_require_permission_user($user, $permKey, $scope);
        }
    }
}

/**
 * Resolve staff.id for a Mahaverse user (link_staff_id, else email match on staff).
 *
 * @param mysqli $conn
 * @param array $user getAuthenticatedUser row
 */
function rbac_resolve_staff_id_for_user($conn, $user) {
    if (!$conn || !$user) {
        return null;
    }
    if (!empty($user['link_staff_id'])) {
        return (string) $user['link_staff_id'];
    }
    $uid = (int) ($user['id'] ?? 0);
    if ($uid <= 0) {
        return null;
    }
    $stmt = $conn->prepare("
        SELECT s.id
        FROM staff s
        INNER JOIN users u ON LOWER(TRIM(s.email)) = LOWER(TRIM(u.email))
        WHERE u.id = ?
        LIMIT 1
    ");
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row['id'] ?? null;
}

function rbac_resolve_client_id_for_user($user) {
    if (!$user) {
        return null;
    }
    if (!empty($user['link_client_id'])) {
        return (string) $user['link_client_id'];
    }
    return null;
}

/**
 * @param mysqli $conn
 * @param array<string,string> $grantMap
 */
function rbac_grant_scope_for_perm($grantMap, $permKey) {
    $candidates = rbac_expand_perm_aliases($permKey);
    $best = null;
    foreach ($candidates as $c) {
        if (!isset($grantMap[$c])) {
            continue;
        }
        $sc = $grantMap[$c];
        if ($sc === 'all') {
            return 'all';
        }
        if ($sc === 'self') {
            $best = 'self';
        }
    }
    return $best;
}

/**
 * True if user may perform a session action (coarse + fine keys + self scope).
 *
 * @param mysqli $conn
 */
function rbac_user_may_session_action($user, $conn, $action, $providerId = null) {
    if (!$user || empty($user['role'])) {
        return false;
    }
    $role = strtolower((string) $user['role']);
    if ($role === 'admin') {
        return true;
    }
    try {
        if (!rbac_tables_exist($conn)) {
            return rbac_user_has_permission_key($role, 'scheduling.write', 'mahaverse')
                || rbac_user_has_permission_key($role, 'scheduling.read', 'mahaverse');
        }
    } catch (Exception $e) {
        return false;
    }

    $map = rbac_fetch_grant_map_from_db($conn, $role);
    $actionToPerm = [
        'create' => 'scheduling.session.create',
        'view' => 'scheduling.session.view',
        'notes' => 'scheduling.session.notes',
        'update' => 'scheduling.session.update',
        'delete' => 'scheduling.session.delete',
    ];
    $perm = $actionToPerm[$action] ?? null;
    if (!$perm) {
        return false;
    }

    $scope = rbac_grant_scope_for_perm($map, $perm);
    if ($scope === null) {
        if ($action === 'view' || $action === 'notes') {
            return rbac_user_has_permission_key($role, 'scheduling.read', 'mahaverse', $map);
        }
        return rbac_user_has_permission_key($role, 'scheduling.write', 'mahaverse', $map);
    }
    if ($scope === 'all') {
        return true;
    }
    $sid = rbac_resolve_staff_id_for_user($conn, $user);
    if (!$sid || !$providerId) {
        return false;
    }
    return (string) $sid === (string) $providerId;
}

/**
 * True when the clients row is active and not archived.
 *
 * @param array $client
 */
function rbac_client_row_is_active($client) {
    if (!is_array($client)) {
        return false;
    }
    $active = !isset($client['is_active'])
        || ($client['is_active'] !== false
            && $client['is_active'] !== 0
            && $client['is_active'] !== '0');
    $archived = isset($client['archived'])
        && $client['archived'] !== false
        && $client['archived'] !== 0
        && $client['archived'] !== '0'
        && $client['archived'] !== '';
    return $active && !$archived;
}

/**
 * Staff IDs a non-admin user may see in Appointments / scheduling dropdowns:
 * self + people who report to me.
 *
 * staff_assignments semantics (see Staff form "Assigned Supervisor"):
 *   staff_id           = the report (person whose profile is edited)
 *   assigned_staff_id  = their supervisor
 *
 * So my reports are: WHERE assigned_staff_id = me → staff_id
 * Supervisors (bosses) are excluded from the dropdown.
 *
 * @param mysqli $conn
 * @param array $user
 * @return string[]
 */
function rbac_visible_staff_ids_for_user($conn, $user) {
    $sid = rbac_resolve_staff_id_for_user($conn, $user);
    if (!$sid) {
        return [];
    }
    $ids = [(string) $sid];

    // Direct reports: staff who listed this user as their Assigned Supervisor.
    $stmt = $conn->prepare("SELECT staff_id FROM staff_assignments WHERE assigned_staff_id = ?");
    if ($stmt) {
        $stmt->bind_param('s', $sid);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($res && ($row = $res->fetch_assoc())) {
            if (!empty($row['staff_id'])) {
                $ids[] = (string) $row['staff_id'];
            }
        }
        $stmt->close();
    }

    return array_values(array_unique($ids));
}

/**
 * Client IDs assigned to the authenticated user's staff (or linked client id).
 *
 * @param mysqli $conn
 * @param array $user
 * @return string[]
 */
function rbac_assigned_client_ids_for_user($conn, $user) {
    $ids = [];
    $cid = rbac_resolve_client_id_for_user($user);
    if ($cid) {
        $ids[] = (string) $cid;
    }
    $sid = rbac_resolve_staff_id_for_user($conn, $user);
    if ($sid) {
        $stmt = $conn->prepare("SELECT client_id FROM staff_client_assignments WHERE staff_id = ?");
        if ($stmt) {
            $stmt->bind_param('s', $sid);
            $stmt->execute();
            $res = $stmt->get_result();
            while ($res && ($row = $res->fetch_assoc())) {
                if (!empty($row['client_id'])) {
                    $ids[] = (string) $row['client_id'];
                }
            }
            $stmt->close();
        }
    }
    return array_values(array_unique($ids));
}

/**
 * Filter session rows for non-admin users (assigned clients and/or visible providers).
 * Sessions marked exclude_session=Yes are admin-only.
 *
 * @param mysqli $conn
 * @param array $user
 * @param array $sessions
 * @return array
 */
function rbac_filter_sessions_for_user($conn, $user, $sessions) {
    if (!$user || !is_array($sessions)) {
        return [];
    }
    $role = strtolower((string) ($user['role'] ?? ''));
    if ($role === 'admin') {
        return $sessions;
    }

    $isExcluded = static function ($s) {
        $exclude = strtolower(trim((string) ($s['exclude_session'] ?? $s['excludeSession'] ?? 'No')));
        return $exclude === 'yes' || $exclude === '1' || $exclude === 'true';
    };

    // Org-wide client roster (e.g. Biller clients.view=all): all non-excluded sessions.
    $rosterScope = rbac_client_roster_access_scope($user, $conn);
    if ($rosterScope === 'all') {
        return array_values(array_filter($sessions, static function ($s) use ($isExcluded) {
            return !$isExcluded($s);
        }));
    }

    $allowedClients = array_flip(rbac_assigned_client_ids_for_user($conn, $user));
    $allowedStaff = array_flip(rbac_visible_staff_ids_for_user($conn, $user));
    return array_values(array_filter($sessions, function ($s) use ($allowedClients, $allowedStaff, $isExcluded) {
        if ($isExcluded($s)) {
            return false;
        }
        $cid = (string) ($s['client_id'] ?? '');
        $pid = (string) ($s['provider_id'] ?? '');
        $sid = (string) ($s['supervising_provider_id'] ?? '');
        if ($cid !== '' && isset($allowedClients[$cid])) {
            return true;
        }
        if ($pid !== '' && isset($allowedStaff[$pid])) {
            return true;
        }
        if ($sid !== '' && isset($allowedStaff[$sid])) {
            return true;
        }
        return false;
    }));
}

/**
 * Mileage claims visibility scope (Admin → Role permissions Off / Self / All).
 * Prefers view.reports_mileage; falls back to reports.read.
 *
 * @param array $user
 * @param mysqli|null $conn
 * @return 'all'|'self'|null
 */
function rbac_mileage_access_scope($user, $conn) {
    if (!$user || empty($user['role'])) {
        return null;
    }
    $role = strtolower((string) $user['role']);
    if ($role === 'admin') {
        return 'all';
    }

    $map = [];
    try {
        if ($conn && function_exists('rbac_tables_exist') && rbac_tables_exist($conn)) {
            $map = rbac_fetch_grant_map_from_db($conn, $role);
        }
    } catch (Exception $e) {
        $map = [];
    }

    if (count($map) > 0) {
        if (isset($map['view.reports_mileage'])) {
            return $map['view.reports_mileage'] === 'self' ? 'self' : 'all';
        }
        if (
            rbac_user_has_permission_key($role, 'view.reports_mileage', 'mahaverse', $map)
            || rbac_user_has_permission_key($role, 'reports.read', 'mahaverse', $map)
            || rbac_user_has_permission_key($role, 'view.reports', 'mahaverse', $map)
        ) {
            return 'self';
        }
        return null;
    }

    if (
        rbac_user_has_permission_key($role, 'view.reports_mileage', 'mahaverse')
        || rbac_user_has_permission_key($role, 'reports.read', 'mahaverse')
    ) {
        return 'self';
    }
    return null;
}

/**
 * True if user may access a mileage claim for the given provider_id.
 */
function rbac_user_may_access_mileage_provider($user, $conn, $providerId = null) {
    $scope = rbac_mileage_access_scope($user, $conn);
    if ($scope === null) {
        return false;
    }
    if ($scope === 'all') {
        return true;
    }
    $sid = rbac_resolve_staff_id_for_user($conn, $user);
    if (!$sid || $providerId === null || $providerId === '') {
        return false;
    }
    return (string) $sid === (string) $providerId;
}

/**
 * Roster visibility scope from Role permissions (UI-managed access_scope).
 *
 * Prefers clients.view (tri-state in Admin → Role permissions). Does not widen
 * self view via clients.read=all (BCBA matrix keeps read=all, view=self).
 *
 * @param array $user
 * @param mysqli|null $conn
 * @return 'all'|'self'|null  null = no client roster access
 */
function rbac_client_roster_access_scope($user, $conn) {
    if (!$user || empty($user['role'])) {
        return null;
    }
    $role = strtolower((string) $user['role']);
    if ($role === 'admin') {
        return 'all';
    }

    $map = [];
    try {
        if ($conn && function_exists('rbac_tables_exist') && rbac_tables_exist($conn)) {
            $map = rbac_fetch_grant_map_from_db($conn, $role);
        }
    } catch (Exception $e) {
        $map = [];
    }

    if (count($map) > 0) {
        if (isset($map['clients.view'])) {
            return $map['clients.view'] === 'self' ? 'self' : 'all';
        }
        if (isset($map['clients.read'])) {
            return $map['clients.read'] === 'self' ? 'self' : 'all';
        }
        if (
            rbac_user_has_permission_key($role, 'clients.read', 'mahaverse', $map)
            || rbac_user_has_permission_key($role, 'clients.view', 'mahaverse', $map)
        ) {
            return 'self';
        }
        return null;
    }

    // Legacy flat keys (no rbac_role_grants rows): biller org-wide; therapists assigned-only.
    if (
        !rbac_user_has_permission_key($role, 'clients.read', 'mahaverse')
        && !rbac_user_has_permission_key($role, 'clients.view', 'mahaverse')
    ) {
        return null;
    }
    if ($role === 'biller') {
        return 'all';
    }
    return 'self';
}

/**
 * @param mysqli $conn
 */
function rbac_user_may_access_client_row($user, $conn, $clientId) {
    if (!$user || empty($user['role'])) {
        return false;
    }
    $role = strtolower((string) $user['role']);
    if ($role === 'admin') {
        return true;
    }

    $rosterScope = rbac_client_roster_access_scope($user, $conn);
    if ($rosterScope === null) {
        return false;
    }
    if ($rosterScope === 'all') {
        return true;
    }

    // self: linked client or staff_client_assignments only.
    $cid = rbac_resolve_client_id_for_user($user);
    if ($cid && (string) $cid === (string) $clientId) {
        return true;
    }
    $sid = rbac_resolve_staff_id_for_user($conn, $user);
    if ($sid) {
        $stmt = $conn->prepare("SELECT 1 FROM staff_client_assignments WHERE staff_id = ? AND client_id = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param('ss', $sid, $clientId);
            $stmt->execute();
            $ok = $stmt->get_result()->num_rows > 0;
            $stmt->close();
            if ($ok) {
                return true;
            }
        }
    }
    return false;
}

function rbac_enforce_session_action($user, $conn, $action, $providerId = null) {
    if (!$user) {
        return;
    }
    if (!rbac_user_may_session_action($user, $conn, $action, $providerId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Permission denied']);
        exit;
    }
}

/**
 * @param mysqli $conn
 * @param 'create'|'update'|'archive' $action
 */
function rbac_user_may_client_action($user, $conn, $action, $clientId = null) {
    if (!$user || empty($user['role'])) {
        return false;
    }
    $role = strtolower((string) $user['role']);
    if ($role === 'admin') {
        return true;
    }
    $map = rbac_fetch_grant_map_from_db($conn, $role);
    // Legacy coarse write (literal grant only — do not treat update/archive as write).
    $hasCoarseWrite = isset($map['clients.write']);

    if ($action === 'view') {
        $scope = rbac_grant_scope_for_perm($map, 'clients.view');
        if ($scope === null) {
            return rbac_user_has_permission_key($role, 'clients.read', 'mahaverse', $map);
        }
        if ($scope === 'all') {
            return true;
        }
        if (!$clientId) {
            return false;
        }
        return rbac_user_may_access_client_row($user, $conn, $clientId);
    }

    if ($action === 'create') {
        if (!isset($map['clients.create']) && !$hasCoarseWrite) {
            return false;
        }
        return true;
    }

    if ($action === 'update') {
        if (!isset($map['clients.update']) && !$hasCoarseWrite) {
            return false;
        }
        $scope = isset($map['clients.update']) ? $map['clients.update'] : 'all';
    } elseif ($action === 'archive') {
        // Archive must not be implied by Edit (clients.update).
        if (!isset($map['clients.archive']) && !$hasCoarseWrite) {
            return false;
        }
        $scope = isset($map['clients.archive']) ? $map['clients.archive'] : 'all';
    } else {
        return false;
    }

    if ($scope === 'all') {
        if (!$clientId) {
            return false;
        }
        return true;
    }
    if (!$clientId) {
        return false;
    }
    return rbac_user_may_access_client_row($user, $conn, $clientId);
}

function rbac_enforce_client_action($user, $conn, $action, $clientId = null) {
    if (!$user) {
        return;
    }
    if (!rbac_user_may_client_action($user, $conn, $action, $clientId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Permission denied']);
        exit;
    }
}
