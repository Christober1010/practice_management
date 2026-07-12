<?php
/**
 * Google Drive Helper for HIPAA-Compliant File Storage
 * 
 * This helper provides functions to upload, download, and manage files in Google Drive
 * using Service Account authentication with Domain-Wide Delegation.
 * 
 * Requirements:
 * - Google Workspace with BAA (Business Associate Agreement)
 * - Service Account with Domain-Wide Delegation enabled
 * - Google Drive API enabled in GCP project
 */
// IMPORTANT:
// Do NOT require vendor/autoload.php from inside this helper.
// Some entrypoints load this helper before loading Composer, and this helper used to
// require Composer which (via composer.json "autoload.files") could include this file again,
// causing: "Cannot redeclare function getGoogleDriveClient()".
//
// Entry points should require `../vendor/autoload.php` first, then `drive_helper.php`.

use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;

/**
 * Get Google Drive client (Service Account with Domain-Wide Delegation)
 * 
 * @return Client|null Returns configured Google Client or null on failure
 */
function getGoogleDriveClient() {
    static $client = null;
    
    if ($client !== null) {
        return $client;
    }
    
    // Check if Google Drive is enabled
    $driveEnabled = getenv('GOOGLE_DRIVE_ENABLED');
    if ($driveEnabled !== 'true' && $driveEnabled !== '1') {
        return null; // Drive integration disabled
    }
    
    try {
        $client = new Client();

        // Auth mode: service_account (recommended) OR oauth
        $authMode = getenv('GOOGLE_DRIVE_AUTH_MODE');
        if (!$authMode) $authMode = 'service_account';

        if ($authMode === 'oauth') {
            $oauthClientId = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_ID');
            $oauthClientSecret = getenv('GOOGLE_DRIVE_OAUTH_CLIENT_SECRET');
            if (empty($oauthClientId) || empty($oauthClientSecret)) {
                error_log("Google Drive: OAuth client id/secret not configured");
                return null;
            }

            $client->setClientId($oauthClientId);
            $client->setClientSecret($oauthClientSecret);

            $scopesEnv = getenv('GOOGLE_DRIVE_SCOPES');
            $scopes = $scopesEnv ? array_values(array_filter(array_map('trim', explode(',', $scopesEnv)))) : [];
            if (empty($scopes)) $scopes = ['https://www.googleapis.com/auth/drive.file'];
            $client->setScopes($scopes);

            $refreshToken = getDriveOAuthRefreshTokenFromDb();
            if (!$refreshToken) {
                error_log("Google Drive: OAuth refresh token not found in DB");
                return null;
            }

            // This will refresh access tokens on-demand.
            // IMPORTANT: If the refresh fails (e.g. invalid_client due to wrong secret),
            // Google\Client will not have a usable access token and Drive calls will look unauthenticated.
            $token = $client->fetchAccessTokenWithRefreshToken($refreshToken);
            if (is_array($token) && isset($token['error'])) {
                $err = (string)$token['error'];
                $desc = isset($token['error_description']) ? (string)$token['error_description'] : '';
                error_log("Google Drive: OAuth refresh failed: {$err}" . ($desc ? " — {$desc}" : ""));
                return null;
            }

            $access = $client->getAccessToken();
            if (!is_array($access) || empty($access['access_token'])) {
                error_log("Google Drive: OAuth refresh did not yield an access_token (check client id/secret match the refresh token's OAuth client)");
                return null;
            }
            return $client;
        }

        // -------------------------
        // Service Account (default)
        // -------------------------
        $serviceAccountJson = getenv('GOOGLE_SERVICE_ACCOUNT_JSON');
        $serviceAccountJsonInline = getenv('GOOGLE_SERVICE_ACCOUNT_JSON_INLINE');

        $jsonKey = null;
        if (!empty($serviceAccountJson) && file_exists($serviceAccountJson)) {
            $jsonKey = json_decode(file_get_contents($serviceAccountJson), true);
        } elseif (!empty($serviceAccountJsonInline)) {
            $jsonKey = json_decode($serviceAccountJsonInline, true);
        } else {
            error_log("Google Drive: Service account JSON not configured");
            return null;
        }

        if (!$jsonKey || !isset($jsonKey['type']) || $jsonKey['type'] !== 'service_account') {
            error_log("Google Drive: Invalid service account JSON");
            return null;
        }

        $client->setAuthConfig($jsonKey);

        $scopesEnv = getenv('GOOGLE_DRIVE_SCOPES');
        $scopes = $scopesEnv ? array_values(array_filter(array_map('trim', explode(',', $scopesEnv)))) : [];
        if (empty($scopes)) $scopes = ['https://www.googleapis.com/auth/drive'];
        $client->setScopes($scopes);

        $impersonateUser = getenv('GOOGLE_DRIVE_IMPERSONATE_USER');
        if (!empty($impersonateUser)) {
            $client->setSubject($impersonateUser);
        }

        return $client;
    } catch (Exception $e) {
        error_log("Google Drive client initialization failed: " . $e->getMessage());
        return null;
    }
}

// -----------------------------
// OAuth token storage (encrypted)
// -----------------------------

function driveCryptoKeyBytes(): ?string {
    $keyB64 = getenv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY');
    if (!$keyB64) return null;
    // Accept both standard base64 and base64url (some generators output -/_)
    $norm = strtr(trim((string)$keyB64), '-_', '+/');
    // Add padding if missing
    $rem = strlen($norm) % 4;
    if ($rem) $norm .= str_repeat('=', 4 - $rem);
    $raw = base64_decode($norm, true);
    if ($raw === false) return null;
    if (strlen($raw) !== 32) return null; // AES-256 key
    return $raw;
}

function encryptDriveSecret(string $plaintext): ?string {
    $key = driveCryptoKeyBytes();
    if (!$key) return null;
    if (!function_exists('openssl_encrypt')) return null;

    $iv = random_bytes(12); // GCM recommended IV size
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($ciphertext === false || $tag === '') return null;

    // payload = iv || tag || ciphertext (base64)
    return base64_encode($iv . $tag . $ciphertext);
}

function decryptDriveSecret(string $payloadB64): ?string {
    $key = driveCryptoKeyBytes();
    if (!$key) return null;
    if (!function_exists('openssl_decrypt')) return null;

    $raw = base64_decode($payloadB64, true);
    if ($raw === false || strlen($raw) < (12 + 16 + 1)) return null;
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $ciphertext = substr($raw, 28);

    $plaintext = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($plaintext === false) return null;
    return $plaintext;
}

function getDriveOAuthRefreshTokenFromDb(): ?string {
    if (!function_exists('getDBConnection')) return null;
    $conn = getDBConnection();
    if (!$conn) return null;

    $sql = "SELECT refresh_token_encrypted FROM GoogleDriveOAuthTokens WHERE id = 1 LIMIT 1";
    $res = $conn->query($sql);
    if (!$res) return null;
    $row = $res->fetch_assoc();
    if (!$row || empty($row['refresh_token_encrypted'])) return null;

    return decryptDriveSecret((string)$row['refresh_token_encrypted']);
}

/**
 * Sanitize a Google Drive folder ID from env (reject URLs, scopes, etc.).
 */
function sanitizeDriveFolderId($raw): ?string {
    $raw = trim((string)$raw);
    if ($raw === '') {
        return null;
    }
    if (preg_match('#^https?://#i', $raw)) {
        return null;
    }
    if (!preg_match('/^[A-Za-z0-9_-]{10,}$/', $raw)) {
        return null;
    }
    return $raw;
}

/**
 * Verify a Drive folder exists and can accept child files/folders.
 *
 * @throws Exception when the folder is missing or not writable
 */
function assertDriveFolderWritable(Drive $drive, string $folderId, string $label = 'folder'): void {
    try {
        $meta = $drive->files->get($folderId, [
            'supportsAllDrives' => true,
            'fields' => 'id,name,mimeType,trashed,capabilities/canAddChildren,driveId',
        ]);
    } catch (Exception $e) {
        throw new Exception(
            "Drive {$label} inaccessible ({$folderId}): " . $e->getMessage()
        );
    }

    if ($meta->getTrashed()) {
        throw new Exception("Drive {$label} is in trash ({$folderId}).");
    }

    $capabilities = $meta->getCapabilities();
    if ($capabilities && method_exists($capabilities, 'getCanAddChildren') && !$capabilities->getCanAddChildren()) {
        throw new Exception(
            "Drive {$label} does not allow creating subfolders ({$folderId}). "
            . 'Grant the linked Google account Editor/Content manager access to this folder or Shared Drive.'
        );
    }
}

/**
 * Get or create a folder in Google Drive
 *
 * @param string $folderName Name of the folder
 * @param string|null $parentFolderId Parent folder ID (null for root)
 * @param bool $useSharedDrive Whether to use Shared Drive (if configured)
 * @return string|null Folder ID or null on failure
 */
function getOrCreateDriveFolder($folderName, $parentFolderId = null, $useSharedDrive = false) {
    $client = getGoogleDriveClient();
    if (!$client) {
        return null;
    }

    $folderName = trim((string)$folderName);
    if ($folderName === '') {
        error_log('Google Drive folder creation failed: empty folder name');
        return null;
    }

    $parentFolderId = sanitizeDriveFolderId($parentFolderId);
    if (!$parentFolderId) {
        $parentFolderId = getDriveRootFolderId();
    }

    try {
        $drive = new Drive($client);

        if ($parentFolderId) {
            assertDriveFolderWritable($drive, $parentFolderId, 'parent folder');
        }

        // Build query to find existing folder
        $escapedName = str_replace("'", "\\'", $folderName);
        $query = "name = '" . $escapedName . "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
        if ($parentFolderId) {
            $query .= " and '" . addslashes($parentFolderId) . "' in parents";
        }

        $optParams = [
            'q' => $query,
            'fields' => 'files(id, name)',
            'spaces' => 'drive',
            'pageSize' => 1,
            'supportsAllDrives' => true,
            'includeItemsFromAllDrives' => true,
        ];

        $results = $drive->files->listFiles($optParams);

        if (count($results->getFiles()) > 0) {
            return $results->getFiles()[0]->getId();
        }

        $folderMetadata = new DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
        ]);

        if ($parentFolderId) {
            $folderMetadata->setParents([$parentFolderId]);
        }

        $folder = $drive->files->create($folderMetadata, [
            'supportsAllDrives' => true,
            'fields' => 'id,name,parents',
        ]);

        $createdId = $folder->getId();
        if (!$createdId) {
            throw new Exception('Drive API returned no folder id after create');
        }

        return $createdId;
    } catch (Exception $e) {
        $parentHint = $parentFolderId ? "parent={$parentFolderId}" : 'parent=(none)';
        error_log("Google Drive folder creation failed ({$parentHint}, name={$folderName}): " . $e->getMessage());
        return null;
    }
}

/**
 * Upload a file to Google Drive
 * 
 * @param string $filePath Local file path to upload
 * @param string $fileName Desired filename in Drive
 * @param string $mimeType MIME type of the file
 * @param string|null $parentFolderId Parent folder ID (null for root)
 * @param bool $useSharedDrive Whether to use Shared Drive
 * @return array|null Returns array with 'fileId', 'webViewLink', 'webContentLink' or null on failure
 */
function uploadFileToDrive($filePath, $fileName, $mimeType, $parentFolderId = null, $useSharedDrive = false) {
    $client = getGoogleDriveClient();
    if (!$client) {
        return null;
    }
    
    if (!file_exists($filePath)) {
        error_log("Google Drive upload: File not found: $filePath");
        return null;
    }
    
    try {
        $drive = new Drive($client);
        
        // Create file metadata
        $fileMetadata = new DriveFile([
            'name' => $fileName
        ]);
        
        // Set parent folder
        if ($parentFolderId) {
            $fileMetadata->setParents([$parentFolderId]);
        } else {
            $rootFolderId = getDriveRootFolderId();
            if ($rootFolderId) {
                $fileMetadata->setParents([$rootFolderId]);
            }
        }
        
        // Upload file
        $content = file_get_contents($filePath);
        $createParams = [
            'data' => $content,
            'mimeType' => $mimeType,
            'uploadType' => 'multipart',
            'fields' => 'id, name, webViewLink, webContentLink, size'
        ];
        
        // Always allow Shared Drive parents (safe for My Drive too; matches getOrCreateDriveFolder).
        $createParams['supportsAllDrives'] = true;
        
        $file = $drive->files->create($fileMetadata, $createParams);
        
        return [
            'fileId' => $file->getId(),
            'fileName' => $file->getName(),
            'webViewLink' => $file->getWebViewLink(),
            'webContentLink' => $file->getWebContentLink(),
            'size' => $file->getSize()
        ];
        
    } catch (Exception $e) {
        error_log("Google Drive upload failed: " . $e->getMessage());
        return null;
    }
}

/**
 * Upload file content (from memory/string) to Google Drive
 * 
 * @param string $fileContent File content as string
 * @param string $fileName Desired filename in Drive
 * @param string $mimeType MIME type of the file
 * @param string|null $parentFolderId Parent folder ID
 * @param bool $useSharedDrive Whether to use Shared Drive
 * @return array|null Returns array with 'fileId' and other metadata or null on failure
 */
function uploadFileContentToDrive($fileContent, $fileName, $mimeType, $parentFolderId = null, $useSharedDrive = false) {
    $client = getGoogleDriveClient();
    if (!$client) {
        return null;
    }
    
    try {
        $drive = new Drive($client);
        
        // Create file metadata
        $fileMetadata = new DriveFile([
            'name' => $fileName
        ]);
        
        // Set parent folder
        if ($parentFolderId) {
            $fileMetadata->setParents([$parentFolderId]);
        } else {
            $rootFolderId = getDriveRootFolderId();
            if ($rootFolderId) {
                $fileMetadata->setParents([$rootFolderId]);
            }
        }
        
        // Upload file content
        $createParams = [
            'data' => $fileContent,
            'mimeType' => $mimeType,
            'uploadType' => 'multipart',
            'fields' => 'id, name, webViewLink, webContentLink, size'
        ];
        
        // Always allow Shared Drive parents (safe for My Drive too; matches getOrCreateDriveFolder).
        $createParams['supportsAllDrives'] = true;
        
        $file = $drive->files->create($fileMetadata, $createParams);
        
        return [
            'fileId' => $file->getId(),
            'fileName' => $file->getName(),
            'webViewLink' => $file->getWebViewLink(),
            'webContentLink' => $file->getWebContentLink(),
            'size' => $file->getSize()
        ];
        
    } catch (Exception $e) {
        error_log("Google Drive upload (content) failed: " . $e->getMessage());
        return null;
    }
}

/**
 * Download file content from Google Drive by file ID
 * 
 * @param string $fileId Google Drive file ID
 * @param bool $useSharedDrive Whether file is in Shared Drive
 * @return string|null File content as string or null on failure
 */
function downloadFileFromDrive($fileId, $useSharedDrive = false) {
    $client = getGoogleDriveClient();
    if (!$client) {
        return null;
    }
    
    try {
        // Use HTTP client directly for better control
        $httpClient = $client->authorize();
        $uri = 'https://www.googleapis.com/drive/v3/files/' . urlencode($fileId) . '?alt=media';
        
        $options = [];
        if ($useSharedDrive) {
            $options['headers'] = [
                'SupportsAllDrives' => 'true'
            ];
        }
        
        $response = $httpClient->get($uri, $options);
        return $response->getBody()->getContents();
        
    } catch (Exception $e) {
        error_log("Google Drive download failed: " . $e->getMessage());
        return null;
    }
}

/**
 * Get file metadata from Google Drive
 * 
 * @param string $fileId Google Drive file ID
 * @param bool $useSharedDrive Whether file is in Shared Drive
 * @return array|null File metadata or null on failure
 */
function getDriveFileMetadata($fileId, $useSharedDrive = false) {
    $client = getGoogleDriveClient();
    if (!$client) {
        return null;
    }
    
    try {
        $drive = new Drive($client);
        
        $getParams = [
            'fields' => 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink'
        ];
        
        if ($useSharedDrive) {
            $getParams['supportsAllDrives'] = true;
        }
        
        $file = $drive->files->get($fileId, $getParams);
        
        return [
            'fileId' => $file->getId(),
            'name' => $file->getName(),
            'mimeType' => $file->getMimeType(),
            'size' => $file->getSize(),
            'createdTime' => $file->getCreatedTime(),
            'modifiedTime' => $file->getModifiedTime(),
            'webViewLink' => $file->getWebViewLink(),
            'webContentLink' => $file->getWebContentLink()
        ];
        
    } catch (Exception $e) {
        error_log("Google Drive metadata fetch failed: " . $e->getMessage());
        return null;
    }
}

/**
 * Check if Google Drive integration is enabled
 * 
 * @return bool
 */
function isGoogleDriveEnabled() {
    $enabled = getenv('GOOGLE_DRIVE_ENABLED');
    return ($enabled === 'true' || $enabled === '1');
}

/**
 * Get root folder ID from environment
 * 
 * @return string|null
 */
function getDriveRootFolderId() {
    return sanitizeDriveFolderId(getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID'));
}

/**
 * Check if Shared Drive is configured
 * 
 * @return bool
 */
function isSharedDriveEnabled() {
    $sharedDriveId = getenv('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    return !empty($sharedDriveId);
}

/**
 * Quick status helper for OAuth mode (used by UI endpoint)
 */
function isDriveOAuthConnected(): bool {
    $rt = getDriveOAuthRefreshTokenFromDb();
    return !empty($rt);
}

