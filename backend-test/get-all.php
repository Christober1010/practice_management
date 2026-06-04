<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();

}
require_once __DIR__ . '/config.php';
$authUser = requireAuthAny(['clients.read', 'master_data.read'], 'mahaverse');



try {
    $host = "db5018419668.hosting-data.io";
    $user = "dbu1183438";
    $password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
    $database = "dbs14649042";

    $conn = new mysqli($host, $user, $password, $database);
    if ($conn->connect_error) {
        throw new Exception("Connection failed");
    }
    $conn->set_charset('utf8mb4');

    // --------- CLIENT NAME COLUMN RESOLUTION ----------
    $nameColumn = 'client_name'; // default
    $colsResult = $conn->query("SHOW COLUMNS FROM clients LIKE '%name%'");
    if ($colsResult && $colsResult->num_rows > 0) {
        $row = $colsResult->fetch_assoc();
        $nameColumn = $row['Field'];
    }

    // --------- MODULES ----------
    $sqlModules = "
        SELECT 
            cm.id,
            cm.client_id,
            cm.NAME,
            cm.description,
            cm.STATUS,
            cm.archived,
            cm.created_at,
            cm.updated_at,
            COALESCE(c.`$nameColumn`, 'Unknown Client') AS client_display_name
        FROM client_modules cm
        LEFT JOIN clients c ON cm.client_id = c.client_id
        ORDER BY client_display_name, cm.NAME
    ";

    $resultModules = $conn->query($sqlModules);
    if (!$resultModules) {
        throw new Exception('Modules query failed: ' . $conn->error);
    }

    $modules = [];
    while ($row = $resultModules->fetch_assoc()) {
        $modules[] = [
            'id'          => $row['id'],
            'client_id'   => $row['client_id'],
            'name'        => $row['NAME'] ?? 'Unnamed Module',
            'description' => $row['description'] ?? '',
            'status'      => $row['STATUS'] ?? 'Active',
            'archived'    => (bool)$row['archived'],
            'client_name' => $row['client_display_name'],
            'created_at'  => $row['created_at'],
            'updated_at'  => $row['updated_at']
        ];
    }

    // --------- DOMAINS ----------
    $domainModuleCol = null;
    $domainModuleColCheck = $conn->query("SHOW COLUMNS FROM client_domains LIKE 'module_id'");
    if ($domainModuleColCheck && $domainModuleColCheck->num_rows > 0) {
        $domainModuleCol = 'module_id';
    }

    $sqlDomains = "
        SELECT 
            d.id,
            d.client_id,
            " . ($domainModuleCol ? "d.`$domainModuleCol`," : "") . "
            d.NAME,
            d.description,
            d.STATUS,
            d.archived,
            d.created_at,
            d.updated_at
        FROM client_domains d
        ORDER BY d.NAME
    ";

    $resultDomains = $conn->query($sqlDomains);
    if (!$resultDomains) {
        throw new Exception('Domains query failed: ' . $conn->error);
    }

    $domains = [];
    while ($row = $resultDomains->fetch_assoc()) {
        $moduleId = $domainModuleCol ? ($row[$domainModuleCol] ?? null) : null;
        $domains[] = [
            'id'          => $row['id'],
            'client_id'   => $row['client_id'],
            'name'        => $row['NAME'] ?? 'Unnamed Domain',
            'description' => $row['description'] ?? '',
            'status'      => $row['STATUS'] ?? 'Active',
            'archived'    => (bool)$row['archived'],
            'module_id'   => $moduleId,
            'moduleId'    => $moduleId,
            'created_at'  => $row['created_at'],
            'updated_at'  => $row['updated_at']
        ];
    }

    // --------- PROGRAMS ----------
    $sqlPrograms = "
        SELECT 
            p.id,
            p.client_id,
            p.domain_id,
            p.NAME,
            p.description,
            p.STATUS,
            p.archived,
            p.created_at,
            p.updated_at
        FROM client_programs p
        ORDER BY p.NAME
    ";

    $resultPrograms = $conn->query($sqlPrograms);
    if (!$resultPrograms) {
        throw new Exception('Programs query failed: ' . $conn->error);
    }

    $programs = [];
    while ($row = $resultPrograms->fetch_assoc()) {
        $programs[] = [
            'id'          => $row['id'],
            'client_id'   => $row['client_id'],
            'domain_id'   => $row['domain_id'],
            'name'        => $row['NAME'] ?? 'Unnamed Program',
            'description' => $row['description'] ?? '',
            'status'      => $row['STATUS'] ?? 'Active',
            'archived'    => (bool)$row['archived'],
            'created_at'  => $row['created_at'],
            'updated_at'  => $row['updated_at']
        ];
    }

    // --------- TARGETS ----------
    $sqlTargets = "
        SELECT 
            t.id,
            t.client_id,
            t.program_id,
            t.NAME,
            t.goal_description,
            t.trials,
            t.activity_type,
            t.instructions,
            t.STATUS,
            t.archived,
            t.created_at,
            t.updated_at
        FROM client_targets t
        ORDER BY t.NAME
    ";

    $resultTargets = $conn->query($sqlTargets);
    if (!$resultTargets) {
        throw new Exception('Targets query failed: ' . $conn->error);
    }

    $targets = [];
    while ($row = $resultTargets->fetch_assoc()) {
        $targets[] = [
            'id'              => $row['id'],
            'client_id'       => $row['client_id'],
            'program_id'      => $row['program_id'],
            'name'            => $row['NAME'] ?? 'Unnamed Target',
            'goal_description'=> $row['goal_description'] ?? '',
            'trials'          => (int)$row['trials'],
            'activity_type'   => $row['activity_type'],
            'instructions'    => $row['instructions'],
            'status'          => $row['STATUS'] ?? 'Active',
            'archived'        => (bool)$row['archived'],
            'created_at'      => $row['created_at'],
            'updated_at'      => $row['updated_at']
        ];
    }

    // Attach tasks/prompts to targets if tables exist (non-breaking additive fields)
    $targetIds = array_map(function($t) { return $t['id']; }, $targets);

    // Tasks
    $tasksByActivity = [];
    if (!empty($targetIds)) {
        $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_tasks'");
        if ($tableCheck && $tableCheck->num_rows > 0) {
            $escapedIds = array_map([$conn, 'real_escape_string'], $targetIds);
            $idsList = "'" . implode("','", $escapedIds) . "'";

            $tasksQuery = "
                SELECT id, client_id, activity_id, name, step_order
                FROM client_target_tasks
                WHERE activity_id IN ($idsList)
                ORDER BY activity_id, step_order
            ";
            $tasksResult = $conn->query($tasksQuery);
            if ($tasksResult) {
                while ($task = $tasksResult->fetch_assoc()) {
                    $tasksByActivity[$task['activity_id']][] = [
                        'id' => $task['id'],
                        'activity_id' => $task['activity_id'],
                        'client_id' => $task['client_id'],
                        'name' => $task['name'],
                        'step_order' => (int)$task['step_order']
                    ];
                }
            }
        }
    }

    // Prompts
    $promptsByTarget = [];
    if (!empty($targetIds)) {
        $tableCheck = $conn->query("SHOW TABLES LIKE 'client_target_prompts'");
        if ($tableCheck && $tableCheck->num_rows > 0) {
            $columnCheck = $conn->query("SHOW COLUMNS FROM client_target_prompts LIKE 'prompt_id'");
            if ($columnCheck && $columnCheck->num_rows > 0) {
                $escapedIds = array_map([$conn, 'real_escape_string'], $targetIds);
                $idsList = "'" . implode("','", $escapedIds) . "'";

                $promptRes = $conn->query(
                    "SELECT tp.target_id, mp.id, mp.prompt_name, mp.max_score, mp.score_as_independent, mp.dtt, mp.ta, mp.maintenance, mp.status
                     FROM client_target_prompts tp
                     JOIN master_prompts mp ON tp.prompt_id = mp.id
                     WHERE tp.target_id IN ($idsList)
                     ORDER BY tp.target_id"
                );
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
                            'status' => $p['status']
                        ];
                    }
                }
            }
        }
    }

    // Merge into targets
    foreach ($targets as $i => $t) {
        $tid = $t['id'];
        $targets[$i]['tasks'] = $tasksByActivity[$tid] ?? [];
        $targets[$i]['prompts'] = $promptsByTarget[$tid] ?? [];
    }

    echo json_encode([
        'success'  => true,
        'modules'  => $modules,
        'domains'  => $domains,
        'programs' => $programs,
        'targets'  => $targets
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
} finally {
    if (isset($conn)) $conn->close();
}
?>
