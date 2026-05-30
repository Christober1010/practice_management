<?php
// Set CORS headers at the very start
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

// Handle OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database connection
$host = "db5018266079.hosting-data.io";
$user = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

$conn->set_charset('utf8mb4');

function ensureClientCanonicalDomainModule($conn, $clientId, $moduleId)
{
    $canonical = [
        'skill-acquisition' => 'Skill Acquisition',
        'behaviour-reduction' => 'Behaviour Reduction',
    ];
    if (!isset($canonical[$moduleId])) {
        return;
    }
    $id = $conn->real_escape_string($moduleId);
    $cid = $conn->real_escape_string($clientId);
    $name = $conn->real_escape_string($canonical[$moduleId]);
    $conn->query("INSERT INTO client_modules (id, client_id, name, description, status, archived)
                  VALUES ('$id', '$cid', '$name', '', 'Active', 0)
                  ON DUPLICATE KEY UPDATE name='$name'");
}

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

function detectFirstExistingColumn($conn, $tableName, $candidates)
{
    foreach ($candidates as $col) {
        $colEsc = $conn->real_escape_string($col);
        $tableEsc = $conn->real_escape_string($tableName);
        $res = $conn->query("SHOW COLUMNS FROM `$tableEsc` LIKE '$colEsc'");
        if ($res && $res->num_rows > 0) {
            return $col;
        }
    }
    return null;
}

function saveActivityTasks($conn, $clientId, $activityId, $tasks)
{
    // Check if table exists first
    $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_tasks'");
    if (!$tableCheck || $tableCheck->num_rows === 0) {
        // Table doesn't exist, skip task saving
        return;
    }

    // Delete existing tasks for this activity
    $stmt_delete = $conn->prepare("DELETE FROM client_target_tasks WHERE activity_id = ? AND client_id = ?");
    if ($stmt_delete) {
        $stmt_delete->bind_param("ss", $activityId, $clientId);
        if (!$stmt_delete->execute()) {
            throw new Exception("Failed to delete existing tasks: " . $stmt_delete->error);
        }
        $stmt_delete->close();
    }

    if (empty($tasks)) {
        return;
    }

    usort($tasks, function ($a, $b) {
        $oa = (int)($a['step_order'] ?? $a['sequence'] ?? 0);
        $ob = (int)($b['step_order'] ?? $b['sequence'] ?? 0);
        return $oa <=> $ob;
    });

    $escapedClientId = $conn->real_escape_string($clientId);
    $escapedActivityId = $conn->real_escape_string($activityId);
    $fallbackOrder = 0;

    foreach ($tasks as $task) {
        $task_id = generateId();
        $task_name = $conn->real_escape_string($task['name'] ?? '');
        if ($task_name === '') {
            continue;
        }
        $explicitOrder = (int)($task['step_order'] ?? $task['sequence'] ?? 0);
        $step_order = $explicitOrder > 0 ? $explicitOrder : ($fallbackOrder + 1);
        $fallbackOrder = max($fallbackOrder, $step_order);

        $query = "INSERT INTO client_target_tasks (id, client_id, activity_id, name, step_order) VALUES ('$task_id', '$escapedClientId', '$escapedActivityId', '$task_name', $step_order)";
        if (!$conn->query($query)) {
            throw new Exception("Failed to insert task: " . $conn->error);
        }
    }
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

    // Master Prompts – available prompt options for UI (master/global)
    $allPrompts = [];
    $promptResult = $conn->query("SELECT * FROM master_prompts WHERE status = 'Active' ORDER BY prompt_name");
    if ($promptResult) {
        while ($prompt = $promptResult->fetch_assoc()) {
            $allPrompts[] = $prompt;
        }
    }

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
        if (!empty($row['module_id'])) {
            $row['moduleId'] = $row['module_id'];
        }
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
    $rawActivities = [];
    $activityIds = [];
    $activityQuery = "SELECT * FROM client_targets WHERE client_id = '$clientId' ORDER BY created_at DESC";
    $activityResult = $conn->query($activityQuery);
    while ($row = $activityResult->fetch_assoc()) {
        $rawActivities[$row['id']] = $row;
        $activityIds[] = $row['id'];
    }

    // Fetch prompt associations for all activities (if schema supports it)
    $promptsByTarget = [];
    if (!empty($activityIds)) {
        $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_prompts'");
        if ($tableCheck && $tableCheck->num_rows > 0) {
            $targetCol = detectFirstExistingColumn($conn, 'client_target_prompts', ['target_id', 'targetId']);
            $promptCol = detectFirstExistingColumn($conn, 'client_target_prompts', ['prompt_id', 'promptId']);
            $orderCol  = detectFirstExistingColumn($conn, 'client_target_prompts', ['prompt_order', 'promptOrder', 'prompt_sequence', 'sequence']);

            if ($targetCol && $promptCol) {
                $escapedIds = array_map([$conn, 'real_escape_string'], $activityIds);
                $idsList = "'" . implode("','", $escapedIds) . "'";
                
                $orderByClause = $orderCol 
                    ? "ORDER BY tp.`$targetCol`, tp.`$orderCol`"
                    : "ORDER BY tp.`$targetCol`";

                $promptQuery = "
                    SELECT tp.`$targetCol` AS target_id, mp.id, mp.prompt_name, mp.max_score, mp.score_as_independent, mp.dtt, mp.ta, mp.maintenance, mp.status
                    FROM client_target_prompts tp
                    JOIN master_prompts mp ON tp.`$promptCol` = mp.id
                    WHERE tp.`$targetCol` IN ($idsList)
                    $orderByClause
                ";
                $promptRes = $conn->query($promptQuery);
                if ($promptRes) {
                    while ($p = $promptRes->fetch_assoc()) {
                        $promptsByTarget[$p['target_id']][] = [
                            'id' => $p['id'],
                            'prompt_name' => $p['prompt_name'],
                            'max_score' => $p['max_score'],
                            'score_as_independent' => $p['score_as_independent'],
                            'dtt' => $p['dtt'],
                            'ta' => $p['ta'],
                            'maintenance' => $p['maintenance'],
                            'status' => $p['status'],
                        ];
                    }
                }
            }
        }
    }

    // Fetch tasks for all activities
    $tasksByActivity = [];
    if (!empty($activityIds)) {
        $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_tasks'");
        if ($tableCheck && $tableCheck->num_rows > 0) {
            $escapedIds = array_map([$conn, 'real_escape_string'], $activityIds);
            $idsList = "'" . implode("','", $escapedIds) . "'";
            
            $tasksQuery = "
                SELECT id, activity_id, name, step_order
                FROM client_target_tasks
                WHERE activity_id IN ($idsList) AND client_id = '$clientId'
                ORDER BY activity_id, step_order
            ";
            $tasksResult = $conn->query($tasksQuery);
            if ($tasksResult) {
                while ($task = $tasksResult->fetch_assoc()) {
                    $tasksByActivity[$task['activity_id']][] = [
                        'id' => $task['id'],
                        'activity_id' => $task['activity_id'],
                        'name' => $task['name'],
                        'step_order' => $task['step_order']
                    ];
                }
            }
        }
    }

    // Merge tasks into activities
    $finalActivities = [];
    foreach ($rawActivities as $act) {
        $act['prompts'] = $promptsByTarget[$act['id']] ?? [];
        $act['tasks'] = $tasksByActivity[$act['id']] ?? [];
        $finalActivities[] = $act;
    }

    $behaviors = [];
    require_once __DIR__ . '/behavior_helpers.php';
    if (br_table_exists($conn, 'client_behaviors')) {
        $behaviors = br_fetch_client_behaviors($conn, $clientId);
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'modules' => $modules,
            'domains' => $domains,
            'programs' => $programs,
            'activities' => $finalActivities,
            'behaviors' => $behaviors,
            'allPrompts' => $allPrompts
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
                $moduleId = $conn->real_escape_string($domain['moduleId'] ?? $domain['module_id'] ?? '');
                $name = $conn->real_escape_string($domain['name']);
                $description = $conn->real_escape_string($domain['description'] ?? '');
                $status = $conn->real_escape_string($domain['status'] ?? 'Active');
                $archived = (int)($domain['archived'] ?? 0);

                if ($moduleId !== '') {
                    ensureClientCanonicalDomainModule($conn, $clientId, $moduleId);
                    $query = "INSERT INTO client_domains (id, client_id, module_id, name, description, status, archived) 
                              VALUES ('$id', '$clientId', '$moduleId', '$name', '$description', '$status', $archived)
                              ON DUPLICATE KEY UPDATE module_id='$moduleId', name='$name', description='$description', status='$status', archived=$archived";
                } else {
                    $query = "INSERT INTO client_domains (id, client_id, name, description, status, archived) 
                              VALUES ('$id', '$clientId', '$name', '$description', '$status', $archived)
                              ON DUPLICATE KEY UPDATE name='$name', description='$description', status='$status', archived=$archived";
                }
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

                // Save prompt associations (skip if table doesn't exist)
                if (isset($activity['prompts']) && is_array($activity['prompts']) && !empty($activity['prompts'])) {
                    try {
                        saveTargetPrompts($conn, $id, $activity['prompts']);
                    } catch (Exception $promptErr) {
                        // Log but don't fail the entire operation if prompt saving fails
                        error_log("Warning: Failed to save prompts for target $id: " . $promptErr->getMessage());
                    }
                }

                // Save tasks for Task Analysis types
                $tasks = $activity['tasks'] ?? [];
                $is_task_analysis = ($activityType === 'Task Analysis');
                if ($is_task_analysis) {
                    try {
                        saveActivityTasks($conn, $clientId, $id, $tasks);
                    } catch (Exception $taskErr) {
                        // Log but don't fail the entire operation if task saving fails
                        error_log("Warning: Failed to save tasks for target $id: " . $taskErr->getMessage());
                    }
                } else {
                    // Clear tasks for non-Task Analysis activities
                    try {
                        saveActivityTasks($conn, $clientId, $id, []);
                    } catch (Exception $taskErr) {
                        // Log but don't fail the entire operation if task clearing fails
                        error_log("Warning: Failed to clear tasks for target $id: " . $taskErr->getMessage());
                    }
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
    // Check if table exists first
    $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_prompts'");
    if (!$tableCheck || $tableCheck->num_rows === 0) {
        // Table doesn't exist, skip prompt saving
        return;
    }
    
    // Detect column names to avoid schema mismatches
    $targetCol = detectFirstExistingColumn($conn, 'client_target_prompts', ['target_id', 'targetId']);
    $promptCol = detectFirstExistingColumn($conn, 'client_target_prompts', ['prompt_id', 'promptId']);
    $orderCol  = detectFirstExistingColumn($conn, 'client_target_prompts', ['prompt_order', 'promptOrder', 'prompt_sequence', 'sequence']);
    $textCol   = detectFirstExistingColumn($conn, 'client_target_prompts', ['prompt_text', 'promptText']);

    if (!$targetCol || !$promptCol) {
        // Required columns don't exist, skip
        return;
    }

    try {
        // Delete existing associations
        $stmt = $conn->prepare("DELETE FROM client_target_prompts WHERE `$targetCol` = ?");
        if ($stmt) {
            $stmt->bind_param("s", $targetId);
            $stmt->execute();
            $stmt->close();
        }

        if (empty($promptIds)) {
            return;
        }

        // Insert new associations
        $orderInsertCol = $orderCol ? "`$orderCol`" : null;
        $textInsertCol = $textCol ? "`$textCol`" : null;

        if ($orderInsertCol && $textInsertCol) {
            $sql = "INSERT INTO client_target_prompts (id, `$targetCol`, `$promptCol`, $textInsertCol, $orderInsertCol) VALUES (?, ?, ?, ?, ?)";
        } elseif ($orderInsertCol && !$textInsertCol) {
            $sql = "INSERT INTO client_target_prompts (id, `$targetCol`, `$promptCol`, $orderInsertCol) VALUES (?, ?, ?, ?)";
        } elseif (!$orderInsertCol && $textInsertCol) {
            $sql = "INSERT INTO client_target_prompts (id, `$targetCol`, `$promptCol`, $textInsertCol) VALUES (?, ?, ?, ?)";
        } else {
            $sql = "INSERT INTO client_target_prompts (id, `$targetCol`, `$promptCol`) VALUES (?, ?, ?)";
        }
        $stmt = $conn->prepare($sql);

        if (!$stmt) {
            throw new Exception("Failed to prepare statement: " . $conn->error);
        }

        foreach ($promptIds as $idx => $prompt) {
            $assocId = generateId();
            $promptId = is_array($prompt) ? ($prompt['id'] ?? null) : $prompt;
            $promptText = is_array($prompt) ? ($prompt['prompt_name'] ?? ($prompt['prompt_text'] ?? '')) : '';
            
            if (!$promptId) {
                continue; // Skip if no valid prompt ID
            }
            
            $order = $idx;

            if ($orderInsertCol && $textInsertCol) {
                $stmt->bind_param("ssssi", $assocId, $targetId, $promptId, $promptText, $order);
            } elseif ($orderInsertCol && !$textInsertCol) {
                $stmt->bind_param("sssi", $assocId, $targetId, $promptId, $order);
            } elseif (!$orderInsertCol && $textInsertCol) {
                $stmt->bind_param("ssss", $assocId, $targetId, $promptId, $promptText);
            } else {
                $stmt->bind_param("sss", $assocId, $targetId, $promptId);
            }

            if (!$stmt->execute()) {
                throw new Exception("Failed to insert prompt association: " . $stmt->error);
            }
        }
        $stmt->close();
    } catch (Exception $e) {
        // Re-throw so caller can handle it
        throw $e;
    }
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
        $moduleId = $conn->real_escape_string($input['moduleId'] ?? $input['module_id'] ?? '');
        $name = $conn->real_escape_string($input['name'] ?? '');
        $description = $conn->real_escape_string($input['description'] ?? '');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');
        $archived = (int)($input['archived'] ?? 0);

        if ($moduleId !== '') {
            ensureClientCanonicalDomainModule($conn, $clientId, $moduleId);
            $query = "UPDATE client_domains SET module_id='$moduleId', name='$name', description='$description', status='$status', archived=$archived
                      WHERE id='$domainId' AND client_id='$clientId'";
        } else {
            $query = "UPDATE client_domains SET name='$name', description='$description', status='$status', archived=$archived
                      WHERE id='$domainId' AND client_id='$clientId'";
        }
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

            if (isset($input['prompts']) && is_array($input['prompts']) && !empty($input['prompts'])) {
                try {
                    saveTargetPrompts($conn, $activityId, $input['prompts']);
                } catch (Exception $promptErr) {
                    // Log but don't fail the entire operation if prompt saving fails
                    error_log("Warning: Failed to save prompts for target $activityId: " . $promptErr->getMessage());
                }
            }

            // Update tasks
            $tasks = $input['tasks'] ?? [];
            $is_task_analysis = ($activityType === 'Task Analysis');
            if ($is_task_analysis) {
                try {
                    saveActivityTasks($conn, $clientId, $activityId, $tasks);
                } catch (Exception $taskErr) {
                    // Log but don't fail the entire operation if task saving fails
                    error_log("Warning: Failed to save tasks for target $activityId: " . $taskErr->getMessage());
                }
            } else {
                // Clear tasks for non-Task Analysis activities
                try {
                    saveActivityTasks($conn, $clientId, $activityId, []);
                } catch (Exception $taskErr) {
                    // Log but don't fail the entire operation if task clearing fails
                    error_log("Warning: Failed to clear tasks for target $activityId: " . $taskErr->getMessage());
                }
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

    $clientId = (int)$input['client_id']; // Cast to integer for safety

    if (isset($input['moduleId'])) {
        $id = (int)$input['moduleId']; // Cast to integer for safety
        $stmt = $conn->prepare("DELETE FROM client_modules WHERE id = ? AND client_id = ?");
        $stmt->bind_param("ii", $id, $clientId);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Module deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        $stmt->close();
        return;
    }

    if (isset($input['domainId'])) {
        $id = (int)$input['domainId']; // Cast to integer for safety
        $stmt = $conn->prepare("DELETE FROM client_domains WHERE id = ? AND client_id = ?");
        $stmt->bind_param("ii", $id, $clientId);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Domain deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        $stmt->close();
        return;
    }

    if (isset($input['programId'])) {
        $id = (int)$input['programId']; // Cast to integer for safety
        $stmt = $conn->prepare("DELETE FROM client_programs WHERE id = ? AND client_id = ?");
        $stmt->bind_param("ii", $id, $clientId);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Program deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        $stmt->close();
        return;
    }

    if (isset($input['activityId'])) {
        $conn->begin_transaction();
        try {
            $id = (int)$input['activityId']; // Cast to integer for safety
            
            // Delete prompt associations (only if table exists)
            $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_prompts'");
            if ($tableCheck && $tableCheck->num_rows > 0) {
                $stmt = $conn->prepare("DELETE FROM client_target_prompts WHERE target_id = ?");
                $stmt->bind_param("i", $id);
                $stmt->execute();
                $stmt->close();
            }
            
            // Delete task associations (only if table exists)
            $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_tasks'");
            if ($tableCheck && $tableCheck->num_rows > 0) {
                $stmt = $conn->prepare("DELETE FROM client_target_tasks WHERE activity_id = ? AND client_id = ?");
                $stmt->bind_param("ii", $id, $clientId);
                $stmt->execute();
                $stmt->close();
            }
            
            // Delete activity (CASCADE will handle related records if foreign keys are set up)
            $stmt = $conn->prepare("DELETE FROM client_targets WHERE id = ? AND client_id = ?");
            $stmt->bind_param("ii", $id, $clientId);
            if (!$stmt->execute()) {
                throw new Exception($conn->error);
            }
            $stmt->close();

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