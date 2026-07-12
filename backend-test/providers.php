<?php
// Providers master data API (CRUD)

require_once __DIR__ . '/db.php';


// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthReadWrite('manage_data.read', 'manage_data.write', 'mahaverse');



$conn->set_charset('utf8mb4');

function generateId()
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff)
    );
}

function normalizeOptionalText($value)
{
    if (!isset($value)) {
        return null;
    }

    $trimmed = trim((string)$value);
    return $trimmed === '' ? null : $trimmed;
}

function providers_edi_columns_exist(mysqli $conn): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = ['edi_payer' => false, 'technician_is_rendering_provider' => false];
    $r = @$conn->query('SHOW COLUMNS FROM `master_providers`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $f = (string)($row['Field'] ?? '');
            if ($f === 'edi_payer') {
                $cached['edi_payer'] = true;
            }
            if ($f === 'technician_is_rendering_provider') {
                $cached['technician_is_rendering_provider'] = true;
            }
        }
        $r->free();
    }
    return $cached;
}

function providers_normalize_yes_no($value): int
{
    if ($value === true || $value === 1 || $value === '1') {
        return 1;
    }
    $s = strtoupper(trim((string)$value));
    if ($s === 'YES' || $s === 'Y' || $s === 'TRUE') {
        return 1;
    }
    return 0;
}

function handleGetProviders($conn)
{
    $id = $_GET['id'] ?? null;
    $showArchived = isset($_GET['showArchived']) && $_GET['showArchived'] === 'true';

    $sql = "SELECT * FROM master_providers";
    if ($id) {
        $sql .= " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $id);
    } else {
        $sql .= " WHERE archived = ?";
        $archived = $showArchived ? 1 : 0;
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $archived);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch providers']);
        return;
    }

    $result = $stmt->get_result();
    $providers = [];
    while ($row = $result->fetch_assoc()) {
        $providers[] = $row;
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $providers]);
}

function handlePostProvider($conn, $input)
{
    $required = ['provider_name'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim($input[$field]) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
            return;
        }
    }

    $id = generateId();
    $provider_name = $input['provider_name'];
    $provider_code = normalizeOptionalText($input['provider_code'] ?? null);
    $email = $input['email'] ?? null;
    $phone = $input['phone'] ?? null;
    $fax = $input['fax'] ?? null;
    $address1 = $input['address1'] ?? null;
    $address2 = $input['address2'] ?? null;
    $city = $input['city'] ?? null;
    $state = $input['state'] ?? null;
    $country = $input['country'] ?? null;
    $zip_code = $input['zip_code'] ?? null;
    $status = $input['status'] ?? 'Active';
    $ediCols = providers_edi_columns_exist($conn);
    $ediPayer = providers_normalize_yes_no($input['edi_payer'] ?? 0);
    $technicianIsRendering = providers_normalize_yes_no($input['technician_is_rendering_provider'] ?? 0);

    $cols = 'id, provider_name, provider_code, email, phone, fax, address1, address2, city, state, country, zip_code, status';
    $placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
    $types = 'sssssssssssss';
    $params = [
        $id,
        $provider_name,
        $provider_code,
        $email,
        $phone,
        $fax,
        $address1,
        $address2,
        $city,
        $state,
        $country,
        $zip_code,
        $status,
    ];
    if ($ediCols['edi_payer']) {
        $cols .= ', edi_payer';
        $placeholders .= ', ?';
        $types .= 'i';
        $params[] = $ediPayer;
    }
    if ($ediCols['technician_is_rendering_provider']) {
        $cols .= ', technician_is_rendering_provider';
        $placeholders .= ', ?';
        $types .= 'i';
        $params[] = $technicianIsRendering;
    }

    $sql = "INSERT INTO master_providers ($cols) VALUES ($placeholders)";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param($types, ...$params);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create provider: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Provider created successfully', 'data' => ['id' => $id]]);
}

function handlePutProvider($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Provider id is required']);
        return;
    }

    $id = $input['id'];
    $provider_name = $input['provider_name'] ?? null;
    $provider_code = normalizeOptionalText($input['provider_code'] ?? null);
    $email = $input['email'] ?? null;
    $phone = $input['phone'] ?? null;
    $fax = $input['fax'] ?? null;
    $address1 = $input['address1'] ?? null;
    $address2 = $input['address2'] ?? null;
    $city = $input['city'] ?? null;
    $state = $input['state'] ?? null;
    $country = $input['country'] ?? null;
    $zip_code = $input['zip_code'] ?? null;
    $status = $input['status'] ?? null;
    $ediCols = providers_edi_columns_exist($conn);
    $ediPayer = providers_normalize_yes_no($input['edi_payer'] ?? 0);
    $technicianIsRendering = providers_normalize_yes_no($input['technician_is_rendering_provider'] ?? 0);

    $set = 'provider_name = ?, provider_code = ?, email = ?, phone = ?, fax = ?,
            address1 = ?, address2 = ?, city = ?, state = ?, country = ?, zip_code = ?,
            status = COALESCE(?, status)';
    $types = 'ssssssssssss';
    $params = [
        $provider_name,
        $provider_code,
        $email,
        $phone,
        $fax,
        $address1,
        $address2,
        $city,
        $state,
        $country,
        $zip_code,
        $status,
    ];
    if ($ediCols['edi_payer']) {
        $set .= ', edi_payer = ?';
        $types .= 'i';
        $params[] = $ediPayer;
    }
    if ($ediCols['technician_is_rendering_provider']) {
        $set .= ', technician_is_rendering_provider = ?';
        $types .= 'i';
        $params[] = $technicianIsRendering;
    }
    $params[] = $id;
    $types .= 's';

    $sql = "UPDATE master_providers SET $set WHERE id = ?";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param($types, ...$params);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update provider: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Provider updated successfully']);
}

function handleDeleteProvider($conn, $input)
{
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Provider id is required']);
        return;
    }

    $id = $input['id'];
    $stmt = $conn->prepare("UPDATE master_providers SET archived = 1 WHERE id = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare statement']);
        return;
    }

    $stmt->bind_param("s", $id);

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to archive provider: ' . $stmt->error]);
        $stmt->close();
        return;
    }

    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Provider archived successfully']);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        handleGetProviders($conn);
        break;
    case 'POST':
        handlePostProvider($conn, $input);
        break;
    case 'PUT':
        handlePutProvider($conn, $input);
        break;
    case 'DELETE':
        handleDeleteProvider($conn, $input);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}


