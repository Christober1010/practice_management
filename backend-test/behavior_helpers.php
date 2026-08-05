<?php
/** Shared helpers for Behavior Reduction master/client/session APIs. */

function br_generate_id(): string
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

function br_table_exists(mysqli $conn, string $table): bool
{
    $t = $conn->real_escape_string($table);
    $r = $conn->query("SHOW TABLES LIKE '$t'");
    return $r && $r->num_rows > 0;
}

function br_valid_recording_type(string $type): bool
{
    return in_array($type, [
        'Frequency',
        'Duration',
        'MomentaryTimeSample',
        'PartialInterval',
        'Rate',
    ], true);
}

function br_fetch_master_categories(mysqli $conn): array
{
    if (!br_table_exists($conn, 'master_behavior_categories')) {
        return [];
    }
    $rows = [];
    $r = $conn->query('SELECT * FROM master_behavior_categories ORDER BY name ASC');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $rows[] = $row;
        }
    }
    return $rows;
}

function br_fetch_master_behaviors(mysqli $conn): array
{
    if (!br_table_exists($conn, 'master_behaviors')) {
        return [];
    }
    $rows = [];
    $r = $conn->query('SELECT * FROM master_behaviors ORDER BY name ASC');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $rows[] = $row;
        }
    }
    return $rows;
}

function br_fetch_client_behaviors(mysqli $conn, string $clientId): array
{
    if (!br_table_exists($conn, 'client_behaviors')) {
        return [];
    }
    $cid = $conn->real_escape_string($clientId);
    $rows = [];
    $r = $conn->query("SELECT * FROM client_behaviors WHERE client_id = '$cid' ORDER BY name ASC");
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $rows[] = $row;
        }
    }
    return $rows;
}

function br_fetch_abc_setup(mysqli $conn, string $clientId): array
{
    $cid = $conn->real_escape_string($clientId);
    $out = ['antecedents' => [], 'consequences' => [], 'locations' => []];
    foreach (['client_abc_antecedents' => 'antecedents', 'client_abc_consequences' => 'consequences', 'client_abc_locations' => 'locations'] as $table => $key) {
        if (!br_table_exists($conn, $table)) {
            continue;
        }
        $r = $conn->query("SELECT * FROM `$table` WHERE client_id = '$cid' ORDER BY name ASC");
        if ($r) {
            while ($row = $r->fetch_assoc()) {
                $out[$key][] = $row;
            }
        }
    }
    return $out;
}

function br_behavior_has_session_data(mysqli $conn, string $behaviorId, bool $isClient = true): bool
{
    if (!br_table_exists($conn, 'client_session_behavior_data')) {
        return false;
    }
    $bid = $conn->real_escape_string($behaviorId);
    $r = $conn->query("SELECT 1 FROM client_session_behavior_data WHERE behavior_id = '$bid' LIMIT 1");
    return $r && $r->num_rows > 0;
}

function br_upsert_master_category(mysqli $conn, array $cat): void
{
    $id = $conn->real_escape_string($cat['id'] ?? br_generate_id());
    $name = $conn->real_escape_string($cat['name'] ?? '');
    $description = $conn->real_escape_string($cat['description'] ?? '');
    $status = $conn->real_escape_string($cat['status'] ?? 'Active');
    $archived = (int)($cat['archived'] ?? 0);
    if ($name === '') {
        throw new Exception('Category name is required');
    }
    $sql = "INSERT INTO master_behavior_categories (id, name, description, status, archived)
            VALUES ('$id', '$name', '$description', '$status', $archived)
            ON DUPLICATE KEY UPDATE name='$name', description='$description', status='$status', archived=$archived";
    if (!$conn->query($sql)) {
        throw new Exception('Failed to save category: ' . $conn->error);
    }
}

function br_upsert_master_behavior(mysqli $conn, array $b): void
{
    $id = $conn->real_escape_string($b['id'] ?? br_generate_id());
    $categoryId = isset($b['category_id']) && $b['category_id'] !== '' ? "'" . $conn->real_escape_string($b['category_id']) . "'" : 'NULL';
    $name = $conn->real_escape_string($b['name'] ?? '');
    $goalName = $conn->real_escape_string($b['goal_name'] ?? '');
    $function = $conn->real_escape_string($b['function'] ?? '');
    $definition = $conn->real_escape_string($b['definition'] ?? '');
    $recordingType = $conn->real_escape_string($b['recording_type'] ?? 'Frequency');
    if (!br_valid_recording_type($recordingType)) {
        $recordingType = 'Frequency';
    }
    if ($name === '') {
        throw new Exception('Behavior name is required');
    }
    if (br_behavior_has_session_data($conn, $id, false)) {
        $existing = $conn->query("SELECT recording_type FROM master_behaviors WHERE id = '$id' LIMIT 1");
        if ($existing && ($row = $existing->fetch_assoc()) && ($row['recording_type'] ?? '') !== $recordingType) {
            throw new Exception('Recording type cannot be changed after data has been collected');
        }
    }
    $doNotZero = (int)(!empty($b['do_not_zero_out']));
    $excludeAbc = (int)(!empty($b['exclude_from_abc']));
    $isActive = (int)(($b['is_active'] ?? true) ? 1 : 0);
    $status = $conn->real_escape_string($b['status'] ?? 'Active');
    $archived = (int)($b['archived'] ?? 0);
    $sql = "INSERT INTO master_behaviors (id, category_id, name, goal_name, `function`, definition, recording_type, do_not_zero_out, exclude_from_abc, is_active, status, archived)
            VALUES ('$id', $categoryId, '$name', '$goalName', '$function', '$definition', '$recordingType', $doNotZero, $excludeAbc, $isActive, '$status', $archived)
            ON DUPLICATE KEY UPDATE category_id=$categoryId, name='$name', goal_name='$goalName', `function`='$function', definition='$definition',
            recording_type='$recordingType', do_not_zero_out=$doNotZero, exclude_from_abc=$excludeAbc, is_active=$isActive, status='$status', archived=$archived";
    if (!$conn->query($sql)) {
        throw new Exception('Failed to save behavior: ' . $conn->error);
    }
}

function br_upsert_client_behavior(mysqli $conn, string $clientId, array $b): void
{
    $id = $conn->real_escape_string($b['id'] ?? br_generate_id());
    $cid = $conn->real_escape_string($clientId);
    $masterId = isset($b['master_behavior_id']) && $b['master_behavior_id'] !== '' ? "'" . $conn->real_escape_string($b['master_behavior_id']) . "'" : 'NULL';
    $categoryId = isset($b['category_id']) && $b['category_id'] !== '' ? "'" . $conn->real_escape_string($b['category_id']) . "'" : 'NULL';
    $name = $conn->real_escape_string($b['name'] ?? '');
    $goalName = $conn->real_escape_string($b['goal_name'] ?? '');
    $function = $conn->real_escape_string($b['function'] ?? '');
    $definition = $conn->real_escape_string($b['definition'] ?? '');
    $recordingType = $conn->real_escape_string($b['recording_type'] ?? 'Frequency');
    if (!br_valid_recording_type($recordingType)) {
        $recordingType = 'Frequency';
    }
    if ($name === '') {
        throw new Exception('Behavior name is required');
    }
    if (br_behavior_has_session_data($conn, $id, true)) {
        $existing = $conn->query("SELECT recording_type FROM client_behaviors WHERE id = '$id' AND client_id = '$cid' LIMIT 1");
        if ($existing && ($row = $existing->fetch_assoc()) && ($row['recording_type'] ?? '') !== $recordingType) {
            throw new Exception('Recording type cannot be changed after data has been collected');
        }
    }
    $doNotZero = (int)(!empty($b['do_not_zero_out']));
    $excludeAbc = (int)(!empty($b['exclude_from_abc']));
    $isActive = (int)(($b['is_active'] ?? true) ? 1 : 0);
    $status = $conn->real_escape_string($b['status'] ?? 'Active');
    $archived = (int)($b['archived'] ?? 0);
    $sql = "INSERT INTO client_behaviors (id, client_id, master_behavior_id, category_id, name, goal_name, `function`, definition, recording_type, do_not_zero_out, exclude_from_abc, is_active, status, archived)
            VALUES ('$id', '$cid', $masterId, $categoryId, '$name', '$goalName', '$function', '$definition', '$recordingType', $doNotZero, $excludeAbc, $isActive, '$status', $archived)
            ON DUPLICATE KEY UPDATE master_behavior_id=$masterId, category_id=$categoryId, name='$name', goal_name='$goalName', `function`='$function', definition='$definition',
            recording_type='$recordingType', do_not_zero_out=$doNotZero, exclude_from_abc=$excludeAbc, is_active=$isActive, status='$status', archived=$archived";
    if (!$conn->query($sql)) {
        throw new Exception('Failed to save client behavior: ' . $conn->error);
    }
}

function br_upsert_abc_item(mysqli $conn, string $table, string $clientId, array $item): void
{
    $allowed = ['client_abc_antecedents', 'client_abc_consequences', 'client_abc_locations'];
    if (!in_array($table, $allowed, true)) {
        throw new Exception('Invalid ABC table');
    }
    $id = $conn->real_escape_string($item['id'] ?? br_generate_id());
    $cid = $conn->real_escape_string($clientId);
    $name = $conn->real_escape_string($item['name'] ?? '');
    $description = $conn->real_escape_string($item['description'] ?? '');
    $isActive = (int)(($item['is_active'] ?? true) ? 1 : 0);
    if ($name === '') {
        throw new Exception('Name is required');
    }
    $sql = "INSERT INTO `$table` (id, client_id, name, description, is_active)
            VALUES ('$id', '$cid', '$name', '$description', $isActive)
            ON DUPLICATE KEY UPDATE name='$name', description='$description', is_active=$isActive";
    if (!$conn->query($sql)) {
        throw new Exception('Failed to save ABC item: ' . $conn->error);
    }
}

function br_fetch_session_behavior_data(mysqli $conn, string $clientId, string $sessionDate, ?int $sessionId = null): array
{
    if (!br_table_exists($conn, 'client_session_behavior_data')) {
        return [];
    }
    $cid = $conn->real_escape_string($clientId);
    $date = $conn->real_escape_string($sessionDate);
    $sql = "SELECT * FROM client_session_behavior_data WHERE client_id = '$cid' AND session_date = '$date'";
    if ($sessionId !== null && $sessionId > 0) {
        $sql .= ' AND session_id = ' . (int)$sessionId;
    }
    $sql .= ' ORDER BY created_at ASC';
    $rows = [];
    $r = $conn->query($sql);
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $rows[] = $row;
        }
    }
    return $rows;
}

function br_fetch_session_abc_data(mysqli $conn, string $clientId, string $sessionDate, ?int $sessionId = null): array
{
    if (!br_table_exists($conn, 'client_session_abc_data')) {
        return [];
    }
    $cid = $conn->real_escape_string($clientId);
    $date = $conn->real_escape_string($sessionDate);
    $sql = "SELECT * FROM client_session_abc_data WHERE client_id = '$cid' AND session_date = '$date'";
    if ($sessionId !== null && $sessionId > 0) {
        $sql .= ' AND session_id = ' . (int)$sessionId;
    }
    $sql .= ' ORDER BY created_at ASC';
    $rows = [];
    $r = $conn->query($sql);
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $rows[] = $row;
        }
    }
    return $rows;
}

function br_persist_session_behavior_data(mysqli $conn, string $clientId, string $sessionDate, ?int $sessionId, array $behaviorRows, array $clientBehaviors): void
{
    if (!br_table_exists($conn, 'client_session_behavior_data')) {
        return;
    }
    $behaviorMap = [];
    foreach ($clientBehaviors as $b) {
        $behaviorMap[$b['id']] = $b;
    }
    $cid = $conn->real_escape_string($clientId);
    $date = $conn->real_escape_string($sessionDate);
    $sid = $sessionId !== null && $sessionId > 0 ? (int)$sessionId : 'NULL';
    $conn->query("DELETE FROM client_session_behavior_data WHERE client_id = '$cid' AND session_date = '$date'" . ($sid !== 'NULL' ? " AND session_id = $sid" : ' AND session_id IS NULL'));
    foreach ($behaviorRows as $row) {
        $bid = $conn->real_escape_string($row['id'] ?? '');
        if ($bid === '') {
            continue;
        }
        $meta = $behaviorMap[$row['id']] ?? null;
        $recordingType = $conn->real_escape_string($row['recordingType'] ?? ($meta['recording_type'] ?? 'Frequency'));
        $value = [
            'dataToday' => $row['dataToday'] ?? 0,
            'durationSeconds' => $row['durationSeconds'] ?? 0,
            'rateCount' => $row['rateCount'] ?? 0,
            'intervalMarks' => $row['intervalMarks'] ?? [],
        ];
        $hasData = ($value['dataToday'] ?? 0) != 0 || ($value['durationSeconds'] ?? 0) != 0 || ($value['rateCount'] ?? 0) != 0 || !empty($value['intervalMarks']);
        if (!$hasData && $meta && !empty($meta['do_not_zero_out'])) {
            continue;
        }
        if (!$hasData) {
            continue;
        }
        $id = br_generate_id();
        $json = $conn->real_escape_string(json_encode($value));
        $sidSql = $sid === 'NULL' ? 'NULL' : (string)$sid;
        $sql = "INSERT INTO client_session_behavior_data (id, client_id, session_id, session_date, behavior_id, recording_type, value_json)
                VALUES ('$id', '$cid', $sidSql, '$date', '$bid', '$recordingType', '$json')";
        $conn->query($sql);
    }
}

function br_persist_session_abc_data(mysqli $conn, string $clientId, string $sessionDate, ?int $sessionId, array $abcRows): void
{
    if (!br_table_exists($conn, 'client_session_abc_data')) {
        return;
    }
    $cid = $conn->real_escape_string($clientId);
    $date = $conn->real_escape_string($sessionDate);
    $sid = $sessionId !== null && $sessionId > 0 ? (int)$sessionId : 'NULL';
    $conn->query("DELETE FROM client_session_abc_data WHERE client_id = '$cid' AND session_date = '$date'" . ($sid !== 'NULL' ? " AND session_id = $sid" : ' AND session_id IS NULL'));
    foreach ($abcRows as $row) {
        $id = br_generate_id();
        $aid = isset($row['antecedent_id']) && $row['antecedent_id'] !== '' ? "'" . $conn->real_escape_string($row['antecedent_id']) . "'" : 'NULL';
        $bid = isset($row['behavior_id']) && $row['behavior_id'] !== '' ? "'" . $conn->real_escape_string($row['behavior_id']) . "'" : 'NULL';
        $cid2 = isset($row['consequence_id']) && $row['consequence_id'] !== '' ? "'" . $conn->real_escape_string($row['consequence_id']) . "'" : 'NULL';
        $lid = isset($row['location_id']) && $row['location_id'] !== '' ? "'" . $conn->real_escape_string($row['location_id']) . "'" : 'NULL';
        $notes = $conn->real_escape_string($row['notes'] ?? '');
        $sidSql = $sid === 'NULL' ? 'NULL' : (string)$sid;
        $sql = "INSERT INTO client_session_abc_data (id, client_id, session_id, session_date, antecedent_id, behavior_id, consequence_id, location_id, notes)
                VALUES ('$id', '$cid', $sidSql, '$date', $aid, $bid, $cid2, $lid, '$notes')";
        $conn->query($sql);
    }
}

function br_persist_from_session_notes_input(mysqli $conn, array $input): void
{
    if (!isset($input['client_id'])) {
        return;
    }
    $clientId = (string)$input['client_id'];
    $sessionDate = (string)($input['session_date'] ?? date('Y-m-d'));
    $sessionIdRaw = $input['session_id'] ?? null;
    $sessionId = $sessionIdRaw !== null && $sessionIdRaw !== '' && is_numeric($sessionIdRaw)
        ? (int)$sessionIdRaw
        : null;
    $sessionNotes = is_array($input['session_notes'] ?? null) ? $input['session_notes'] : [];
    $clientBehaviors = br_fetch_client_behaviors($conn, $clientId);
    br_persist_session_behavior_data(
        $conn,
        $clientId,
        $sessionDate,
        $sessionId,
        $sessionNotes['behaviorReductionData'] ?? [],
        $clientBehaviors
    );
    br_persist_session_abc_data(
        $conn,
        $clientId,
        $sessionDate,
        $sessionId,
        $sessionNotes['abcData'] ?? []
    );
}

function br_merge_behavior_data_into_rows(array $behaviors, array $sessionDataRows): array
{
    $aggregated = [];
    foreach ($sessionDataRows as $row) {
        $bid = $row['behavior_id'] ?? '';
        if ($bid === '') {
            continue;
        }
        $val = json_decode($row['value_json'] ?? '{}', true) ?: [];
        if (!isset($aggregated[$bid])) {
            $aggregated[$bid] = ['dataToday' => 0, 'durationSeconds' => 0, 'rateCount' => 0, 'intervalMarks' => []];
        }
        $aggregated[$bid]['dataToday'] += (float)($val['dataToday'] ?? 0);
        $aggregated[$bid]['durationSeconds'] += (float)($val['durationSeconds'] ?? 0);
        $aggregated[$bid]['rateCount'] += (float)($val['rateCount'] ?? 0);
        if (!empty($val['intervalMarks']) && is_array($val['intervalMarks'])) {
            $aggregated[$bid]['intervalMarks'] = array_merge($aggregated[$bid]['intervalMarks'], $val['intervalMarks']);
        }
    }
    $out = [];
    foreach ($behaviors as $b) {
        if (!(int)($b['is_active'] ?? 1) || (int)($b['archived'] ?? 0)) {
            continue;
        }
        $id = $b['id'];
        $agg = $aggregated[$id] ?? ['dataToday' => 0, 'durationSeconds' => 0, 'rateCount' => 0, 'intervalMarks' => []];
        $out[] = [
            'id' => $id,
            'behaviorName' => $b['name'] ?? '',
            'behaviorCategory' => $b['category_id'] ?? '',
            'goalName' => $b['goal_name'] ?? '',
            'function' => $b['function'] ?? '',
            'definition' => $b['definition'] ?? '',
            'recordingType' => $b['recording_type'] ?? 'Frequency',
            'doNotZeroOut' => !empty($b['do_not_zero_out']),
            'excludeFromAbc' => !empty($b['exclude_from_abc']),
            'dataToday' => $agg['dataToday'],
            'durationSeconds' => $agg['durationSeconds'],
            'rateCount' => $agg['rateCount'],
            'intervalMarks' => $agg['intervalMarks'],
            'archived' => false,
        ];
    }
    return $out;
}
