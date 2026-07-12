<?php
require_once __DIR__ . '/config.php';

// Only allow GET
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Authenticate (allow token query param)
$authUser = null;
$token = getBearerTokenFromRequest();
if (!$token) $token = getTokenFromCustomHeaders();
if ($token) $authUser = getAuthenticatedUserFromToken($token);
if (!$authUser && isAuthenticated()) {
    $authUser = [
        'id' => (int)$_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'role' => isset($_SESSION['role']) ? $_SESSION['role'] : 'staff',
        'via' => 'session'
    ];
}
if (!$authUser && isset($_GET['token']) && $_GET['token'] !== '') {
    $authUser = getAuthenticatedUserFromToken(trim((string)$_GET['token']));
}
if (!$authUser) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required']);
    exit;
}

$role = isset($authUser['role']) ? $authUser['role'] : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');
if (!$isAdminLike) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied']);
    exit;
}

// Load composer autoloader first
$autoload = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($autoload)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'vendor/autoload.php missing']);
    exit;
}
require_once $autoload;

// Load drive helper
if (!file_exists(__DIR__ . '/drive_helper.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'drive_helper.php missing']);
    exit;
}
require_once __DIR__ . '/drive_helper.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $enabled = (getenv('GOOGLE_DRIVE_ENABLED') === 'true' || getenv('GOOGLE_DRIVE_ENABLED') === '1');
    $authMode = getenv('GOOGLE_DRIVE_AUTH_MODE') ?: 'service_account';
    $rootFolderId = getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?: '';
    $useSharedDrive = isSharedDriveEnabled();

    // Best-effort connection diagnostics (without requiring Drive API calls)
    $connected = null;
    $oauthTokenPresent = null;
    $oauthDecryptOk = null;
    if ($authMode === 'oauth') {
        try {
            $conn = getDBConnection();
            $res = $conn->query("SELECT refresh_token_encrypted FROM GoogleDriveOAuthTokens WHERE id = 1 LIMIT 1");
            if ($res) {
                $row = $res->fetch_assoc();
                $oauthTokenPresent = (!empty($row['refresh_token_encrypted']));
            } else {
                $oauthTokenPresent = false;
            }
        } catch (Throwable $e) {
            $oauthTokenPresent = null;
        }
        if (function_exists('getDriveOAuthRefreshTokenFromDb')) {
            $rt = getDriveOAuthRefreshTokenFromDb();
            $oauthDecryptOk = !empty($rt);
        }
        $connected = ($oauthDecryptOk === true);
    } else {
        $saPath = getenv('GOOGLE_SERVICE_ACCOUNT_JSON');
        $saInline = getenv('GOOGLE_SERVICE_ACCOUNT_JSON_INLINE');
        $connected = (!empty($saInline) || (!empty($saPath) && file_exists($saPath)));
    }

    $client = getGoogleDriveClient();
    if (!$client) {
        throw new Exception('getGoogleDriveClient() returned null (most commonly: refresh token cannot be exchanged because GOOGLE_DRIVE_OAUTH_CLIENT_SECRET does not match the OAuth client that issued the refresh token).');
    }

    // Confirm we have an access token (otherwise Drive requests will look "unregistered")
    $tok = $client->getAccessToken();
    if (!is_array($tok) || empty($tok['access_token'])) {
        throw new Exception('OAuth client has no access_token after refresh. Fix GOOGLE_DRIVE_OAUTH_CLIENT_ID/SECRET mismatch.');
    }

    $drive = new Google\Service\Drive($client);

    $rootMeta = null;
    if ($rootFolderId !== '') {
        $rootMeta = $drive->files->get($rootFolderId, [
            'supportsAllDrives' => true,
            'fields' => 'id,name,mimeType,driveId,capabilities/canAddChildren',
        ]);
    }

    // Try to create a test folder under the root folder (or Drive root if rootFolderId is empty)
    $folderName = 'launchpad_debug_' . date('Ymd_His');
    $fileMetadata = new Google\Service\Drive\DriveFile([
        'name' => $folderName,
        'mimeType' => 'application/vnd.google-apps.folder',
    ]);
    if ($rootFolderId !== '') {
        $fileMetadata->setParents([$rootFolderId]);
    }

    $created = $drive->files->create($fileMetadata, [
        'supportsAllDrives' => true,
        'fields' => 'id,name,parents',
    ]);

    echo json_encode([
        'success' => true,
        'enabled' => $enabled,
        'auth_mode' => $authMode,
        'use_shared_drive' => $useSharedDrive,
        'root_folder_id' => $rootFolderId ?: null,
        'root_folder' => $rootMeta ? [
            'id' => $rootMeta->getId(),
            'name' => $rootMeta->getName(),
            'mimeType' => $rootMeta->getMimeType(),
            'driveId' => $rootMeta->getDriveId(),
        ] : null,
        'created_test_folder' => [
            'id' => $created->getId(),
            'name' => $created->getName(),
            'parents' => $created->getParents(),
        ],
        'message' => 'Drive access OK. Folder creation succeeded.',
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Drive debug failed: ' . $e->getMessage(),
        'error' => $e->getMessage(),
        'diagnostics' => [
            'GOOGLE_DRIVE_ENABLED' => getenv('GOOGLE_DRIVE_ENABLED'),
            'GOOGLE_DRIVE_AUTH_MODE' => getenv('GOOGLE_DRIVE_AUTH_MODE'),
            'GOOGLE_DRIVE_ROOT_FOLDER_ID_set' => (getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID') ? true : false),
            'use_shared_drive' => (function_exists('isSharedDriveEnabled') ? isSharedDriveEnabled() : null),
            'oauth_refresh_token_row_present' => isset($oauthTokenPresent) ? $oauthTokenPresent : null,
            'oauth_refresh_token_decrypt_ok' => isset($oauthDecryptOk) ? $oauthDecryptOk : null,
            'connected_guess' => isset($connected) ? $connected : null,
            'hint' => 'If Drive calls return 403 "unregistered callers", it usually means the refresh token could not be exchanged for an access token. Fix GOOGLE_DRIVE_OAUTH_CLIENT_SECRET in backend/.env to match the OAuth client that issued the refresh token.',
        ],
    ]);
}


