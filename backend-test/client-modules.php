<?php
// Set CORS headers at the very start
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database connection
$host = "db5018419668.hosting-data.io";
$user = "dbu1183438";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14649042";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

$conn->set_charset('utf8mb4');

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

try {
    if ($method === 'GET') {
        handleGet($conn);
    } elseif ($method === 'POST') {
        handlePost($conn, $input);
    } elseif ($method === 'PUT') {
        handlePut($conn, $input);
    } elseif ($method === 'DELETE') {
        handleDelete($conn, $input);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    $conn->close();
}

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

function handleGet($conn)
{
    $clientId = $_GET['client_id'] ?? null;
    
    if (!$clientId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }

    $clientId = $conn->real_escape_string($clientId);

    // Fetch modules
    $modules = [];
    $moduleQuery = "SELECT * FROM client_modules WHERE client_id = '$clientId' ORDER BY created_at DESC";
    $moduleResult = $conn->query($moduleQuery);
    while ($row = $moduleResult->fetch_assoc()) {
        $modules[] = $row;
    }

    // Fetch domains
    $domains = [];
    $domainQuery = "SELECT * FROM client_domains WHERE client_id = '$clientId' ORDER BY created_at DESC";
    $domainResult = $conn->query($domainQuery);
    while ($row = $domainResult->fetch_assoc()) {
        $domains[] = $row;
    }

    // Fetch programs
    $programs = [];
    $programQuery = "SELECT * FROM client_programs WHERE client_id = '$clientId' ORDER BY created_at DESC";
    $programResult = $conn->query($programQuery);
    while ($row = $programResult->fetch_assoc()) {
        $programs[] = $row;
    }

    // Fetch targets/activities
    $activities = [];
    $activityQuery = "SELECT * FROM client_targets WHERE client_id = '$clientId' ORDER BY created_at DESC";
    $activityResult = $conn->query($activityQuery);
    while ($row = $activityResult->fetch_assoc()) {
        $activities[] = $row;
    }

    // Fetch prompts for all targets
    $promptsByTarget = [];
    if (!empty($activities)) {
        $targetIds = array_map(function($act) { return $act['id']; }, $activities);
        $escapedIds = array_map([$conn, 'real_escape_string'], $targetIds);
        $idsList = "'" . implode("','", $escapedIds) . "'";

        $promptQuery = "
            SELECT tp.target_id, mp.id, mp.prompt_name, mp.max_score, 
                   mp.score_as_independent, mp.dtt, mp.ta, mp.maintenance
            FROM client_target_prompts tp
            JOIN master_prompts mp ON tp.prompt_id = mp.id
            WHERE tp.target_id IN ($idsList)
            ORDER BY tp.target_id, tp.prompt_order
        ";
        $promptResult = $conn->query($promptQuery);
        while ($p = $promptResult->fetch_assoc()) {
            $promptsByTarget[$p['target_id']][] = [
                'id' => $p['id'],
                'prompt_name' => $p['prompt_name'],
                'max_score' => $p['max_score'],
                'score_as_independent' => $p['score_as_independent'],
                'dtt' => $p['dtt'],
                'ta' => $p['ta'],
                'maintenance' => $p['maintenance']
            ];
        }
    }

    // Add prompts to activities
    foreach ($activities as &$activity) {
        $activity['prompts'] = $promptsByTarget[$activity['id']] ?? [];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'modules' => $modules,
            'domains' => $domains,
            'programs' => $programs,
            'activities' => $activities
        ]
    ]);
}

function handlePost($conn, $input)
{
    if (!$input || !isset($input['client_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }

    $clientId = $conn->real_escape_string($input['client_id']);

    // Handle archive/restore for modules
    if (isset($input['moduleId']) && isset($input['archived'])) {
        $moduleId = $conn->real_escape_string($input['moduleId']);
        $archived = (int)$input['archived'];
        $status = $conn->real_escape_string($input['status'] ?? ($archived ? 'Inactive' : 'Active'));

        $query = "UPDATE client_modules SET archived = $archived, status = '$status' WHERE id = '$moduleId' AND client_id = '$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Module updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle archive/restore for domains
    if (isset($input['domainId']) && isset($input['archived'])) {
        $domainId = $conn->real_escape_string($input['domainId']);
        $archived = (int)$input['archived'];
        $status = $conn->real_escape_string($input['status'] ?? ($archived ? 'Inactive' : 'Active'));

        $query = "UPDATE client_domains SET archived = $archived, status = '$status' WHERE id = '$domainId' AND client_id = '$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Domain updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle archive/restore for programs
    if (isset($input['programId']) && isset($input['archived'])) {
        $programId = $conn->real_escape_string($input['programId']);
        $archived = (int)$input['archived'];
        $status = $conn->real_escape_string($input['status'] ?? ($archived ? 'Inactive' : 'Active'));

        $query = "UPDATE client_programs SET archived = $archived, status = '$status' WHERE id = '$programId' AND client_id = '$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Program updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle bulk insert/update
    $conn->begin_transaction();
    try {
        // Insert/Update Modules
        if (isset($input['modules']) && is_array($input['modules'])) {
            foreach ($input['modules'] as $module) {
                $id = $conn->real_escape_string($module['id']);
                $name = $conn->real_escape_string($module['name']);
                $description = $conn->real_escape_string($module['description'] ?? '');
                $status = $conn->real_escape_string($module['status'] ?? 'Active');
                $archived = (int)($module['archived'] ?? 0);

                $query = "INSERT INTO client_modules (id, client_id, name, description, status, archived) 
                          VALUES ('$id', '$clientId', '$name', '$description', '$status', $archived)
                          ON DUPLICATE KEY UPDATE name='$name', description='$description', status='$status', archived=$archived";
                if (!$conn->query($query)) {
                    throw new Exception("Error saving module: " . $conn->error);
                }
            }
        }

        // Insert/Update Domains
        if (isset($input['domains']) && is_array($input['domains'])) {
            foreach ($input['domains'] as $domain) {
                $id = $conn->real_escape_string($domain['id']);
                $moduleId = $conn->real_escape_string($domain['moduleId']);
                $name = $conn->real_escape_string($domain['name']);
                $description = $conn->real_escape_string($domain['description'] ?? '');
                $status = $conn->real_escape_string($domain['status'] ?? 'Active');
                $archived = (int)($domain['archived'] ?? 0);

                $query = "INSERT INTO client_domains (id, client_id, module_id, name, description, status, archived) 
                          VALUES ('$id', '$clientId', '$moduleId', '$name', '$description', '$status', $archived)
                          ON DUPLICATE KEY UPDATE module_id='$moduleId', name='$name', description='$description', status='$status', archived=$archived";
                if (!$conn->query($query)) {
                    throw new Exception("Error saving domain: " . $conn->error);
                }
            }
        }

        // Insert/Update Programs
        if (isset($input['programs']) && is_array($input['programs'])) {
            foreach ($input['programs'] as $program) {
                $id = $conn->real_escape_string($program['id']);
                $domainId = $conn->real_escape_string($program['domainId']);
                $name = $conn->real_escape_string($program['name']);
                $description = $conn->real_escape_string($program['description'] ?? '');
                $status = $conn->real_escape_string($program['status'] ?? 'Active');
                $archived = (int)($program['archived'] ?? 0);

                $query = "INSERT INTO client_programs (id, client_id, domain_id, name, description, status, archived) 
                          VALUES ('$id', '$clientId', '$domainId', '$name', '$description', '$status', $archived)
                          ON DUPLICATE KEY UPDATE domain_id='$domainId', name='$name', description='$description', status='$status', archived=$archived";
                if (!$conn->query($query)) {
                    throw new Exception("Error saving program: " . $conn->error);
                }
            }
        }

        // Insert/Update Activities
        if (isset($input['activities']) && is_array($input['activities'])) {
            foreach ($input['activities'] as $activity) {
                $id = $conn->real_escape_string($activity['id']);
                $programId = $conn->real_escape_string($activity['programId']);
                $name = $conn->real_escape_string($activity['name']);
                $goalDescription = $conn->real_escape_string($activity['goalDescription'] ?? '');
                $trials = (int)($activity['trials'] ?? 1);
                $activityType = $conn->real_escape_string($activity['activityType'] ?? '');
                $instructions = $conn->real_escape_string($activity['instructions'] ?? '');
                $status = $conn->real_escape_string($activity['status'] ?? 'Active');
                $archived = (int)($activity['archived'] ?? 0);

                $query = "INSERT INTO client_targets 
                    (id, client_id, program_id, name, goal_description, trials, activity_type, instructions, status, archived)
                    VALUES ('$id', '$clientId', '$programId', '$name', '$goalDescription', $trials, '$activityType', '$instructions', '$status', $archived)
                    ON DUPLICATE KEY UPDATE 
                    program_id='$programId', name='$name', goal_description='$goalDescription', 
                    trials=$trials, activity_type='$activityType', instructions='$instructions', 
                    status='$status', archived=$archived";
                
                if (!$conn->query($query)) {
                    throw new Exception("Error saving activity: " . $conn->error);
                }

                // Save prompt associations
                if (isset($activity['prompts']) && is_array($activity['prompts'])) {
                    saveTargetPrompts($conn, $id, $activity['prompts']);
                }
            }
        }

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Data saved successfully']);
    } catch (Exception $e) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function saveTargetPrompts($conn, $targetId, $promptIds)
{
    // Delete existing associations
    $stmt = $conn->prepare("DELETE FROM client_target_prompts WHERE target_id = ?");
    $stmt->bind_param("s", $targetId);
    $stmt->execute();
    $stmt->close();

    if (empty($promptIds)) {
        return;
    }

    // Insert new associations
    $stmt = $conn->prepare(
        "INSERT INTO client_target_prompts (id, target_id, prompt_id, prompt_order) VALUES (?, ?, ?, ?)"
    );

    foreach ($promptIds as $idx => $prompt) {
        $assocId = generateId();
        $promptId = is_array($prompt) ? $prompt['id'] : $prompt;
        $order = $idx;

        $stmt->bind_param("sssi", $assocId, $targetId, $promptId, $order);
        $stmt->execute();
    }
    $stmt->close();
}

function handlePut($conn, $input)
{
    if (!$input || !isset($input['client_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }

    $clientId = $conn->real_escape_string($input['client_id']);

    // Update module
    if (isset($input['moduleId']) && !isset($input['domainId']) && !isset($input['programId'])) {
        $moduleId = $conn->real_escape_string($input['moduleId']);
        $name = $conn->real_escape_string($input['name'] ?? '');
        $description = $conn->real_escape_string($input['description'] ?? '');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');
        $archived = (int)($input['archived'] ?? 0);

        $query = "UPDATE client_modules SET name='$name', description='$description', status='$status', archived=$archived 
                  WHERE id='$moduleId' AND client_id='$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Module updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Update domain
    if (isset($input['domainId']) && !isset($input['programId'])) {
        $domainId = $conn->real_escape_string($input['domainId']);
        $moduleId = $conn->real_escape_string($input['moduleId'] ?? '');
        $name = $conn->real_escape_string($input['name'] ?? '');
        $description = $conn->real_escape_string($input['description'] ?? '');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');
        $archived = (int)($input['archived'] ?? 0);

        $query = "UPDATE client_domains SET module_id='$moduleId', name='$name', description='$description', status='$status', archived=$archived 
                  WHERE id='$domainId' AND client_id='$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Domain updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Update program
    if (isset($input['programId']) && !isset($input['activityId'])) {
        $programId = $conn->real_escape_string($input['programId']);
        $domainId = $conn->real_escape_string($input['domainId'] ?? '');
        $name = $conn->real_escape_string($input['name'] ?? '');
        $description = $conn->real_escape_string($input['description'] ?? '');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');
        $archived = (int)($input['archived'] ?? 0);

        $query = "UPDATE client_programs SET domain_id='$domainId', name='$name', description='$description', status='$status', archived=$archived 
                  WHERE id='$programId' AND client_id='$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Program updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Update activity
    if (isset($input['activityId'])) {
        $conn->begin_transaction();
        try {
            $activityId = $conn->real_escape_string($input['activityId']);
            $programId = $conn->real_escape_string($input['programId'] ?? '');
            $name = $conn->real_escape_string($input['name'] ?? '');
            $goalDescription = $conn->real_escape_string($input['goalDescription'] ?? '');
            $trials = (int)($input['trials'] ?? 1);
            $activityType = $conn->real_escape_string($input['activityType'] ?? '');
            $instructions = $conn->real_escape_string($input['instructions'] ?? '');
            $status = $conn->real_escape_string($input['status'] ?? 'Active');
            $archived = (int)($input['archived'] ?? 0);

            $query = "UPDATE client_targets SET 
                program_id='$programId', name='$name', goal_description='$goalDescription', 
                trials=$trials, activity_type='$activityType', instructions='$instructions', 
                status='$status', archived=$archived 
                WHERE id='$activityId' AND client_id='$clientId'";

            if (!$conn->query($query)) {
                throw new Exception("Error updating activity: " . $conn->error);
            }

            if (isset($input['prompts'])) {
                saveTargetPrompts($conn, $activityId, $input['prompts']);
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Activity updated']);
        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        return;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
}

function handleDelete($conn, $input)
{
    if (!$input || !isset($input['client_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Client ID is required']);
        return;
    }

    $clientId = $conn->real_escape_string($input['client_id']);

    if (isset($input['moduleId'])) {
        $id = $conn->real_escape_string($input['moduleId']);
        $query = "DELETE FROM client_modules WHERE id = '$id' AND client_id = '$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Module deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    if (isset($input['domainId'])) {
        $id = $conn->real_escape_string($input['domainId']);
        $query = "DELETE FROM client_domains WHERE id = '$id' AND client_id = '$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Domain deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    if (isset($input['programId'])) {
        $id = $conn->real_escape_string($input['programId']);
        $query = "DELETE FROM client_programs WHERE id = '$id' AND client_id = '$clientId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Program deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    if (isset($input['activityId'])) {
        $conn->begin_transaction();
        try {
            $id = $conn->real_escape_string($input['activityId']);
            
            // Delete prompt associations
            $conn->query("DELETE FROM client_target_prompts WHERE target_id = '$id'");
            
            // Delete activity
            $query = "DELETE FROM client_targets WHERE id = '$id' AND client_id = '$clientId'";
            if (!$conn->query($query)) {
                throw new Exception($conn->error);
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Activity deleted']);
        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        return;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
}
?>