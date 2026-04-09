<?php
require_once __DIR__ . '/config.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$authUser = requireUser();
$role = isset($authUser['role']) ? strtolower((string)$authUser['role']) : 'staff';
$isAdminLike = ($role === 'admin' || $role === 'hr');
$isStaffLike = ($role === 'staff' || $role === 'employee');

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) $payload = $_POST;

$staffId = isset($payload['staff_id']) ? (int)$payload['staff_id'] : 0;
if ($staffId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'staff_id is required']);
    exit;
}

$conn = getDBConnection();

// Authorization:
// - admin/hr: allowed
// - staff: only allowed for staff entries they created
if (!$isAdminLike) {
    if ($isStaffLike) {
        $uid = isset($authUser['id']) ? (int)$authUser['id'] : 0;
        $ownStmt = $conn->prepare("SELECT created_by_user_id FROM Staff WHERE staff_id = ? LIMIT 1");
        if (!$ownStmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'DB error']);
            exit;
        }
        $ownStmt->bind_param("i", $staffId);
        $ownStmt->execute();
        $res = $ownStmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $ownStmt->close();

        $createdBy = $row ? (int)$row['created_by_user_id'] : 0;
        if ($createdBy <= 0 || $createdBy !== $uid) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied']);
            exit;
        }
    } else {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        exit;
    }
}

// Generate share key (base64url, ~32 chars)
$raw = random_bytes(24);
$token = rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
$tokenHash = hash('sha256', $token);
$tokenPrefix = substr($token, 0, 8);

try {
    $stmt = $conn->prepare("
        INSERT INTO StaffShareKeys
            (staff_id, token_hash, token_prefix, created_by_user_id, created_by_username, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 36 HOUR))
    ");
    if (!$stmt) {
        throw new Exception("SQL prepare failed: " . $conn->error);
    }

    $createdById = isset($authUser['id']) ? (int)$authUser['id'] : 0;
    $createdByUsername = isset($authUser['username']) ? (string)$authUser['username'] : null;

    $stmt->bind_param(
        "issis",
        $staffId,
        $tokenHash,
        $tokenPrefix,
        $createdById,
        $createdByUsername
    );

    if (!$stmt->execute()) {
        throw new Exception("Share key insert failed: " . $stmt->error);
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'share_key' => $token,
        'expires_at' => date('c', strtotime('+36 hours'))
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    $conn->close();
}

