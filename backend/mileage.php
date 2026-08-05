<?php
/**
 * Mileage reimbursement API
 *
 * GET  ?action=settings
 * GET  ?action=providers&date=YYYY-MM-DD   (optional date filter)
 * GET  ?action=day&provider_id=&date=
 * GET  ?action=claims&dos_from=&dos_to=&provider_id=
 * GET  ?action=claim&id=
 * PUT  body { action: "settings", rate_per_mile }
 * PATCH body { action: "status", id, status }
 * PATCH body { action: "payment_status", id, payment_status, pay_date?, check_number? }
 *        // paid requires pay_date + check_number
 * POST body { provider_id, claim_date, rate_per_mile, legs: [...] }
 * DELETE ?id=  or body { id }
 *
 * RBAC: view.reports_mileage (preferred) or reports.read / reports.write
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/rbac_helpers.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$isMutating = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
// Nav uses view.reports_mileage (Off/Self/All); Manage Data uses view.mileage_rate for org rate.
$authUser = $isMutating
    ? requireAuthAny(['view.reports_mileage', 'reports.write', 'view.mileage_rate', 'manage_data.mileage_rate'], 'mahaverse')
    : requireAuthAny(['view.reports_mileage', 'reports.read', 'view.reports', 'view.mileage_rate', 'manage_data.mileage_rate'], 'mahaverse');

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

function mileage_fail(int $code, string $msg): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit();
}

function mileage_ok(array $payload = []): void
{
    echo json_encode(array_merge(['success' => true], $payload));
    exit();
}

function mileage_table_exists(mysqli $conn, string $table): bool
{
    $safe = $conn->real_escape_string($table);
    $res = $conn->query("SHOW TABLES LIKE '{$safe}'");
    $ok = $res && $res->num_rows > 0;
    if ($res) {
        $res->free();
    }
    return $ok;
}

function mileage_column_exists(mysqli $conn, string $table, string $column): bool
{
    $t = $conn->real_escape_string($table);
    $c = $conn->real_escape_string($column);
    $res = @$conn->query("SHOW COLUMNS FROM `{$t}` LIKE '{$c}'");
    $ok = $res && $res->num_rows > 0;
    if ($res) {
        $res->free();
    }
    return $ok;
}

function mileage_normalize_payment_status(?string $raw): string
{
    $s = strtolower(trim((string)$raw));
    $s = str_replace([' ', '-'], '_', $s);
    if ($s === 'paid') {
        return 'paid';
    }
    return 'pending_payment';
}

function mileage_ensure_tables(mysqli $conn): void
{
    if (!mileage_table_exists($conn, 'mileage_settings')) {
        $conn->query("
          CREATE TABLE IF NOT EXISTS mileage_settings (
            id TINYINT UNSIGNED NOT NULL DEFAULT 1,
            rate_per_mile DECIMAL(8,4) NOT NULL DEFAULT 0.4500,
            currency CHAR(3) NOT NULL DEFAULT 'USD',
            updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            updated_by VARCHAR(255) NULL DEFAULT NULL,
            PRIMARY KEY (id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $conn->query("INSERT INTO mileage_settings (id, rate_per_mile, currency) VALUES (1, 0.4500, 'USD')
                      ON DUPLICATE KEY UPDATE id = id");
    }
    if (!mileage_table_exists($conn, 'mileage_claims')) {
        $conn->query("
          CREATE TABLE IF NOT EXISTS mileage_claims (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            provider_id VARCHAR(64) NOT NULL,
            provider_name VARCHAR(255) NULL DEFAULT NULL,
            claim_date DATE NOT NULL,
            rate_per_mile DECIMAL(8,4) NOT NULL,
            total_miles DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status VARCHAR(32) NOT NULL DEFAULT 'submitted',
            payment_status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
            pay_date DATE NULL DEFAULT NULL,
            check_number VARCHAR(64) NULL DEFAULT NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            created_by VARCHAR(255) NULL DEFAULT NULL,
            updated_by VARCHAR(255) NULL DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_mileage_claim_provider_date (provider_id, claim_date),
            KEY idx_mileage_claims_date (claim_date),
            KEY idx_mileage_claims_payment_status (payment_status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    } elseif (!mileage_column_exists($conn, 'mileage_claims', 'payment_status')) {
        @$conn->query(
            "ALTER TABLE mileage_claims
               ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'pending_payment'
                 COMMENT 'pending_payment | paid'
                 AFTER status,
               ADD KEY idx_mileage_claims_payment_status (payment_status)"
        );
    }
    if (mileage_table_exists($conn, 'mileage_claims') && !mileage_column_exists($conn, 'mileage_claims', 'pay_date')) {
        @$conn->query(
            "ALTER TABLE mileage_claims
               ADD COLUMN pay_date DATE NULL DEFAULT NULL
                 COMMENT 'Required when payment_status = paid'
                 AFTER payment_status"
        );
    }
    if (mileage_table_exists($conn, 'mileage_claims') && !mileage_column_exists($conn, 'mileage_claims', 'check_number')) {
        @$conn->query(
            "ALTER TABLE mileage_claims
               ADD COLUMN check_number VARCHAR(64) NULL DEFAULT NULL
                 COMMENT 'Required when payment_status = paid'
                 AFTER pay_date"
        );
    }
    if (!mileage_table_exists($conn, 'mileage_legs')) {
        $conn->query("
          CREATE TABLE IF NOT EXISTS mileage_legs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            claim_id BIGINT UNSIGNED NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            from_session_id INT NULL DEFAULT NULL,
            to_session_id INT NULL DEFAULT NULL,
            from_stop_key VARCHAR(64) NULL DEFAULT NULL,
            to_stop_key VARCHAR(64) NULL DEFAULT NULL,
            from_label VARCHAR(255) NOT NULL,
            to_label VARCHAR(255) NOT NULL,
            from_address VARCHAR(512) NULL DEFAULT NULL,
            to_address VARCHAR(512) NULL DEFAULT NULL,
            from_lat DECIMAL(10,7) NULL DEFAULT NULL,
            from_lng DECIMAL(10,7) NULL DEFAULT NULL,
            to_lat DECIMAL(10,7) NULL DEFAULT NULL,
            to_lng DECIMAL(10,7) NULL DEFAULT NULL,
            miles DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            excluded TINYINT(1) NOT NULL DEFAULT 0,
            is_home_leg TINYINT(1) NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_mileage_legs_claim (claim_id),
            CONSTRAINT fk_mileage_legs_claim
              FOREIGN KEY (claim_id) REFERENCES mileage_claims(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
}

function mileage_haversine_miles(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): ?float
{
    if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) {
        return null;
    }
    if (!is_finite($lat1) || !is_finite($lng1) || !is_finite($lat2) || !is_finite($lng2)) {
        return null;
    }
    // Reject Null Island (0,0) — common when null was cast to float 0
    if ((abs($lat1) < 1e-6 && abs($lng1) < 1e-6) || (abs($lat2) < 1e-6 && abs($lng2) < 1e-6)) {
        return null;
    }
    $R = 3958.8;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2
        + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return round($R * 2 * atan2(sqrt($a), sqrt(1 - $a)), 2);
}

/** Coerce lat/lng from stop/leg fields; empty string / missing → null (never 0). */
function mileage_coord($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value)) {
        return null;
    }
    $n = (float)$value;
    if (!is_finite($n)) {
        return null;
    }
    return $n;
}

/** First N miles of each home↔client commute are unpaid; remainder is reimbursable. */
function mileage_home_commute_deductible_miles(): float
{
    return 30.0;
}

/**
 * @param float $grossMiles Full road distance for the leg
 * @param bool $isHomeLeg Home → first client or last client → home
 * @param bool $forceExclude User marked the whole leg excluded
 */
function mileage_billable_miles(float $grossMiles, bool $isHomeLeg, bool $forceExclude = false): float
{
    if ($forceExclude || $grossMiles <= 0) {
        return 0.0;
    }
    if ($isHomeLeg) {
        return round(max(0.0, $grossMiles - mileage_home_commute_deductible_miles()), 2);
    }
    return round($grossMiles, 2);
}

/**
 * Road/driving distance via public OSRM (meters → miles).
 * Falls back to null on network/API failure so callers can use haversine.
 */
function mileage_osrm_driving_miles(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): ?float
{
    if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) {
        return null;
    }
    if (!is_finite($lat1) || !is_finite($lng1) || !is_finite($lat2) || !is_finite($lng2)) {
        return null;
    }
    // Same point
    if (abs($lat1 - $lat2) < 1e-7 && abs($lng1 - $lng2) < 1e-7) {
        return 0.0;
    }

    static $cache = [];
    $key = sprintf('%.5f,%.5f|%.5f,%.5f', $lat1, $lng1, $lat2, $lng2);
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $url = sprintf(
        'https://router.project-osrm.org/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=false&alternatives=false',
        $lng1,
        $lat1,
        $lng2,
        $lat2
    );
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: MahaverseMileage/1.0 (mileage reimbursement)\r\nAccept: application/json\r\n",
            'timeout' => 8,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        $cache[$key] = null;
        return null;
    }
    $json = json_decode($raw, true);
    if (!is_array($json) || ($json['code'] ?? '') !== 'Ok') {
        $cache[$key] = null;
        return null;
    }
    $meters = $json['routes'][0]['distance'] ?? null;
    if ($meters === null || !is_numeric($meters)) {
        $cache[$key] = null;
        return null;
    }
    $miles = round(((float)$meters) / 1609.344, 2);
    $cache[$key] = $miles;
    return $miles;
}

/** Prefer driving (OSRM) miles; fall back to straight-line haversine. */
function mileage_route_miles(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): array
{
    $driving = mileage_osrm_driving_miles($lat1, $lng1, $lat2, $lng2);
    if ($driving !== null) {
        return ['miles' => $driving, 'mode' => 'driving'];
    }
    $straight = mileage_haversine_miles($lat1, $lng1, $lat2, $lng2);
    return [
        'miles' => $straight,
        'mode' => $straight !== null ? 'straight' : null,
    ];
}

function mileage_build_auto_legs(array $stops): array
{
    $home = null;
    $clients = [];
    foreach ($stops as $s) {
        if (!empty($s['is_home'])) {
            $home = $s;
        } else {
            $clients[] = $s;
        }
    }
    // Collapse consecutive same-address / same-coords client stops
    $collapsed = [];
    foreach ($clients as $s) {
        if (!$collapsed) {
            $collapsed[] = $s;
            continue;
        }
        $prev = $collapsed[count($collapsed) - 1];
        $addrA = strtolower(trim((string)($prev['address'] ?? '')));
        $addrB = strtolower(trim((string)($s['address'] ?? '')));
        $sameAddr = $addrA !== '' && $addrA === $addrB;
        $la = mileage_coord($prev['lat'] ?? null);
        $ln = mileage_coord($prev['lng'] ?? null);
        $lb = mileage_coord($s['lat'] ?? null);
        $lo = mileage_coord($s['lng'] ?? null);
        $sameCoords = $la !== null && $ln !== null && $lb !== null && $lo !== null
            && abs($la - $lb) < 1e-5 && abs($ln - $lo) < 1e-5;
        if ($sameAddr || $sameCoords) {
            continue;
        }
        $collapsed[] = $s;
    }
    $clients = $collapsed;

    $legs = [];
    $push = static function (array $from, array $to, bool $homeLeg) use (&$legs): void {
        $fromLat = mileage_coord($from['lat'] ?? null);
        $fromLng = mileage_coord($from['lng'] ?? null);
        $toLat = mileage_coord($to['lat'] ?? null);
        $toLng = mileage_coord($to['lng'] ?? null);
        $route = mileage_route_miles($fromLat, $fromLng, $toLat, $toLng);
        $miles = $route['miles'];
        // Absurd distances almost always mean bad/missing geocode — don't bill them
        if ($miles !== null && $miles > 500) {
            $miles = null;
            $route['mode'] = 'invalid';
        }
        $billable = mileage_billable_miles((float)($miles ?? 0), $homeLeg, false);
        $legs[] = [
            'from_stop_key' => $from['stop_key'] ?? $from['id'] ?? '',
            'to_stop_key' => $to['stop_key'] ?? $to['id'] ?? '',
            'from_label' => $from['label'] ?? '',
            'to_label' => $to['label'] ?? '',
            'from_address' => $from['address'] ?? '',
            'to_address' => $to['address'] ?? '',
            'from_session_id' => $from['session_id'] ?? null,
            'to_session_id' => $to['session_id'] ?? null,
            'from_lat' => $fromLat,
            'from_lng' => $fromLng,
            'to_lat' => $toLat,
            'to_lng' => $toLng,
            'miles' => $miles,
            'billable_miles' => $billable,
            'home_deductible_miles' => $homeLeg ? mileage_home_commute_deductible_miles() : 0,
            'distance_mode' => $route['mode'],
            'excluded' => false,
            'is_home_leg' => $homeLeg,
        ];
    };

    if ($home && !empty($clients[0])) {
        $push($home, $clients[0], true);
    }
    for ($i = 0, $n = count($clients); $i < $n - 1; $i++) {
        $push($clients[$i], $clients[$i + 1], false);
    }
    if ($home && $clients) {
        $push($clients[count($clients) - 1], $home, true);
    }
    return $legs;
}

/** Nominatim geocode (server-side). Returns [lat, lng] or null. */
function mileage_geocode(string $address): ?array
{
    $address = mileage_normalize_address($address);
    if ($address === '' || strlen($address) < 5) {
        return null;
    }
    static $cache = [];
    $key = strtolower($address);
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
        'q' => $address,
        'format' => 'json',
        'limit' => 1,
        'countrycodes' => 'us',
        'addressdetails' => 0,
    ]);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: MahaverseMileage/1.0 (mileage reimbursement)\r\nAccept: application/json\r\n",
            'timeout' => 8,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        $cache[$key] = null;
        return null;
    }
    $json = json_decode($raw, true);
    if (!is_array($json) || !isset($json[0]['lat'], $json[0]['lon'])) {
        $cache[$key] = null;
        return null;
    }
    $lat = (float)$json[0]['lat'];
    $lon = (float)$json[0]['lon'];
    if (!is_finite($lat) || !is_finite($lon)
        || $lat < 24.0 || $lat > 50.0
        || $lon < -125.0 || $lon > -66.0
        || (abs($lat) < 1e-6 && abs($lon) < 1e-6)) {
        $cache[$key] = null;
        return null;
    }
    $coords = [$lat, $lon];
    $cache[$key] = $coords;
    usleep(200000);
    return $coords;
}

function mileage_normalize_address(string $address): string
{
    $address = trim(preg_replace('/\s+/', ' ', $address) ?? '');
    if ($address === '') {
        return '';
    }
    // Drop unit/apt — Nominatim often returns nothing with these present
    $address = preg_replace('/\b(apt|apartment|unit|suite|ste|#)\s*[.]?\s*[a-z0-9-]+\b/i', '', $address) ?? $address;
    $address = preg_replace('/\bUSA\b/i', '', $address) ?? $address;
    $address = preg_replace('/\bUnited States( of America)?\b/i', '', $address) ?? $address;
    $address = preg_replace('/\s+,/', ',', $address) ?? $address;
    $address = preg_replace('/,\s*,+/', ',', $address) ?? $address;
    $address = trim($address, " \t,");
    $address = trim(preg_replace('/\s+/', ' ', $address) ?? '');

    $parts = array_values(array_filter(array_map('trim', explode(',', $address)), static fn($p) => $p !== ''));
    $out = [];
    foreach ($parts as $p) {
        $lower = strtolower($p);
        $dup = false;
        foreach ($out as $o) {
            if (strtolower($o) === $lower) {
                $dup = true;
                break;
            }
            if (strlen($o) > strlen($p) && stripos($o, $p) !== false) {
                $dup = true;
                break;
            }
        }
        if ($dup) {
            continue;
        }
        foreach ($out as $i => $o) {
            if (strlen($p) > strlen($o) && stripos($p, $o) !== false) {
                $out[$i] = $p;
                continue 2;
            }
        }
        $out[] = $p;
    }
    return implode(', ', $out);
}

function mileage_build_address_string(array $parts): string
{
    $line1 = trim((string)($parts['address_line_1'] ?? ''));
    $line2 = trim((string)($parts['address_line_2'] ?? ''));
    $address = trim((string)($parts['address'] ?? ''));
    $city = trim((string)($parts['city'] ?? ''));
    $state = trim((string)($parts['state'] ?? ''));
    $zip = trim((string)($parts['zipcode'] ?? $parts['zip'] ?? ''));
    $country = trim((string)($parts['country'] ?? ''));

    // Freeform already includes city or zip — don't re-append structured fields on top.
    if ($address !== '' && (
        ($city !== '' && stripos($address, $city) !== false) ||
        ($zip !== '' && strpos($address, $zip) !== false)
    )) {
        $free = $address;
        if ($country !== '' && stripos($free, $country) === false) {
            $free .= ', ' . $country;
        }
        return mileage_normalize_address($free);
    }

    $bits = [];
    foreach ([$line1 !== '' ? $line1 : $address, $line2, $city, $state, $zip, $country] as $v) {
        $v = trim((string)$v);
        if ($v === '') {
            continue;
        }
        $joined = implode(', ', $bits);
        if ($joined !== '' && stripos($joined, $v) !== false) {
            continue;
        }
        $bits[] = $v;
    }
    return mileage_normalize_address(implode(', ', $bits));
}

function mileage_get_settings(mysqli $conn): array
{
    $res = $conn->query('SELECT rate_per_mile, currency, updated_at, updated_by FROM mileage_settings WHERE id = 1 LIMIT 1');
    if ($res && ($row = $res->fetch_assoc())) {
        $res->free();
        return [
            'rate_per_mile' => (float)$row['rate_per_mile'],
            'currency' => $row['currency'] ?: 'USD',
            'updated_at' => $row['updated_at'],
            'updated_by' => $row['updated_by'],
        ];
    }
    if ($res) {
        $res->free();
    }
    $conn->query("INSERT INTO mileage_settings (id, rate_per_mile, currency) VALUES (1, 0.4500, 'USD')
                  ON DUPLICATE KEY UPDATE id = id");
    return [
        'rate_per_mile' => 0.45,
        'currency' => 'USD',
        'updated_at' => null,
        'updated_by' => null,
    ];
}

function mileage_sessions_status_col(mysqli $conn): string
{
    static $col = null;
    if ($col !== null) {
        return $col;
    }
    $col = 'STATUS';
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        $names = [];
        while ($row = $r->fetch_assoc()) {
            $names[$row['Field'] ?? ''] = true;
        }
        $r->free();
        if (!isset($names['STATUS']) && isset($names['status'])) {
            $col = 'status';
        }
    }
    return $col;
}

/**
 * AND-clauses for mileage-eligible sessions:
 * - skip Indirect (blank / Direct allowed)
 * - skip exclude_session Yes (also y / 1 / true)
 * Missing columns are skipped (pre-migration DBs).
 */
function mileage_session_eligibility_sql(mysqli $conn, string $alias = 's'): string
{
    static $cache = [];
    $key = $alias === '' ? '_' : $alias;
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $names = [];
    $r = @$conn->query('SHOW COLUMNS FROM `sessions`');
    if ($r) {
        while ($row = $r->fetch_assoc()) {
            $names[$row['Field'] ?? ''] = true;
        }
        $r->free();
    }
    $a = $alias !== '' ? $alias . '.' : '';
    $parts = [];
    if (isset($names['service_type'])) {
        // Exclude Indirect only; treat NULL/blank as Direct (legacy rows).
        $parts[] = "UPPER(TRIM(IFNULL({$a}service_type, 'Direct'))) <> 'INDIRECT'";
    }
    if (isset($names['exclude_session'])) {
        // Match normalize_session_exclude_session(): Yes / Y / 1 / true
        $parts[] = "UPPER(TRIM(IFNULL(CAST({$a}exclude_session AS CHAR), 'No'))) NOT IN ('YES', 'Y', '1', 'TRUE')";
    }
    $cache[$key] = $parts === [] ? '' : (' AND ' . implode(' AND ', $parts));
    return $cache[$key];
}

/** True when a session row should be included in mileage (PHP-side guard). */
function mileage_session_row_is_eligible(array $row): bool
{
    if (array_key_exists('service_type', $row) || array_key_exists('session_service_type', $row)) {
        $st = strtoupper(trim((string)($row['service_type'] ?? $row['session_service_type'] ?? 'Direct')));
        if ($st === 'INDIRECT') {
            return false;
        }
    }
    if (array_key_exists('exclude_session', $row) || array_key_exists('session_exclude', $row)) {
        $ex = strtolower(trim((string)($row['exclude_session'] ?? $row['session_exclude'] ?? 'No')));
        if (in_array($ex, ['yes', 'y', '1', 'true'], true)) {
            return false;
        }
    }
    return true;
}

function mileage_staff_home(mysqli $conn, string $providerId): ?array
{
    if ($providerId === '') {
        return null;
    }
    $stmt = $conn->prepare('SELECT * FROM staff WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $providerId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) {
        return null;
    }
    $name = trim((string)($row['fullName'] ?? ''));
    if ($name === '') {
        $name = trim(
            trim((string)($row['firstName'] ?? $row['first_name'] ?? '')) . ' ' .
            trim((string)($row['lastName'] ?? $row['last_name'] ?? ''))
        );
    }
    if ($name === '') {
        $name = trim((string)($row['name'] ?? 'Staff'));
    }
    $address = mileage_build_address_string($row);
    $lat = null;
    $lng = null;
    if ($address !== '') {
        $coords = mileage_geocode($address);
        if ($coords) {
            [$lat, $lng] = $coords;
        }
    }
    return [
        'id' => 'home:' . $providerId,
        'stop_key' => 'home:' . $providerId,
        'session_id' => null,
        'label' => 'Home (' . $name . ')',
        'client_name' => null,
        'address' => $address !== '' ? $address : null,
        'lat' => $lat,
        'lng' => $lng,
        'is_home' => true,
        'time_label' => null,
        'start_utc' => null,
        'end_utc' => null,
        'order' => 0,
    ];
}

function mileage_client_address(mysqli $conn, $clientId): ?string
{
    if ($clientId === null || $clientId === '') {
        return null;
    }
    $stmt = $conn->prepare(
        'SELECT address_line_1, address_line_2, city, state, zipcode, country, location
         FROM client_addresses WHERE client_id = ? ORDER BY id ASC LIMIT 1'
    );
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('s', $clientId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) {
        return null;
    }
    $addr = mileage_build_address_string($row);
    return $addr !== '' ? $addr : null;
}

function mileage_format_time_range($startUtc, $endUtc): ?string
{
    // Display labels are formatted in the browser timezone on the client
    // (same as Appointments). Keep a UTC fallback for API consumers.
    if (!$startUtc) {
        return null;
    }
    try {
        $s = new DateTimeImmutable((string)$startUtc, new DateTimeZone('UTC'));
        $startLabel = $s->format('g:i A') . ' UTC';
        if ($endUtc) {
            $e = new DateTimeImmutable((string)$endUtc, new DateTimeZone('UTC'));
            return $startLabel . ' – ' . $e->format('g:i A') . ' UTC';
        }
        return $startLabel;
    } catch (Exception $ex) {
        return null;
    }
}

function mileage_normalize_timezone(?string $tz): string
{
    $tz = trim((string)$tz);
    if ($tz === '' || !preg_match('/^[A-Za-z0-9_+\-\/]+$/', $tz)) {
        return 'UTC';
    }
    try {
        new DateTimeZone($tz);
        return $tz;
    } catch (Exception $e) {
        return 'UTC';
    }
}

/** UTC [start, end) bounds for a calendar day in the given IANA timezone. */
function mileage_day_utc_bounds(string $ymd, ?string $tz = null): array
{
    $zone = new DateTimeZone(mileage_normalize_timezone($tz));
    $startLocal = new DateTimeImmutable($ymd . ' 00:00:00', $zone);
    $endLocal = $startLocal->modify('+1 day');
    return [
        $startLocal->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
        $endLocal->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
    ];
}

/** @deprecated use mileage_day_utc_bounds */
function mileage_chicago_day_utc_bounds(string $ymd): array
{
    return mileage_day_utc_bounds($ymd, 'America/Chicago');
}

function mileage_load_day_sessions(mysqli $conn, string $providerId, string $date, ?string $tz = null): array
{
    $statusCol = mileage_sessions_status_col($conn);
    $eligibleSql = mileage_session_eligibility_sql($conn, 's');
    $hasServiceType = mileage_column_exists($conn, 'sessions', 'service_type');
    $hasExclude = mileage_column_exists($conn, 'sessions', 'exclude_session');
    $serviceTypeSelect = $hasServiceType ? 's.service_type' : 'NULL AS service_type';
    $excludeSelect = $hasExclude ? 's.exclude_session' : "'No' AS exclude_session";
    [$dayStartUtc, $dayEndUtc] = mileage_day_utc_bounds($date, $tz);
    $sql = "
      SELECT
        s.session_id,
        s.client_id,
        s.provider_id,
        s.provider_name,
        s.start_utc,
        s.end_utc,
        s.location_address,
        s.{$statusCol} AS session_status,
        {$serviceTypeSelect},
        {$excludeSelect},
        c.first_name AS client_first_name,
        c.last_name AS client_last_name
      FROM sessions s
      LEFT JOIN clients c ON s.client_id = c.client_id
      WHERE s.start_utc >= ? AND s.start_utc < ?
        AND CAST(s.provider_id AS CHAR) = ?
        AND UPPER(TRIM(IFNULL(s.{$statusCol}, ''))) <> 'CANCELLED'
        {$eligibleSql}
      ORDER BY s.start_utc ASC
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        mileage_fail(500, 'Failed to prepare day sessions query');
    }
    $stmt->bind_param('sss', $dayStartUtc, $dayEndUtc, $providerId);
    $stmt->execute();
    $res = $stmt->get_result();
    $stops = [];
    $order = 1;
    while ($row = $res->fetch_assoc()) {
        if (!mileage_session_row_is_eligible($row)) {
            continue;
        }
        $clientName = trim(
            trim((string)($row['client_first_name'] ?? '')) . ' ' . trim((string)($row['client_last_name'] ?? ''))
        );
        if ($clientName === '') {
            $clientName = 'Client';
        }
        $sessionAddr = mileage_normalize_address(trim((string)($row['location_address'] ?? '')));
        $clientAddr = mileage_client_address($conn, $row['client_id'] ?? null);
        // Prefer structured client address (cleaner for geocoding) over session free-text.
        $address = $clientAddr ?: $sessionAddr;
        $lat = null;
        $lng = null;
        if ($address !== '') {
            $coords = mileage_geocode($address);
            if ($coords) {
                [$lat, $lng] = $coords;
            }
        }
        $sid = (int)$row['session_id'];
        $stops[] = [
            'id' => 'session:' . $sid,
            'stop_key' => 'session:' . $sid,
            'session_id' => $sid,
            'label' => $clientName,
            'client_name' => $clientName,
            'client_id' => $row['client_id'] ?? null,
            'address' => $address !== '' ? $address : null,
            'lat' => $lat,
            'lng' => $lng,
            'is_home' => false,
            'time_label' => mileage_format_time_range($row['start_utc'] ?? null, $row['end_utc'] ?? null),
            'start_utc' => $row['start_utc'] ?? null,
            'end_utc' => $row['end_utc'] ?? null,
            'session_status' => $row['session_status'] ?? null,
            'order' => $order++,
        ];
    }
    $stmt->close();
    return $stops;
}

function mileage_fetch_claim(mysqli $conn, int $claimId): ?array
{
    $stmt = $conn->prepare('SELECT * FROM mileage_claims WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('i', $claimId);
    $stmt->execute();
    $res = $stmt->get_result();
    $claim = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$claim) {
        return null;
    }
    $legsStmt = $conn->prepare('SELECT * FROM mileage_legs WHERE claim_id = ? ORDER BY sort_order ASC, id ASC');
    $legs = [];
    if ($legsStmt) {
        $legsStmt->bind_param('i', $claimId);
        $legsStmt->execute();
        $legsRes = $legsStmt->get_result();
        while ($leg = $legsRes->fetch_assoc()) {
            $legs[] = [
                'id' => (int)$leg['id'],
                'sort_order' => (int)$leg['sort_order'],
                'from_session_id' => $leg['from_session_id'] !== null ? (int)$leg['from_session_id'] : null,
                'to_session_id' => $leg['to_session_id'] !== null ? (int)$leg['to_session_id'] : null,
                'from_stop_key' => $leg['from_stop_key'],
                'to_stop_key' => $leg['to_stop_key'],
                'from_label' => $leg['from_label'],
                'to_label' => $leg['to_label'],
                'from_address' => $leg['from_address'],
                'to_address' => $leg['to_address'],
                'from_lat' => $leg['from_lat'] !== null ? (float)$leg['from_lat'] : null,
                'from_lng' => $leg['from_lng'] !== null ? (float)$leg['from_lng'] : null,
                'to_lat' => $leg['to_lat'] !== null ? (float)$leg['to_lat'] : null,
                'to_lng' => $leg['to_lng'] !== null ? (float)$leg['to_lng'] : null,
                'miles' => (float)$leg['miles'],
                'cost' => (float)$leg['cost'],
                'excluded' => (bool)$leg['excluded'],
                'is_home_leg' => (bool)$leg['is_home_leg'],
            ];
        }
        $legsStmt->close();
    }
    return [
        'id' => (int)$claim['id'],
        'provider_id' => $claim['provider_id'],
        'provider_name' => $claim['provider_name'],
        'claim_date' => $claim['claim_date'],
        'rate_per_mile' => (float)$claim['rate_per_mile'],
        'total_miles' => (float)$claim['total_miles'],
        'total_cost' => (float)$claim['total_cost'],
        'status' => $claim['status'],
        'payment_status' => mileage_normalize_payment_status($claim['payment_status'] ?? null),
        'pay_date' => $claim['pay_date'] ?? null,
        'check_number' => $claim['check_number'] ?? null,
        'notes' => $claim['notes'],
        'created_at' => $claim['created_at'],
        'updated_at' => $claim['updated_at'],
        'created_by' => $claim['created_by'],
        'legs' => $legs,
    ];
}

function mileage_find_claim_by_provider_date(mysqli $conn, string $providerId, string $date): ?array
{
    $stmt = $conn->prepare('SELECT id FROM mileage_claims WHERE provider_id = ? AND claim_date = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param('ss', $providerId, $date);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) {
        return null;
    }
    return mileage_fetch_claim($conn, (int)$row['id']);
}

function mileage_can_configure_rate(array $authUser): bool
{
    $role = (string)($authUser['role'] ?? '');
    return rbac_user_has_permission_key($role, 'view.mileage_rate')
        || rbac_user_has_permission_key($role, 'manage_data.mileage_rate')
        || rbac_user_has_permission_key($role, 'manage_data.write');
}

function mileage_actor_name(array $authUser): string
{
    return trim((string)($authUser['username'] ?? $authUser['email'] ?? $authUser['id'] ?? 'user'));
}

function mileage_scope_context(mysqli $conn, array $authUser): array
{
    $scope = function_exists('rbac_mileage_access_scope')
        ? rbac_mileage_access_scope($authUser, $conn)
        : (strtolower((string)($authUser['role'] ?? '')) === 'admin' ? 'all' : 'self');
    $selfId = function_exists('rbac_resolve_staff_id_for_user')
        ? rbac_resolve_staff_id_for_user($conn, $authUser)
        : null;
    return [
        'scope' => $scope, // all|self|null
        'self_provider_id' => $selfId ? (string)$selfId : null,
        'can_manage_all' => $scope === 'all',
        'can_write' => true, // caller already passed reports.write for mutating verbs
    ];
}

function mileage_require_scope(array $ctx): void
{
    if (($ctx['scope'] ?? null) === null) {
        mileage_fail(403, 'Permission denied for mileage');
    }
}

function mileage_require_provider_access(array $ctx, string $providerId): void
{
    mileage_require_scope($ctx);
    if (($ctx['scope'] ?? '') === 'all') {
        return;
    }
    $self = (string)($ctx['self_provider_id'] ?? '');
    if ($self === '' || $self !== (string)$providerId) {
        mileage_fail(403, 'You can only access your own mileage claims');
    }
}

mileage_ensure_tables($conn);
$mileageCtx = mileage_scope_context($conn, $authUser);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$action = isset($_GET['action']) ? trim((string)$_GET['action']) : '';
if ($action === '' && isset($input['action'])) {
    $action = trim((string)$input['action']);
}

if ($method === 'GET') {
    if ($action === '' || $action === 'settings') {
        if (!mileage_can_configure_rate($authUser)) {
            mileage_require_scope($mileageCtx);
        }
        mileage_ok([
            'settings' => mileage_get_settings($conn),
            'access' => [
                'scope' => $mileageCtx['scope'],
                'self_provider_id' => $mileageCtx['self_provider_id'],
                'can_manage_all' => $mileageCtx['can_manage_all'],
                'can_configure_rate' => mileage_can_configure_rate($authUser) || ($mileageCtx['can_manage_all'] ?? false),
            ],
        ]);
    }

    if ($action === 'providers') {
        mileage_require_scope($mileageCtx);
        $date = isset($_GET['date']) ? trim((string)$_GET['date']) : '';
        $statusCol = mileage_sessions_status_col($conn);
        $providers = [];
        $sessionProviderIds = [];

        if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $tz = isset($_GET['tz']) ? (string)$_GET['tz'] : null;
            [$dayStartUtc, $dayEndUtc] = mileage_day_utc_bounds($date, $tz);
            $eligibleSql = mileage_session_eligibility_sql($conn, 's');
            $sql = "
              SELECT DISTINCT s.provider_id, s.provider_name
              FROM sessions s
              WHERE s.start_utc >= ? AND s.start_utc < ?
                AND s.provider_id IS NOT NULL
                AND TRIM(CAST(s.provider_id AS CHAR)) <> ''
                AND UPPER(TRIM(IFNULL(s.{$statusCol}, ''))) <> 'CANCELLED'
                {$eligibleSql}
              ORDER BY s.provider_name ASC
            ";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('ss', $dayStartUtc, $dayEndUtc);
            $stmt->execute();
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $pid = (string)$row['provider_id'];
                $sessionProviderIds[$pid] = true;
                $providers[] = [
                    'provider_id' => $pid,
                    'provider_name' => trim((string)($row['provider_name'] ?? '')) ?: $pid,
                    'has_sessions' => true,
                ];
            }
            $stmt->close();
        }

        // All-scope: always offer full staff list so admins can pick a provider even when
        // the selected date has no sessions yet (Load day will report empty).
        if (($mileageCtx['scope'] ?? '') === 'all') {
            $byId = [];
            foreach ($providers as $p) {
                $byId[(string)$p['provider_id']] = $p;
            }
            $res = @$conn->query("SELECT id, fullName, firstName, lastName FROM staff ORDER BY fullName ASC LIMIT 500");
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $pid = (string)$row['id'];
                    if (isset($byId[$pid])) {
                        continue;
                    }
                    $name = trim((string)($row['fullName'] ?? ''));
                    if ($name === '') {
                        $name = trim(trim((string)($row['firstName'] ?? '')) . ' ' . trim((string)($row['lastName'] ?? '')));
                    }
                    $byId[$pid] = [
                        'provider_id' => $pid,
                        'provider_name' => $name !== '' ? $name : $pid,
                        'has_sessions' => !empty($sessionProviderIds[$pid]),
                    ];
                }
                $res->free();
            }
            $providers = array_values($byId);
            usort($providers, static function ($a, $b) {
                $as = !empty($a['has_sessions']) ? 0 : 1;
                $bs = !empty($b['has_sessions']) ? 0 : 1;
                if ($as !== $bs) {
                    return $as - $bs;
                }
                return strcasecmp((string)$a['provider_name'], (string)$b['provider_name']);
            });
        } elseif ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $res = @$conn->query("SELECT id, fullName, firstName, lastName FROM staff ORDER BY fullName ASC LIMIT 500");
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $name = trim((string)($row['fullName'] ?? ''));
                    if ($name === '') {
                        $name = trim(trim((string)($row['firstName'] ?? '')) . ' ' . trim((string)($row['lastName'] ?? '')));
                    }
                    $providers[] = [
                        'provider_id' => (string)$row['id'],
                        'provider_name' => $name !== '' ? $name : (string)$row['id'],
                        'has_sessions' => false,
                    ];
                }
                $res->free();
            }
        }

        if (($mileageCtx['scope'] ?? '') === 'self') {
            $self = (string)($mileageCtx['self_provider_id'] ?? '');
            $providers = array_values(array_filter(
                $providers,
                static fn($p) => $self !== '' && (string)$p['provider_id'] === $self
            ));
            // Self users with no sessions that day still need their own row to attempt a claim.
            if (count($providers) === 0 && $self !== '') {
                $providers[] = [
                    'provider_id' => $self,
                    'provider_name' => 'You',
                    'has_sessions' => false,
                ];
            }
        }
        mileage_ok([
            'providers' => $providers,
            'session_provider_count' => count($sessionProviderIds),
            'access' => [
                'scope' => $mileageCtx['scope'],
                'self_provider_id' => $mileageCtx['self_provider_id'],
                'can_manage_all' => $mileageCtx['can_manage_all'],
            ],
        ]);
    }

    if ($action === 'day') {
        $providerId = isset($_GET['provider_id']) ? trim((string)$_GET['provider_id']) : '';
        $date = isset($_GET['date']) ? trim((string)$_GET['date']) : '';
        if ($providerId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            mileage_fail(400, 'provider_id and date (YYYY-MM-DD) are required');
        }
        mileage_require_provider_access($mileageCtx, $providerId);
        $tz = isset($_GET['tz']) ? (string)$_GET['tz'] : null;
        $settings = mileage_get_settings($conn);
        $home = mileage_staff_home($conn, $providerId);
        $sessions = mileage_load_day_sessions($conn, $providerId, $date, $tz);
        $stops = [];
        if ($home) {
            $stops[] = $home;
        }
        foreach ($sessions as $s) {
            $stops[] = $s;
        }
        $existing = mileage_find_claim_by_provider_date($conn, $providerId, $date);
        $providerName = '';
        if (!empty($sessions[0]['session_id'])) {
            [$dayStartUtc, $dayEndUtc] = mileage_day_utc_bounds($date, $tz);
            $stmt = $conn->prepare(
                'SELECT provider_name FROM sessions
                 WHERE CAST(provider_id AS CHAR) = ?
                   AND start_utc >= ? AND start_utc < ?
                 LIMIT 1'
            );
            if ($stmt) {
                $stmt->bind_param('sss', $providerId, $dayStartUtc, $dayEndUtc);
                $stmt->execute();
                $r = $stmt->get_result();
                $row = $r ? $r->fetch_assoc() : null;
                $stmt->close();
                $providerName = trim((string)($row['provider_name'] ?? ''));
            }
        }
        if ($providerName === '' && $home) {
            $providerName = preg_replace('/^Home\s*\(|\)$/', '', $home['label']);
        }
        $suggestedLegs = mileage_build_auto_legs($stops);
        mileage_ok([
            'settings' => $settings,
            'provider_id' => $providerId,
            'provider_name' => $providerName,
            'date' => $date,
            'stops' => $stops,
            'legs' => $suggestedLegs,
            'distance_mode' => 'driving',
            'home_commute_deductible_miles' => mileage_home_commute_deductible_miles(),
            'distance_note' => 'Miles use road/driving distance when available. Home↔client legs: first 30 miles unpaid; remainder reimbursable. Client↔client: full miles.',
            'existing_claim' => $existing ? [
                'id' => (int)$existing['id'],
                'total_miles' => (float)$existing['total_miles'],
                'total_cost' => (float)$existing['total_cost'],
                'status' => $existing['status'],
            ] : null,
            'access' => [
                'scope' => $mileageCtx['scope'],
                'self_provider_id' => $mileageCtx['self_provider_id'],
                'can_manage_all' => $mileageCtx['can_manage_all'],
            ],
        ]);
    }

    if ($action === 'claims') {
        mileage_require_scope($mileageCtx);
        $dosFrom = isset($_GET['dos_from']) ? trim((string)$_GET['dos_from']) : '';
        $dosTo = isset($_GET['dos_to']) ? trim((string)$_GET['dos_to']) : '';
        $providerId = isset($_GET['provider_id']) ? trim((string)$_GET['provider_id']) : '';
        $statusFilter = isset($_GET['status']) ? trim((string)$_GET['status']) : '';
        $where = ['1=1'];
        $types = '';
        $params = [];
        if (($mileageCtx['scope'] ?? '') === 'self') {
            $self = (string)($mileageCtx['self_provider_id'] ?? '');
            if ($self === '') {
                mileage_ok([
                    'claims' => [],
                    'access' => [
                        'scope' => 'self',
                        'self_provider_id' => null,
                        'can_manage_all' => false,
                    ],
                ]);
            }
            $where[] = 'provider_id = ?';
            $types .= 's';
            $params[] = $self;
        } elseif ($providerId !== '') {
            $where[] = 'provider_id = ?';
            $types .= 's';
            $params[] = $providerId;
        }
        if ($dosFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dosFrom)) {
            $where[] = 'claim_date >= ?';
            $types .= 's';
            $params[] = $dosFrom;
        }
        if ($dosTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dosTo)) {
            $where[] = 'claim_date <= ?';
            $types .= 's';
            $params[] = $dosTo;
        }
        if ($statusFilter !== '' && strtolower($statusFilter) !== 'all') {
            $where[] = 'status = ?';
            $types .= 's';
            $params[] = $statusFilter;
        }
        $sql = 'SELECT id, provider_id, provider_name, claim_date, rate_per_mile, total_miles, total_cost, status, payment_status, pay_date, check_number, created_at, created_by, updated_at
                FROM mileage_claims WHERE ' . implode(' AND ', $where) . '
                ORDER BY claim_date DESC, id DESC LIMIT 500';
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            mileage_fail(500, 'Failed to list claims');
        }
        if ($types !== '') {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $res = $stmt->get_result();
        $claims = [];
        while ($row = $res->fetch_assoc()) {
            $claims[] = [
                'id' => (int)$row['id'],
                'provider_id' => $row['provider_id'],
                'provider_name' => $row['provider_name'],
                'claim_date' => $row['claim_date'],
                'rate_per_mile' => (float)$row['rate_per_mile'],
                'total_miles' => (float)$row['total_miles'],
                'total_cost' => (float)$row['total_cost'],
                'status' => $row['status'],
                'payment_status' => mileage_normalize_payment_status($row['payment_status'] ?? null),
                'pay_date' => $row['pay_date'] ?? null,
                'check_number' => $row['check_number'] ?? null,
                'created_at' => $row['created_at'],
                'created_by' => $row['created_by'] ?? null,
                'updated_at' => $row['updated_at'] ?? null,
            ];
        }
        $stmt->close();
        mileage_ok([
            'claims' => $claims,
            'access' => [
                'scope' => $mileageCtx['scope'],
                'self_provider_id' => $mileageCtx['self_provider_id'],
                'can_manage_all' => $mileageCtx['can_manage_all'],
            ],
        ]);
    }

    if ($action === 'claim') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) {
            mileage_fail(400, 'id is required');
        }
        $claim = mileage_fetch_claim($conn, $id);
        if (!$claim) {
            mileage_fail(404, 'Claim not found');
        }
        mileage_require_provider_access($mileageCtx, (string)$claim['provider_id']);
        mileage_ok([
            'claim' => $claim,
            'access' => [
                'scope' => $mileageCtx['scope'],
                'self_provider_id' => $mileageCtx['self_provider_id'],
                'can_manage_all' => $mileageCtx['can_manage_all'],
            ],
        ]);
    }

    mileage_fail(400, 'Unknown action');
}

if ($method === 'PUT' || $method === 'PATCH') {
    // Payment status update (admin / all-scope):
    // PATCH { action: "payment_status", id, payment_status, pay_date?, check_number? }
    // When payment_status=paid, pay_date and check_number are required.
    if ($action === 'payment_status' || isset($input['payment_status'])) {
        if (!($mileageCtx['can_manage_all'] ?? false)) {
            mileage_fail(403, 'Only users with Mileage All scope can change payment status');
        }
        $id = (int)($input['id'] ?? $_GET['id'] ?? 0);
        $raw = strtolower(str_replace([' ', '-'], '_', trim((string)($input['payment_status'] ?? ''))));
        if ($raw === 'pending' || $raw === 'pending_payment') {
            $paymentStatus = 'pending_payment';
        } elseif ($raw === 'paid') {
            $paymentStatus = 'paid';
        } else {
            $paymentStatus = '';
        }
        if ($id <= 0 || $paymentStatus === '') {
            mileage_fail(400, 'id and payment_status (pending_payment|paid) are required');
        }
        $claim = mileage_fetch_claim($conn, $id);
        if (!$claim) {
            mileage_fail(404, 'Claim not found');
        }

        $payDate = trim((string)($input['pay_date'] ?? ''));
        $checkNumber = trim((string)($input['check_number'] ?? $input['check_num'] ?? ''));
        if ($paymentStatus === 'paid') {
            if ($payDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $payDate)) {
                mileage_fail(400, 'Pay date is required when marking Paid (YYYY-MM-DD)');
            }
            if ($checkNumber === '') {
                mileage_fail(400, 'Check # is required when marking Paid');
            }
            if (strlen($checkNumber) > 64) {
                mileage_fail(400, 'Check # must be 64 characters or fewer');
            }
        } else {
            $payDate = null;
            $checkNumber = null;
        }

        $actor = mileage_actor_name($authUser);
        if ($paymentStatus === 'paid') {
            $stmt = $conn->prepare(
                'UPDATE mileage_claims
                 SET payment_status = ?, pay_date = ?, check_number = ?, updated_by = ?
                 WHERE id = ?'
            );
            if (!$stmt) {
                mileage_fail(500, 'Failed to update payment status');
            }
            $stmt->bind_param('ssssi', $paymentStatus, $payDate, $checkNumber, $actor, $id);
        } else {
            $stmt = $conn->prepare(
                'UPDATE mileage_claims
                 SET payment_status = ?, pay_date = NULL, check_number = NULL, updated_by = ?
                 WHERE id = ?'
            );
            if (!$stmt) {
                mileage_fail(500, 'Failed to update payment status');
            }
            $stmt->bind_param('ssi', $paymentStatus, $actor, $id);
        }
        if (!$stmt->execute()) {
            $stmt->close();
            mileage_fail(500, 'Failed to update payment status');
        }
        $stmt->close();
        mileage_ok(['claim' => mileage_fetch_claim($conn, $id), 'message' => 'Payment status updated']);
    }

    // Status update (admin / all-scope): PATCH { action: "status", id, status }
    if ($action === 'status' || (isset($input['status']) && isset($input['id']) && !isset($input['rate_per_mile']))) {
        if (!($mileageCtx['can_manage_all'] ?? false)) {
            mileage_fail(403, 'Only users with Mileage All scope can change claim status');
        }
        $id = (int)($input['id'] ?? $_GET['id'] ?? 0);
        $status = strtolower(trim((string)($input['status'] ?? '')));
        $allowed = ['submitted', 'approved', 'void', 'draft'];
        if ($id <= 0 || !in_array($status, $allowed, true)) {
            mileage_fail(400, 'id and status (submitted|approved|void|draft) are required');
        }
        $claim = mileage_fetch_claim($conn, $id);
        if (!$claim) {
            mileage_fail(404, 'Claim not found');
        }
        $actor = mileage_actor_name($authUser);
        // Approving a claim starts the payment workflow at Pending Payment.
        if ($status === 'approved') {
            $paymentStatus = 'pending_payment';
            $stmt = $conn->prepare(
                'UPDATE mileage_claims
                 SET status = ?, payment_status = ?, pay_date = NULL, check_number = NULL, updated_by = ?
                 WHERE id = ?'
            );
            if (!$stmt) {
                mileage_fail(500, 'Failed to update status');
            }
            $stmt->bind_param('sssi', $status, $paymentStatus, $actor, $id);
        } else {
            $stmt = $conn->prepare('UPDATE mileage_claims SET status = ?, updated_by = ? WHERE id = ?');
            if (!$stmt) {
                mileage_fail(500, 'Failed to update status');
            }
            $stmt->bind_param('ssi', $status, $actor, $id);
        }
        if (!$stmt->execute()) {
            $stmt->close();
            mileage_fail(500, 'Failed to update status');
        }
        $stmt->close();
        mileage_ok(['claim' => mileage_fetch_claim($conn, $id), 'message' => 'Status updated']);
    }

    if ($action === 'settings' || isset($input['rate_per_mile'])) {
        if (!($mileageCtx['can_manage_all'] ?? false) && !mileage_can_configure_rate($authUser)) {
            mileage_fail(403, 'Only Manage Data / Mileage All users can change the org rate');
        }
        $rate = isset($input['rate_per_mile']) ? (float)$input['rate_per_mile'] : -1;
        if ($rate < 0 || $rate > 100) {
            mileage_fail(400, 'rate_per_mile must be between 0 and 100');
        }
        $actor = mileage_actor_name($authUser);
        $stmt = $conn->prepare(
            'INSERT INTO mileage_settings (id, rate_per_mile, currency, updated_by)
             VALUES (1, ?, \'USD\', ?)
             ON DUPLICATE KEY UPDATE rate_per_mile = VALUES(rate_per_mile), updated_by = VALUES(updated_by)'
        );
        if (!$stmt) {
            mileage_fail(500, 'Failed to save settings');
        }
        $stmt->bind_param('ds', $rate, $actor);
        if (!$stmt->execute()) {
            $stmt->close();
            mileage_fail(500, 'Failed to save settings');
        }
        $stmt->close();
        mileage_ok(['settings' => mileage_get_settings($conn)]);
    }
    mileage_fail(400, 'Unknown action');
}

if ($method === 'POST') {
    $providerId = trim((string)($input['provider_id'] ?? ''));
    $claimDate = trim((string)($input['claim_date'] ?? ''));
    $providerName = trim((string)($input['provider_name'] ?? ''));
    $notes = isset($input['notes']) ? trim((string)$input['notes']) : null;
    $rate = isset($input['rate_per_mile']) ? (float)$input['rate_per_mile'] : null;
    $legsIn = isset($input['legs']) && is_array($input['legs']) ? $input['legs'] : [];

    if ($providerId === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $claimDate)) {
        mileage_fail(400, 'provider_id and claim_date (YYYY-MM-DD) are required');
    }
    mileage_require_provider_access($mileageCtx, $providerId);
    if ($rate === null) {
        $rate = mileage_get_settings($conn)['rate_per_mile'];
    }
    if ($rate < 0 || $rate > 100) {
        mileage_fail(400, 'Invalid rate_per_mile');
    }
    if (count($legsIn) === 0) {
        mileage_fail(400, 'At least one travel leg is required');
    }

    // Duplicate provider+date
    $existing = mileage_find_claim_by_provider_date($conn, $providerId, $claimDate);
    if ($existing) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'A mileage claim already exists for this provider and date',
            'existing_claim' => $existing,
        ]);
        exit();
    }

    $pairKeys = [];
    $normalizedLegs = [];
    $totalMiles = 0.0;
    $totalCost = 0.0;
    $sort = 0;

    foreach ($legsIn as $leg) {
        if (!is_array($leg)) {
            continue;
        }
        $fromKey = trim((string)($leg['from_stop_key'] ?? ''));
        $toKey = trim((string)($leg['to_stop_key'] ?? ''));
        $fromLabel = trim((string)($leg['from_label'] ?? ''));
        $toLabel = trim((string)($leg['to_label'] ?? ''));
        $fromAddress = trim((string)($leg['from_address'] ?? ''));
        $toAddress = trim((string)($leg['to_address'] ?? ''));
        $fromSessionId = isset($leg['from_session_id']) && $leg['from_session_id'] !== '' && $leg['from_session_id'] !== null
            ? (int)$leg['from_session_id'] : null;
        $toSessionId = isset($leg['to_session_id']) && $leg['to_session_id'] !== '' && $leg['to_session_id'] !== null
            ? (int)$leg['to_session_id'] : null;
        $isHomeLeg = !empty($leg['is_home_leg'])
            || strpos($fromKey, 'home:') === 0
            || strpos($toKey, 'home:') === 0;
        // Do not auto-exclude home legs — first 30 mi unpaid, remainder reimbursable.
        $forceExclude = !empty($leg['excluded']);

        $fromLat = mileage_coord($leg['from_lat'] ?? null);
        $fromLng = mileage_coord($leg['from_lng'] ?? null);
        $toLat = mileage_coord($leg['to_lat'] ?? null);
        $toLng = mileage_coord($leg['to_lng'] ?? null);

        $miles = isset($leg['miles']) && $leg['miles'] !== '' && $leg['miles'] !== null
            ? (float)$leg['miles'] : null;
        if ($miles === null || $miles < 0) {
            $route = mileage_route_miles($fromLat, $fromLng, $toLat, $toLng);
            $miles = $route['miles'] !== null ? (float)$route['miles'] : 0.0;
        }
        if ($miles < 0) {
            $miles = 0.0;
        }
        // Reject Null-Island / bad-geocode blow-ups (e.g. Chicago↔0,0 ≈ 6100 mi)
        if ($miles > 500) {
            $miles = 0.0;
        }
        $miles = round($miles, 2);
        $billable = mileage_billable_miles($miles, $isHomeLeg, $forceExclude);
        $excluded = $forceExclude || ($billable <= 0 && $isHomeLeg);

        if ($fromKey === '' || $toKey === '' || $fromKey === $toKey) {
            mileage_fail(400, 'Each leg needs distinct from_stop_key and to_stop_key');
        }
        if ($fromLabel === '') {
            $fromLabel = $fromKey;
        }
        if ($toLabel === '') {
            $toLabel = $toKey;
        }

        if ($billable > 0) {
            $pk = $fromKey . '→' . $toKey;
            if (isset($pairKeys[$pk])) {
                mileage_fail(400, 'Duplicate leg in claim: same From → To twice (' . $fromLabel . ' → ' . $toLabel . ')');
            }
            $pairKeys[$pk] = true;
            $cost = round($billable * $rate, 2);
            $totalMiles += $billable;
            $totalCost += $cost;
        } else {
            $cost = 0.0;
        }

        $normalizedLegs[] = [
            'sort_order' => $sort++,
            'from_session_id' => $fromSessionId,
            'to_session_id' => $toSessionId,
            'from_stop_key' => $fromKey,
            'to_stop_key' => $toKey,
            'from_label' => $fromLabel,
            'to_label' => $toLabel,
            'from_address' => $fromAddress !== '' ? $fromAddress : null,
            'to_address' => $toAddress !== '' ? $toAddress : null,
            'from_lat' => $fromLat,
            'from_lng' => $fromLng,
            'to_lat' => $toLat,
            'to_lng' => $toLng,
            'miles' => $miles,
            'cost' => $cost,
            'excluded' => $excluded ? 1 : 0,
            'is_home_leg' => $isHomeLeg ? 1 : 0,
        ];
    }

    $reimbursableCount = 0;
    foreach ($normalizedLegs as $nl) {
        if ((float)$nl['cost'] > 0) {
            $reimbursableCount++;
        }
    }
    if ($reimbursableCount === 0) {
        mileage_fail(400, 'Add at least one reimbursable leg (client-to-client, or home commute beyond 30 miles)');
    }

    $totalMiles = round($totalMiles, 2);
    $totalCost = round($totalCost, 2);
    $actor = mileage_actor_name($authUser);
    $status = 'submitted';

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare(
            'INSERT INTO mileage_claims
              (provider_id, provider_name, claim_date, rate_per_mile, total_miles, total_cost, status, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        if (!$stmt) {
            throw new Exception('Failed to prepare claim insert');
        }
        $stmt->bind_param(
            'sssdddsss',
            $providerId,
            $providerName,
            $claimDate,
            $rate,
            $totalMiles,
            $totalCost,
            $status,
            $notes,
            $actor
        );
        if (!$stmt->execute()) {
            if ($conn->errno === 1062) {
                $stmt->close();
                $conn->rollback();
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'A mileage claim already exists for this provider and date',
                ]);
                exit();
            }
            throw new Exception('Failed to insert claim: ' . $stmt->error);
        }
        $claimId = (int)$conn->insert_id;
        $stmt->close();

        $legStmt = $conn->prepare(
            'INSERT INTO mileage_legs
              (claim_id, sort_order, from_session_id, to_session_id, from_stop_key, to_stop_key,
               from_label, to_label, from_address, to_address,
               from_lat, from_lng, to_lat, to_lng, miles, cost, excluded, is_home_leg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        if (!$legStmt) {
            throw new Exception('Failed to prepare leg insert');
        }
        foreach ($normalizedLegs as $nl) {
            $sortOrder = (int)$nl['sort_order'];
            $fromSid = $nl['from_session_id'];
            $toSid = $nl['to_session_id'];
            $fromStopKey = $nl['from_stop_key'];
            $toStopKey = $nl['to_stop_key'];
            $fromLabel = $nl['from_label'];
            $toLabel = $nl['to_label'];
            $fromAddress = $nl['from_address'];
            $toAddress = $nl['to_address'];
            $fromLat = $nl['from_lat'];
            $fromLng = $nl['from_lng'];
            $toLat = $nl['to_lat'];
            $toLng = $nl['to_lng'];
            $miles = (float)$nl['miles'];
            $cost = (float)$nl['cost'];
            $excluded = (int)$nl['excluded'];
            $isHome = (int)$nl['is_home_leg'];
            $legStmt->bind_param(
                'iiiissssssddddddii',
                $claimId,
                $sortOrder,
                $fromSid,
                $toSid,
                $fromStopKey,
                $toStopKey,
                $fromLabel,
                $toLabel,
                $fromAddress,
                $toAddress,
                $fromLat,
                $fromLng,
                $toLat,
                $toLng,
                $miles,
                $cost,
                $excluded,
                $isHome
            );
            if (!$legStmt->execute()) {
                throw new Exception('Failed to insert leg: ' . $legStmt->error);
            }
        }
        $legStmt->close();
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        mileage_fail(500, $e->getMessage());
    }

    $claim = mileage_fetch_claim($conn, $claimId);
    mileage_ok(['claim' => $claim, 'message' => 'Mileage claim saved']);
}

if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : (int)($input['id'] ?? 0);
    if ($id <= 0) {
        mileage_fail(400, 'id is required');
    }
    $claim = mileage_fetch_claim($conn, $id);
    if (!$claim) {
        mileage_fail(404, 'Claim not found');
    }
    mileage_require_provider_access($mileageCtx, (string)$claim['provider_id']);
    // Self users may only delete their own submitted/draft claims; all-scope can delete any
    if (!($mileageCtx['can_manage_all'] ?? false)) {
        $st = strtolower((string)($claim['status'] ?? ''));
        if (!in_array($st, ['submitted', 'draft'], true)) {
            mileage_fail(403, 'Approved or void claims cannot be deleted by the submitter');
        }
    }
    $stmt = $conn->prepare('DELETE FROM mileage_claims WHERE id = ?');
    if (!$stmt) {
        mileage_fail(500, 'Failed to delete claim');
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    if ($affected < 1) {
        mileage_fail(404, 'Claim not found');
    }
    mileage_ok(['message' => 'Claim deleted', 'id' => $id]);
}

mileage_fail(405, 'Method not allowed');
