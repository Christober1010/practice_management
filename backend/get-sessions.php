<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config.php';
$authUser = requireAuth('scheduling.read', 'mahaverse');

$host = 'db5018266079.hosting-data.io';
$user = 'dbu3321929';
$pass = 'M@h@B3h@v1or@lH3@lth4@ut1sm';
$db   = 'dbs14484433';

try {
    $conn = new mysqli($host, $user, $pass, $db);
    if ($conn->connect_error) {
        throw new Exception('Database connection failed');
    }
    $conn->set_charset('utf8mb4');

    $whereConditions = [];
    $params = [];
    $types = '';

    if (isset($_GET['client_id'])) {
        $whereConditions[] = 's.client_id = ?';
        $params[] = $_GET['client_id'];
        $types .= 's';
    }
    if (isset($_GET['provider_id'])) {
        $whereConditions[] = 's.provider_id = ?';
        $params[] = $_GET['provider_id'];
        $types .= 's';
    }
    if (isset($_GET['date'])) {
        $whereConditions[] = 'DATE(s.start_utc) = ?';
        $params[] = $_GET['date'];
        $types .= 's';
    }

    $sql = "
        SELECT s.*, CONCAT(c.first_name, ' ', c.last_name) AS clientName
        FROM sessions s
        LEFT JOIN clients c ON s.client_id = c.client_id
    ";
    if ($whereConditions) {
        $sql .= ' WHERE ' . implode(' AND ', $whereConditions);
    }
    $sql .= ' ORDER BY s.start_utc DESC';

    if ($params) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        $sessions = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    } else {
        $result = $conn->query($sql);
        if (!$result) {
            throw new Exception('Query failed: ' . $conn->error);
        }
        $sessions = $result->fetch_all(MYSQLI_ASSOC);
    }

    echo json_encode(['success' => true, 'sessions' => $sessions]);
    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
