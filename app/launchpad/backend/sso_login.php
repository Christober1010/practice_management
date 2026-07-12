<?php
// Launchpad SSO login endpoint.
// Purpose: mint a Launchpad AuthTokens token using a trusted upstream (Mahaverse) session/email.
//
// Request:
//   POST JSON: { "email": "user@domain.com" }
//   Header (optional): X-SSO-Secret: <shared-secret> when LAUNCHPAD_SSO_SECRET is set in backend/.env
//
// Response:
//   { success: true, token: "<rawToken>", user: {...}, expires_at: "YYYY-mm-dd HH:ii:ss" }

declare(strict_types=1);

try {
    require_once __DIR__ . '/config.php';

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        exit;
    }

    // Optional shared secret check (skipped when LAUNCHPAD_SSO_SECRET is unset)
    $expectedSecret = getenv('LAUNCHPAD_SSO_SECRET') ?: (getenv('SSO_SECRET') ?: '');
    if ($expectedSecret !== '') {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $provided = '';
        if (isset($headers['X-SSO-Secret'])) {
            $provided = $headers['X-SSO-Secret'];
        } elseif (isset($headers['x-sso-secret'])) {
            $provided = $headers['x-sso-secret'];
        } elseif (isset($_SERVER['HTTP_X_SSO_SECRET'])) {
            $provided = $_SERVER['HTTP_X_SSO_SECRET'];
        }

        if (!is_string($provided) || $provided === '' || !hash_equals($expectedSecret, $provided)) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            exit;
        }
    }

    $conn = getDBConnection();

    $input = json_decode(file_get_contents('php://input') ?: '', true);
    $emailRaw = is_array($input) ? ($input['email'] ?? '') : '';
    $email = trim((string) $emailRaw);

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid email is required']);
        exit;
    }

    $stmt = $conn->prepare('SELECT id, username, email, role, is_active FROM Users WHERE email = ? AND is_active = 1 LIMIT 1');
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error', 'detail' => $conn->error]);
        exit;
    }
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'User not found or inactive']);
        exit;
    }

    $rawToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $rawToken);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

    $conn->query("
        CREATE TABLE IF NOT EXISTS `AuthTokens` (
          `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          `user_id` INT UNSIGNED NOT NULL,
          `token_hash` CHAR(64) NOT NULL,
          `expires_at` DATETIME NOT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `last_used_at` TIMESTAMP NULL DEFAULT NULL,
          `revoked_at` TIMESTAMP NULL DEFAULT NULL,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uniq_token_hash` (`token_hash`),
          KEY `idx_user_id` (`user_id`),
          KEY `idx_expires_at` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $insert = $conn->prepare('INSERT INTO AuthTokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    if (!$insert) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create token', 'detail' => $conn->error]);
        exit;
    }
    $uid = (int) $user['id'];
    $insert->bind_param('iss', $uid, $tokenHash, $expiresAt);
    $ok = $insert->execute();
    if (!$ok) {
        $insertErr = $insert->error;
        $insert->close();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create token', 'detail' => $insertErr]);
        exit;
    }
    $insert->close();

    $permissions = [];
    try {
        if (function_exists('rbac_get_effective_permissions')) {
            $permissions = rbac_get_effective_permissions($user['role'], 'launchpad');
        }
    } catch (Throwable $e) {
        $permissions = [];
    }

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role'],
            'permissions' => $permissions,
        ],
        'token' => $rawToken,
        'expires_at' => $expiresAt,
    ]);
} catch (Throwable $e) {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    error_log('sso_login.php: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'SSO login failed',
        'detail' => $e->getMessage(),
    ]);
}
