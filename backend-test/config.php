<?php
/**
 * Backend Configuration File (TEST ENVIRONMENT)
 * Loads environment variables from .env file for Google Drive integration
 */

// Load environment variables from backend-test/.env (Google Drive config, etc.)
// - In production: prefer real environment variables (recommended).
// - For local/dev: copy `backend-test/env.example` -> `backend-test/.env` and fill real values.
if (file_exists(__DIR__ . '/.env')) {
    $envFile = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($envFile as $line) {
        $line = trim($line);
        // Skip empty lines and comments
        if (empty($line) || strpos($line, '#') === 0) continue;
        // Skip lines without =
        if (strpos($line, '=') === false) continue;
        
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        
        // Skip if key is empty
        if (empty($key)) continue;
        
        // Remove quotes if present
        if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
            (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
            $value = substr($value, 1, -1);
        }
        
        // Always set from .env file (override existing env vars from .env)
        // This allows .env to take precedence over system environment variables
        putenv("$key=$value");
        $_ENV[$key] = $value;
    }
}

/**
 * Get database connection (mysqli) for Mahaverse backend-test
 * Used by OAuth callback and other Drive-related endpoints
 */
function getDBConnection() {
    static $conn = null;
    
    if ($conn !== null) {
        return $conn;
    }
    
    $host = "db5018419668.hosting-data.io";
    $dbname = "dbs14649042";
    $user = "dbu1183438";
    $pass = "M@h@B3h@v1or@lH3@lth4@ut1sm";
    
    $conn = new mysqli($host, $user, $pass, $dbname);
    
    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        throw new Exception("Database connection failed");
    }
    
    $conn->set_charset('utf8mb4');
    
    return $conn;
}

// Session management
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function isAuthenticated() {
    return isset($_SESSION['user_id']) && isset($_SESSION['username']) && isset($_SESSION['authenticated']);
}

function getAuthorizationHeader() {
    // Check for Authorization header in various locations (server-dependent)
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['HTTP_AUTHORIZATION']);
    }
    // Common on many PHP-FPM / CGI setups
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }
    if (isset($_SERVER['AUTHORIZATION'])) {
        return trim($_SERVER['AUTHORIZATION']);
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            return trim($headers['Authorization']);
        }
        if (isset($headers['authorization'])) {
            return trim($headers['authorization']);
        }
    }
    return '';
}

function getTokenFromCustomHeaders() {
    // Some servers strip Authorization, but keep X-* headers.
    if (isset($_SERVER['HTTP_X_AUTH_TOKEN']) && $_SERVER['HTTP_X_AUTH_TOKEN'] !== '') {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    if (isset($_SERVER['HTTP_X_CSRF_TOKEN']) && $_SERVER['HTTP_X_CSRF_TOKEN'] !== '') {
        return trim($_SERVER['HTTP_X_CSRF_TOKEN']);
    }
    return '';
}

function getBearerTokenFromRequest() {
    $authHeader = getAuthorizationHeader();
    if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return trim($matches[1]);
    }
    return '';
}

function getRequestTokenFallback() {
    // For legacy clients: token sometimes comes in as csrf_token form field
    if (isset($_POST['csrf_token']) && $_POST['csrf_token'] !== '') {
        return $_POST['csrf_token'];
    }
    return '';
}

function getAuthenticatedUserFromToken($rawToken) {
    if (!$rawToken) return null;

    // basic sanity: expecting a hex token (bin2hex(32 bytes) => 64 chars)
    $rawToken = trim($rawToken);
    if (strlen($rawToken) < 32 || strlen($rawToken) > 256) return null;

    $tokenHash = hash('sha256', $rawToken);
    $conn = getDBConnection();

    // Check if AuthTokens table exists
    $tableCheck = $conn->query("SHOW TABLES LIKE 'AuthTokens'");
    if (!$tableCheck || $tableCheck->num_rows === 0) {
        // AuthTokens table doesn't exist - return null (token auth not available)
        return null;
    }

    $userCols = 'u.id, u.email AS username, u.role';
    $lc = @$conn->query("SHOW COLUMNS FROM users LIKE 'link_staff_id'");
    if ($lc && $lc->num_rows > 0) {
        $userCols .= ', u.link_staff_id, u.link_client_id';
    }
    $sql = "
        SELECT {$userCols}
        FROM AuthTokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ?
          AND t.revoked_at IS NULL
          AND t.expires_at > NOW()
        LIMIT 1
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) return null;

    $stmt->bind_param("s", $tokenHash);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if ($row) {
        // Update last_used_at (best-effort)
        $upd = $conn->prepare("UPDATE AuthTokens SET last_used_at = NOW() WHERE token_hash = ? LIMIT 1");
        if ($upd) {
            $upd->bind_param("s", $tokenHash);
            $upd->execute();
            $upd->close();
        }
        // Keep email alias for RBAC staff/client resolution helpers.
        if (empty($row['email']) && !empty($row['username'])) {
            $row['email'] = $row['username'];
        }
        return $row;
    }
    return null;
}

function getAuthenticatedUser() {
    // Prefer session if available
    if (isAuthenticated()) {
        return [
            'id' => (int)$_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'role' => isset($_SESSION['role']) ? $_SESSION['role'] : 'staff',
            'via' => 'session'
        ];
    }

    // Fallback to bearer token or csrf_token form field
    $token = getBearerTokenFromRequest();
    if (!$token) $token = getTokenFromCustomHeaders();
    if (!$token) $token = getRequestTokenFallback();
    $user = getAuthenticatedUserFromToken($token);
    if ($user) {
        $user['id'] = (int)$user['id'];
        $user['via'] = 'token';
        return $user;
    }

    return null;
}

/** CORS headers for browser clients (localhost dev + static export). */
function mahaverse_api_cors_headers(): void {
    if (headers_sent()) {
        return;
    }
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept, Accept-Language, Cache-Control');
    header('Access-Control-Max-Age: 86400');
}

/** Answer OPTIONS preflight before auth or DB (include via config.php). */
function mahaverse_handle_options_preflight(int $code = 204): void {
    mahaverse_api_cors_headers();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code($code);
        exit;
    }
}

function requireUser() {
    $user = getAuthenticatedUser();
    if (!$user) {
        mahaverse_api_cors_headers();
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication required'
        ]);
        exit;
    }
    return $user;
}

require_once __DIR__ . '/rbac_helpers.php';

/**
 * Require valid Bearer/session auth and optionally an RBAC permission key.
 */
function requireAuth(?string $permissionKey = null, string $scope = 'mahaverse'): array {
    $user = requireUser();
    if ($permissionKey !== null && !rbac_user_has_permission_key($user['role'], $permissionKey, $scope)) {
        mahaverse_api_cors_headers();
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Permission denied']);
        exit;
    }
    return $user;
}

/**
 * Pick read vs write permission from HTTP method (GET/HEAD/OPTIONS vs mutating verbs).
 */
function requireAuthReadWrite(string $readPerm, string $writePerm, string $scope = 'mahaverse'): array {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $perm = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) ? $writePerm : $readPerm;
    return requireAuth($perm, $scope);
}

/** Require auth and at least one of the given permission keys. */
function requireAuthAny(array $permissionKeys, string $scope = 'mahaverse'): array {
    $user = requireUser();
    foreach ($permissionKeys as $key) {
        if ($key !== null && $key !== '' && rbac_user_has_permission_key($user['role'], $key, $scope)) {
            return $user;
        }
    }
    mahaverse_api_cors_headers();
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Permission denied']);
    exit;
}

mahaverse_handle_options_preflight();

/**
 * Resolve client_auth.insurance_id when saving a client.
 * Payload may send a UI slot ("0","1"), or the real client_insurance.insurance_id PK after reload.
 */
function mahaverse_resolve_authorization_insurance_id(array $auth, array $insuranceIdsFromThisRequest): ?int {
    if (!$insuranceIdsFromThisRequest) {
        return null;
    }
    $raw = $auth['insurance_id'] ?? null;
    if ($raw === null || $raw === '') {
        return (int) $insuranceIdsFromThisRequest[0];
    }
    $n = count($insuranceIdsFromThisRequest);
    if (is_numeric($raw)) {
        $asInt = (int) $raw;
        if ($asInt >= 0 && $asInt < $n) {
            return (int) $insuranceIdsFromThisRequest[$asInt];
        }
        foreach ($insuranceIdsFromThisRequest as $id) {
            if ((int) $id === $asInt) {
                return (int) $id;
            }
        }
    }
    return (int) $insuranceIdsFromThisRequest[0];
}

/**
 * Lazy-load a backend helper include after auth.
 * Allowed: rbac_helpers, behavior_helpers, client_auth_units_helpers, drive_helper.
 */
function mahaverse_require_helper(string $basename): void {
    static $loaded = [];
    $basename = preg_replace('/\.php$/', '', basename($basename));
    $allowed = ['rbac_helpers', 'behavior_helpers', 'client_auth_units_helpers', 'drive_helper'];
    if (!in_array($basename, $allowed, true)) {
        throw new InvalidArgumentException("Unknown helper: {$basename}");
    }
    if (isset($loaded[$basename])) {
        return;
    }
    require_once __DIR__ . '/' . $basename . '.php';
    $loaded[$basename] = true;
}

/**
 * Ensure clients.client_status is VARCHAR so workflow labels persist.
 * ENUM silently stores '' for unknown values (e.g. Service Terminated) in non-strict MySQL.
 * Idempotent. ALTER commits implicitly — call outside an open transaction.
 *
 * @return array{changed:bool,before:?string,after:?string}
 */
function mahaverse_ensure_clients_client_status_varchar(PDO $conn): array {
    $col = $conn->query("SHOW FULL COLUMNS FROM clients LIKE 'client_status'")->fetch(PDO::FETCH_ASSOC);
    if (!$col) {
        return ['changed' => false, 'before' => null, 'after' => null];
    }
    $before = (string) ($col['Type'] ?? '');
    $typeLower = strtolower($before);
    $needsWiden = true;
    if (strpos($typeLower, 'varchar') === 0) {
        if (preg_match('/varchar\((\d+)\)/', $typeLower, $m) && (int) $m[1] >= 64) {
            $needsWiden = false;
        }
    } elseif (strpos($typeLower, 'char') === 0 || strpos($typeLower, 'text') !== false) {
        // CHAR(n) or TEXT family — still widen short CHAR; leave TEXT alone.
        if (strpos($typeLower, 'text') !== false) {
            $needsWiden = false;
        } elseif (preg_match('/char\((\d+)\)/', $typeLower, $m) && (int) $m[1] >= 64) {
            $needsWiden = false;
        }
    }

    if (!$needsWiden) {
        return ['changed' => false, 'before' => $before, 'after' => $before];
    }

    $conn->exec("ALTER TABLE `clients` MODIFY COLUMN `client_status` VARCHAR(64) NOT NULL DEFAULT 'New'");
    $conn->exec("UPDATE `clients` SET `client_status` = 'New' WHERE TRIM(COALESCE(`client_status`, '')) = ''");
    $afterCol = $conn->query("SHOW FULL COLUMNS FROM clients LIKE 'client_status'")->fetch(PDO::FETCH_ASSOC);
    return [
        'changed' => true,
        'before' => $before,
        'after' => (string) ($afterCol['Type'] ?? ''),
    ];
}
/** Return JSON instead of an empty body when a fatal error stops the script. */
function mahaverse_register_fatal_json_handler(): void {
    static $registered = false;
    if ($registered) {
        return;
    }
    $registered = true;
    register_shutdown_function(function () {
        $err = error_get_last();
        if (!$err || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            return;
        }
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
        }
        echo json_encode([
            'success' => false,
            'message' => $err['message'],
            'file' => basename($err['file'] ?? ''),
            'line' => $err['line'] ?? 0,
        ]);
    });
}

mahaverse_register_fatal_json_handler();

