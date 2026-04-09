<?php
/**
 * DB-backed RBAC with legacy fallback when tables are missing or a role has no rows.
 * Requires config.php (getDBConnection, getAuthenticatedUser).
 */

if (!function_exists('rbac_mahaverse_perm_keys')) {
    function rbac_mahaverse_perm_keys() {
        return [
            'nav.dashboard','nav.scheduling','nav.clients','nav.staff','nav.users','nav.master_data','nav.manage_data','nav.reports','nav.launchpad','nav.billing',
            'view.dashboard','view.scheduling','view.clients','view.staff','view.users','view.master_data','view.manage_data','view.reports','view.launchpad','view.billing',
            'view.domains','view.programs','view.targets','view.prompts','view.provider','view.provider_service_code','view.service_code','view.diagnosis','view.locations','view.facility_types','view.treatment_types','view.document_types',
            'clients.read','clients.write','staff.read','staff.write','users.read','users.write','scheduling.read','scheduling.write','reports.read','reports.write','master_data.read','master_data.write','manage_data.read','manage_data.write','billing.read','billing.write',
        ];
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
        if ($r === 'parent') {
            return ['nav.dashboard', 'view.dashboard'];
        }
        if ($r === 'biller') {
            return [
                'nav.dashboard','nav.clients','nav.billing',
                'view.dashboard','view.clients','view.billing',
                'clients.read','clients.write','billing.read','billing.write',
            ];
        }
        if ($r === 'bcba' || $r === 'rbt') {
            return [
                'nav.scheduling','nav.clients','nav.launchpad','nav.staff',
                'view.scheduling','view.clients','view.launchpad','view.staff',
                'view.domains','view.programs','view.targets','view.prompts',
                'clients.read','clients.write','staff.read','staff.write',
                'scheduling.read','scheduling.write','master_data.read','manage_data.read',
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

    /**
     * @param mysqli $conn
     * @return string[]
     */
    function rbac_fetch_grants_from_db($conn, $roleName) {
        $roleName = strtolower(trim((string) $roleName));
        if ($roleName === '') {
            return [];
        }
        $sql = "
            SELECT p.perm_key
            FROM rbac_role_grants rg
            JOIN rbac_permissions p ON p.id = rg.permission_id
            WHERE LOWER(rg.role_name) = ?
        ";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return [];
        }
        $stmt->bind_param('s', $roleName);
        $stmt->execute();
        $res = $stmt->get_result();
        $out = [];
        while ($row = $res->fetch_assoc()) {
            $out[] = $row['perm_key'];
        }
        $stmt->close();
        return $out;
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

        $fromDb = rbac_fetch_grants_from_db($conn, $roleName);
        if (count($fromDb) === 0) {
            return $scope === 'launchpad'
                ? rbac_legacy_launchpad($roleName)
                : rbac_legacy_mahaverse($roleName);
        }

        $scopeFilter = $scope === 'launchpad'
            ? rbac_launchpad_perm_keys()
            : rbac_mahaverse_perm_keys();
        $scopeSet = array_flip($scopeFilter);
        $filtered = [];
        foreach ($fromDb as $k) {
            if (isset($scopeSet[$k])) {
                $filtered[] = $k;
            }
        }
        return count($filtered) > 0 ? $filtered : (
            $scope === 'launchpad'
                ? rbac_legacy_launchpad($roleName)
                : rbac_legacy_mahaverse($roleName)
        );
    }

    function rbac_user_has_permission_key($roleName, $permKey, $scope = 'mahaverse') {
        $perms = rbac_get_effective_permissions($roleName, $scope);
        return in_array($permKey, $perms, true);
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

    /**
     * If request is authenticated, enforce permission; otherwise allow (legacy open API).
     */
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
