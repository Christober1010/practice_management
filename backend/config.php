<?php
/**
 * Backend Configuration File
 * Loads environment variables from .env file for Google Drive integration
 */

// Load environment variables from backend/.env (Google Drive config, etc.)
// - In production: prefer real environment variables (recommended).
// - For local/dev: copy `backend/env.example` -> `backend/.env` and fill real values.
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
 * Get database connection (mysqli) for Mahaverse backend
 * Used by OAuth callback and other Drive-related endpoints
 */
function getDBConnection() {
    static $conn = null;

    if ($conn !== null) {
        return $conn;
    }

    $host = "db5018266079.hosting-data.io";
    $dbname = "dbs14484433";
    $user = "dbu3321929";
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

    $sql = "
        SELECT u.id, u.email AS username, u.role
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

function requireUser() {
    $user = getAuthenticatedUser();
    if (!$user) {
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
