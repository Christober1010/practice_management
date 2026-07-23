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
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';
$authUser = requireAuthReadWrite('master_data.read', 'master_data.write', 'mahaverse');



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

function saveActivityTasks($conn, $activity_id, $tasks)
{
    $stmt_delete = $conn->prepare("DELETE FROM master_target_tasks WHERE activity_id = ?");
    $stmt_delete->bind_param("s", $activity_id);
    if (!$stmt_delete->execute()) {
        throw new Exception("Failed to delete existing tasks: " . $stmt_delete->error);
    }
    $stmt_delete->close();

    if (empty($tasks)) {
        return;
    }

    $step_order = 0;
    foreach ($tasks as $task) {
        $task_id = generateId();
        $task_name = $conn->real_escape_string($task['name']);

        $query = "INSERT INTO master_target_tasks (id, activity_id, name, step_order) VALUES ('$task_id', '$activity_id', '$task_name', $step_order)";
        if (!$conn->query($query)) {
            throw new Exception("Failed to insert task: " . $conn->error);
        }
        $step_order++;
    }
}

function saveActivityPrompts($conn, $target_id, $prompts)
{
    $stmt_delete = $conn->prepare("DELETE FROM master_prompts WHERE target_id = ?");
    $stmt_delete->bind_param("s", $target_id);
    if (!$stmt_delete->execute()) {
        throw new Exception("Failed to delete existing prompts: " . $stmt_delete->error);
    }
    $stmt_delete->close();

    if (empty($prompts)) {
        return;
    }

    $prompt_order = 0;
    foreach ($prompts as $prompt) {
        $prompt_id = generateId();
        $prompt_text = $conn->real_escape_string($prompt['text'] ?? $prompt);
        $status = $conn->real_escape_string($prompt['status'] ?? 'Active');

        $query = "INSERT INTO master_prompts (id, target_id, prompt_text, prompt_order, status) VALUES ('$prompt_id', '$target_id', '$prompt_text', $prompt_order, '$status')";
        if (!$conn->query($query)) {
            throw new Exception("Failed to insert prompt: " . $conn->error);
        }
        $prompt_order++;
    }
}

function saveTargetPrompts($conn, $target_id, $prompt_ids)
{
    // Delete existing associations
    $stmt_delete = $conn->prepare("DELETE FROM master_target_prompts WHERE target_id = ?");
    $stmt_delete->bind_param("s", $target_id);
    if (!$stmt_delete->execute()) {
        throw new Exception("Failed to delete existing prompt associations: " . $stmt_delete->error);
    }
    $stmt_delete->close();

    if (empty($prompt_ids)) {
        return;
    }

    // Insert new prompt associations (linking to master_prompts by ID)
    $stmt = $conn->prepare(
        "INSERT INTO master_target_prompts (id, target_id, prompt_id, prompt_text, prompt_order, status)
     VALUES (?, ?, ?, ?, ?, 'Active')"
    );


    foreach ($prompt_ids as $idx => $prompt) {
        $assoc_id = generateId();
        $prompt_id = $conn->real_escape_string(is_array($prompt) ? $prompt['id'] : $prompt);
        $prompt_text = $conn->real_escape_string(is_array($prompt) ? ($prompt['prompt_name'] ?? '') : '');
        $order = $idx;

        $stmt->bind_param("ssssi", $assoc_id, $target_id, $prompt_id, $prompt_text, $order);
        if (!$stmt->execute()) {
            throw new Exception("Failed to insert prompt association: " . $stmt->error);
        }
    }
    $stmt->close();
}

function handleGet($conn)
{
    /* -------------------------------------------------
       1. Modules / Domains / Programs – unchanged
       ------------------------------------------------- */
    $modules  = $domains = $programs = [];

    $result = $conn->query("SELECT * FROM master_modules ORDER BY created_at DESC");
    while ($row = $result->fetch_assoc()) $modules[] = $row;

    $result = $conn->query("SELECT * FROM master_domains ORDER BY created_at DESC");
    while ($row = $result->fetch_assoc()) $domains[] = $row;

    $result = $conn->query("SELECT * FROM master_programs ORDER BY created_at DESC");
    while ($row = $result->fetch_assoc()) $programs[] = $row;

    /* -------------------------------------------------
       2. Master Prompts – fetch all available prompts
       ------------------------------------------------- */
    $allPrompts = [];
    $promptResult = $conn->query("SELECT * FROM master_prompts WHERE status = 'Active' ORDER BY prompt_name");
    while ($prompt = $promptResult->fetch_assoc()) {
        $allPrompts[] = $prompt;
    }

    /* -------------------------------------------------
       3. Tasks – group by activity_id
       ------------------------------------------------- */
    $all_tasks_by_activity = [];
    $tasks_result = $conn->query("
        SELECT id, activity_id, name, step_order
        FROM master_target_tasks
        ORDER BY activity_id, step_order
    ");
    while ($task = $tasks_result->fetch_assoc()) {
        $all_tasks_by_activity[$task['activity_id']][] = [
            'id'          => $task['id'],
            'activity_id' => $task['activity_id'],
            'name'        => $task['name'],
            'step_order'  => $task['step_order']
        ];
    }

    /* -------------------------------------------------
       4. Activities – fetch raw rows
       ------------------------------------------------- */
    $rawActivities = [];
    $activityIds   = [];

    $activityResult = $conn->query("SELECT * FROM master_targets ORDER BY created_at DESC");
    while ($act = $activityResult->fetch_assoc()) {
        $rawActivities[$act['id']] = $act;
        $activityIds[] = $act['id'];
    }

    /* -------------------------------------------------
       5. Target Prompts – fetch associations for each target
       ------------------------------------------------- */
    $promptsByTarget = [];
    if (!empty($activityIds)) {
        $escaped = array_map([$conn, 'real_escape_string'], $activityIds);
        $idsList = "'" . implode("','", $escaped) . "'";

        $promptRes = $conn->query(
            "SELECT tp.target_id, mp.id, mp.prompt_name, mp.max_score, mp.score_as_independent, mp.dtt, mp.ta, mp.maintenance
             FROM master_target_prompts tp
             JOIN master_prompts mp ON tp.prompt_id = mp.id
             WHERE tp.target_id IN ($idsList)
             ORDER BY tp.target_id, tp.prompt_order"
        );

        while ($p = $promptRes->fetch_assoc()) {
            $promptsByTarget[$p['target_id']][] = [
                'id'                  => $p['id'],
                'prompt_name'         => $p['prompt_name'],
                'max_score'           => $p['max_score'],
                'score_as_independent' => $p['score_as_independent'],
                'dtt'                 => $p['dtt'],
                'ta'                  => $p['ta'],
                'maintenance'         => $p['maintenance']
            ];
        }
    }

    /* -------------------------------------------------
       6. Merge everything into the final array
       ------------------------------------------------- */
    $finalActivities = [];
    foreach ($rawActivities as $act) {
        $act['prompts'] = $promptsByTarget[$act['id']] ?? [];
        $act['tasks']   = $all_tasks_by_activity[$act['id']] ?? [];
        $finalActivities[] = $act;
    }

    /* -------------------------------------------------
       7. Return JSON
       ------------------------------------------------- */
    echo json_encode([
        'success' => true,
        'data'    => [
            'modules'      => $modules,
            'domains'      => $domains,
            'programs'     => $programs,
            'activities'   => $finalActivities,
            'allPrompts'   => $allPrompts
        ]
    ]);
}

function handlePost($conn, $input)
{
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid input']);
        return;
    }
    
    // MODULE ARCHIVE/RESTORE
    if (isset($input['moduleId']) && isset($input['archived'])) {
        $moduleId = $conn->real_escape_string($input['moduleId']);
        $archived = (int)$input['archived'];
        $status = $conn->real_escape_string($input['status'] ?? 'Active');

        $query = "UPDATE master_modules SET archived = $archived, status = '$status' WHERE id = '$moduleId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Module updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // DOMAIN ARCHIVE/RESTORE
    if (isset($input['domainId']) && isset($input['archived'])) {
        $domainId = $conn->real_escape_string($input['domainId']);
        $archived = (int)$input['archived'];
        $status = $conn->real_escape_string($input['status'] ?? ($archived ? 'Inactive' : 'Active'));

        $query = "UPDATE master_domains SET archived = $archived, status = '$status' WHERE id = '$domainId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Domain updated']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }
    if (isset($input['modules']) || isset($input['domains']) || isset($input['programs']) || isset($input['activities'])) {
        $conn->begin_transaction();

        try {
            if (isset($input['modules']) && is_array($input['modules'])) {
                foreach ($input['modules'] as $module) {
                    $id = $conn->real_escape_string($module['id']);
                    $name = $conn->real_escape_string($module['name']);
                    $description = $conn->real_escape_string($module['description'] ?? '');
                    $status = $conn->real_escape_string($module['status'] ?? 'Active');
                    $archived = (int)($module['archived'] ?? 0);

                    $query = "INSERT INTO master_modules (id, name, description, status, archived) 
                              VALUES ('$id', '$name', '$description', '$status', $archived)
                              ON DUPLICATE KEY UPDATE name='$name', description='$description', status='$status', archived=$archived";
                    if (!$conn->query($query)) {
                        throw new Exception("Error inserting module: " . $conn->error);
                    }
                }
            }

            if (isset($input['domains']) && is_array($input['domains'])) {
                foreach ($input['domains'] as $domain) {
                    $id = $conn->real_escape_string($domain['id']);
                    $moduleId = $conn->real_escape_string($domain['moduleId']);
                    $name = $conn->real_escape_string($domain['name']);
                    $description = $conn->real_escape_string($domain['description'] ?? '');
                    $status = $conn->real_escape_string($domain['status'] ?? 'Active');
                    $archived = (int)($domain['archived'] ?? 0);

                    $query = "INSERT INTO master_domains (id, module_id, name, description, status, archived) 
                              VALUES ('$id', '$moduleId', '$name', '$description', '$status', $archived)
                              ON DUPLICATE KEY UPDATE module_id='$moduleId', name='$name', description='$description', status='$status', archived=$archived";
                    if (!$conn->query($query)) {
                        throw new Exception("Error inserting domain: " . $conn->error);
                    }
                }
            }

            if (isset($input['programs']) && is_array($input['programs'])) {
                foreach ($input['programs'] as $program) {
                    $id = $conn->real_escape_string($program['id']);
                    $domainId = $conn->real_escape_string($program['domainId']);
                    $name = $conn->real_escape_string($program['name']);
                    $description = $conn->real_escape_string($program['description'] ?? '');
                    $status = $conn->real_escape_string($program['status'] ?? 'Active');
                    $archived = (int)($program['archived'] ?? 0);

                    $query = "INSERT INTO master_programs (id, domain_id, name, description, status, archived) 
                              VALUES ('$id', '$domainId', '$name', '$description', '$status', $archived)
                              ON DUPLICATE KEY UPDATE domain_id='$domainId', name='$name', description='$description', status='$status', archived=$archived";
                    if (!$conn->query($query)) {
                        throw new Exception("Error inserting program: " . $conn->error);
                    }
                }
            }

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

                    $query = "INSERT INTO master_targets 
                (id, program_id, name, goal_description, trials, activity_type,
                 instructions, status, archived)
              VALUES 
                ('$id','$programId','$name','$goalDescription',$trials,
                 '$activityType','$instructions','$status',$archived)
              ON DUPLICATE KEY UPDATE
                program_id='$programId', name='$name',
                goal_description='$goalDescription', trials=$trials,
                activity_type='$activityType', instructions='$instructions',
                status='$status', archived=$archived";

                    if (!$conn->query($query)) {
                        throw new Exception("Error inserting activity: " . $conn->error);
                    }

                    $prompt_ids = $activity['prompts'] ?? [];
                    if (!empty($prompt_ids)) {
                        saveTargetPrompts($conn, $id, $prompt_ids);
                    } else {
                        saveTargetPrompts($conn, $id, []);
                    }

                    // Save tasks for Task Analysis types
                    $tasks = $activity['tasks'] ?? [];
                    $is_task_analysis = ($activityType === 'Task Analysis');
                    if ($is_task_analysis) {
                        saveActivityTasks($conn, $id, $tasks);
                    } else {
                        saveActivityTasks($conn, $id, []);
                    }
                }
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Program structure saved successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        return;
    }

    if (
        isset($input['prompts']) && is_array($input['prompts']) &&
        !isset($input['modules']) && !isset($input['domains']) &&
        !isset($input['programs']) && !isset($input['activities'])
    ) {

        $conn->begin_transaction();
        try {
            foreach ($input['prompts'] as $prompt) {
                $id = $conn->real_escape_string($prompt['id']);
                $prompt_name = $conn->real_escape_string($prompt['prompt_name']);
                $maxScoreRaw = $prompt['max_score'] ?? null;
                $max_score_sql = ($maxScoreRaw === null || $maxScoreRaw === '')
                    ? 'NULL'
                    : ("'" . $conn->real_escape_string((string) $maxScoreRaw) . "'");
                $score_as_independent = $conn->real_escape_string($prompt['score_as_independent'] ?? '0');
                $dtt = $conn->real_escape_string($prompt['dtt'] ?? '0');
                $ta = $conn->real_escape_string($prompt['ta'] ?? '0');
                $maintenance = $conn->real_escape_string($prompt['maintenance'] ?? '0');
                $status = $conn->real_escape_string($prompt['status'] ?? 'Active');

                $query = "
                    INSERT INTO master_prompts 
                        (id, prompt_name, max_score, score_as_independent, dtt, ta, maintenance, status)
                    VALUES 
                        ('$id', '$prompt_name', $max_score_sql, '$score_as_independent', '$dtt', '$ta', '$maintenance', '$status')
                    ON DUPLICATE KEY UPDATE
                        prompt_name='$prompt_name', 
                        max_score=$max_score_sql,
                        score_as_independent='$score_as_independent',
                        dtt='$dtt',
                        ta='$ta',
                        maintenance='$maintenance',
                        status='$status'
                ";

                if (!$conn->query($query)) {
                    throw new Exception("Error inserting prompt: " . $conn->error);
                }
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Prompt(s) saved successfully']);
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

function handlePut($conn, $input)
{
    // Validate input exists
    if (!$input || empty($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid input - no data received']);
        return;
    }

    // Handle module updates (moduleId format from frontend)
    if (isset($input['moduleId'])) {
        $moduleId = $conn->real_escape_string($input['moduleId']);
        $name = $conn->real_escape_string($input['name'] ?? '');
        $description = $conn->real_escape_string($input['description'] ?? '');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');
        $archived = (int)($input['archived'] ?? 0);

        $query = "UPDATE master_modules SET name='$name', description='$description', status='$status', archived=$archived WHERE id='$moduleId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Module updated successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle domain updates (domainId format from frontend)
    if (isset($input['domainId']) && !isset($input['programs'])) {
        $domainId = $conn->real_escape_string($input['domainId']);
        $moduleId = $conn->real_escape_string($input['moduleId'] ?? '');
        $name = $conn->real_escape_string($input['name'] ?? '');
        $description = $conn->real_escape_string($input['description'] ?? '');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');
        $archived = (int)($input['archived'] ?? 0);

        $query = "UPDATE master_domains SET module_id='$moduleId', name='$name', description='$description', status='$status', archived=$archived WHERE id='$domainId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Domain updated successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle program updates (programId format from frontend)
    if (isset($input['programId']) && !isset($input['activities'])) {
        $programId = $conn->real_escape_string($input['programId']);
        $domainId = $conn->real_escape_string($input['domainId'] ?? '');
        $name = $conn->real_escape_string($input['name'] ?? '');
        $description = $conn->real_escape_string($input['description'] ?? '');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');
        $archived = (int)($input['archived'] ?? 0);

        $query = "UPDATE master_programs SET domain_id='$domainId', name='$name', description='$description', status='$status', archived=$archived WHERE id='$programId'";
        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Program updated successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle activity updates (activityId format from frontend)
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

            $query = "UPDATE master_targets SET 
                program_id='$programId', 
                name='$name', 
                goal_description='$goalDescription', 
                trials=$trials, 
                activity_type='$activityType', 
                instructions='$instructions', 
                status='$status', 
                archived=$archived 
                WHERE id='$activityId'";

            if (!$conn->query($query)) {
                throw new Exception("Error updating activity: " . $conn->error);
            }

            // Update prompts
            $prompt_ids = $input['prompts'] ?? [];
            saveTargetPrompts($conn, $activityId, $prompt_ids);

            // Update tasks
            $tasks = $input['tasks'] ?? [];
            $is_task_analysis = ($activityType === 'Task Analysis');
            if ($is_task_analysis) {
                saveActivityTasks($conn, $activityId, $tasks);
            } else {
                saveActivityTasks($conn, $activityId, []);
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Activity updated successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        return;
    }

    // Handle prompt updates (promptId format from frontend)
    if (isset($input['promptId'])) {
        $promptId = $conn->real_escape_string($input['promptId']);
        $prompt_name = $conn->real_escape_string($input['prompt_name'] ?? '');
        $maxScoreRaw = $input['max_score'] ?? null;
        $max_score_sql = ($maxScoreRaw === null || $maxScoreRaw === '')
            ? 'NULL'
            : ("'" . $conn->real_escape_string((string) $maxScoreRaw) . "'");
        $score_as_independent = $conn->real_escape_string($input['score_as_independent'] ?? '0');
        $dtt = $conn->real_escape_string($input['dtt'] ?? '0');
        $ta = $conn->real_escape_string($input['ta'] ?? '0');
        $maintenance = $conn->real_escape_string($input['maintenance'] ?? '0');
        $status = $conn->real_escape_string($input['status'] ?? 'Active');

        $query = "UPDATE master_prompts SET 
            prompt_name='$prompt_name', 
            max_score=$max_score_sql,
            score_as_independent='$score_as_independent',
            dtt='$dtt',
            ta='$ta',
            maintenance='$maintenance',
            status='$status'
            WHERE id='$promptId'";

        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Prompt updated successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle bulk updates (same as POST for backward compatibility)
    handlePost($conn, $input);
}

function handleDelete($conn, $input)
{
    // Handle moduleId format
    if (isset($input['moduleId'])) {
        $id = $conn->real_escape_string($input['moduleId']);
        $query = "DELETE FROM master_modules WHERE id = '$id'";

        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Module deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle domainId format
    if (isset($input['domainId'])) {
        $id = $conn->real_escape_string($input['domainId']);
        $query = "DELETE FROM master_domains WHERE id = '$id'";

        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Domain deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle programId format
    if (isset($input['programId'])) {
        $id = $conn->real_escape_string($input['programId']);
        $query = "DELETE FROM master_programs WHERE id = '$id'";

        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Program deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Handle activityId format
    if (isset($input['activityId'])) {
        $conn->begin_transaction();
        try {
            $id = $conn->real_escape_string($input['activityId']);

            // Delete associated tasks
            $query = "DELETE FROM master_target_tasks WHERE activity_id = '$id'";
            $conn->query($query);

            // Delete associated prompt associations
            $query = "DELETE FROM master_target_prompts WHERE target_id = '$id'";
            $conn->query($query);

            // Delete the activity itself
            $query = "DELETE FROM master_targets WHERE id = '$id'";
            if (!$conn->query($query)) {
                throw new Exception("Error deleting activity: " . $conn->error);
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Activity deleted successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        return;
    }

    // Handle promptId format
    if (isset($input['promptId'])) {
        $conn->begin_transaction();
        try {
            $id = $conn->real_escape_string($input['promptId']);

            // Delete associations in master_target_prompts
            $query = "DELETE FROM master_target_prompts WHERE prompt_id = '$id'";
            $conn->query($query);

            // Delete the prompt itself
            $query = "DELETE FROM master_prompts WHERE id = '$id'";
            if (!$conn->query($query)) {
                throw new Exception("Error deleting prompt: " . $conn->error);
            }

            $conn->commit();
            echo json_encode(['success' => true, 'message' => 'Prompt deleted successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        return;
    }

    // Handle taskId format
    if (isset($input['taskId'])) {
        $id = $conn->real_escape_string($input['taskId']);
        $query = "DELETE FROM master_target_tasks WHERE id = '$id'";

        if ($conn->query($query)) {
            echo json_encode(['success' => true, 'message' => 'Task deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
        }
        return;
    }

    // Fallback to old format with id and type
    if (isset($input['id']) && isset($input['type'])) {
        $id = $conn->real_escape_string($input['id']);
        $type = $conn->real_escape_string($input['type']);

        $tableMap = [
            'module' => 'master_modules',
            'domain' => 'master_domains',
            'program' => 'master_programs',
            'activity' => 'master_targets',
            'prompt' => 'master_prompts',
            'task' => 'master_target_tasks'
        ];

        if (!isset($tableMap[$type])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid type']);
            return;
        }

        $table = $tableMap[$type];

        // Handle cascading deletes for activities and prompts
        if ($type === 'activity') {
            $conn->begin_transaction();
            try {
                $conn->query("DELETE FROM master_target_tasks WHERE activity_id = '$id'");
                $conn->query("DELETE FROM master_target_prompts WHERE target_id = '$id'");
                $query = "DELETE FROM $table WHERE id = '$id'";
                if (!$conn->query($query)) {
                    throw new Exception($conn->error);
                }
                $conn->commit();
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
                return;
            }
        } elseif ($type === 'prompt') {
            $conn->begin_transaction();
            try {
                $conn->query("DELETE FROM master_target_prompts WHERE prompt_id = '$id'");
                $query = "DELETE FROM $table WHERE id = '$id'";
                if (!$conn->query($query)) {
                    throw new Exception($conn->error);
                }
                $conn->commit();
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
                return;
            }
        } else {
            $query = "DELETE FROM $table WHERE id = '$id'";
            if (!$conn->query($query)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $conn->error]);
                return;
            }
        }

        echo json_encode(['success' => true, 'message' => ucfirst($type) . ' deleted successfully']);
        return;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
}
