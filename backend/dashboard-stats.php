<?php
// Set CORS headers for all requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    // Send all CORS headers for preflight
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    http_response_code(200);
    exit();
}

// Database credentials
$host = "db5018266079.hosting-data.io";
$user = "dbu3321929";
$password = "M@h@B3h@v1or@lH3@lth4@ut1sm";
$database = "dbs14484433";


function getTimeAgo($datetime) {
    if (!$datetime) return 'recently';
    $timestamp = strtotime($datetime);
    if (!$timestamp) return 'recently';
    $diff = time() - $timestamp;
    
    if ($diff < 60) {
        return 'just now';
    } elseif ($diff < 3600) {
        $minutes = floor($diff / 60);
        return $minutes . ' minute' . ($minutes > 1 ? 's' : '') . ' ago';
    } elseif ($diff < 86400) {
        $hours = floor($diff / 3600);
        return $hours . ' hour' . ($hours > 1 ? 's' : '') . ' ago';
    } elseif ($diff < 604800) {
        $days = floor($diff / 86400);
        return $days . ' day' . ($days > 1 ? 's' : '') . ' ago';
    } else {
        return date('M j, Y', $timestamp);
    }
}

try {
    $conn = new mysqli($host, $user, $password, $database);
    $conn->set_charset("utf8mb4");

    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    // Get today's date
    $today = date('Y-m-d');

    // Active Clients Count
    $activeClientsQuery = "SELECT COUNT(*) as count FROM clients WHERE archived = 0";
    $activeClientsResult = $conn->query($activeClientsQuery);
    $activeClients = $activeClientsResult ? (int)$activeClientsResult->fetch_assoc()['count'] : 0;

    // Active Staff Count
    $activeStaffQuery = "SELECT COUNT(*) as count FROM staff WHERE archived = 0";
    $activeStaffResult = $conn->query($activeStaffQuery);
    $activeStaff = $activeStaffResult ? (int)$activeStaffResult->fetch_assoc()['count'] : 0;

    // Sessions Today Count
    $sessionsTodayQuery = "SELECT COUNT(*) as count FROM sessions 
                          WHERE DATE(start_utc) = ? AND STATUS != 'Cancelled'";
    $stmt = $conn->prepare($sessionsTodayQuery);
    $stmt->bind_param("s", $today);
    $stmt->execute();
    $sessionsTodayResult = $stmt->get_result();
    $sessionsToday = $sessionsTodayResult ? (int)$sessionsTodayResult->fetch_assoc()['count'] : 0;
    $stmt->close();

    // Pending Sessions Today (scheduled but not completed)
    $pendingSessionsQuery = "SELECT COUNT(*) as count FROM sessions 
                            WHERE DATE(start_utc) = ? AND STATUS = 'Scheduled'";
    $stmt = $conn->prepare($pendingSessionsQuery);
    $stmt->bind_param("s", $today);
    $stmt->execute();
    $pendingSessionsResult = $stmt->get_result();
    $pendingSessions = $pendingSessionsResult ? (int)$pendingSessionsResult->fetch_assoc()['count'] : 0;
    $stmt->close();

    // Upcoming Sessions This Week
    $weekStart = date('Y-m-d', strtotime('monday this week'));
    $weekEnd = date('Y-m-d', strtotime('sunday this week'));
    $upcomingSessionsQuery = "SELECT COUNT(*) as count FROM sessions 
                             WHERE DATE(start_utc) >= ? AND DATE(start_utc) <= ? 
                             AND STATUS = 'Scheduled'";
    $stmt = $conn->prepare($upcomingSessionsQuery);
    $stmt->bind_param("ss", $weekStart, $weekEnd);
    $stmt->execute();
    $upcomingSessionsResult = $stmt->get_result();
    $upcomingSessions = $upcomingSessionsResult ? (int)$upcomingSessionsResult->fetch_assoc()['count'] : 0;
    $stmt->close();

    // Total Targets Count
    $totalTargetsQuery = "SELECT COUNT(*) as count FROM client_targets";
    $totalTargetsResult = $conn->query($totalTargetsQuery);
    $totalTargets = $totalTargetsResult ? (int)$totalTargetsResult->fetch_assoc()['count'] : 0;

    // Recent Activities (last 10 activities)
    $activities = [];

    // Recent client additions
    $recentClientsQuery = "SELECT first_name, last_name, created_at 
                          FROM clients 
                          WHERE archived = 0 
                          ORDER BY created_at DESC 
                          LIMIT 3";
    $recentClientsResult = $conn->query($recentClientsQuery);
    if ($recentClientsResult) {
        while ($row = $recentClientsResult->fetch_assoc()) {
            $timeAgo = getTimeAgo($row['created_at']);
            $activities[] = [
                'type' => 'client',
                'title' => 'New client enrolled',
                'description' => $row['first_name'] . ' ' . $row['last_name'] . ' - ' . $timeAgo,
                'timestamp' => $row['created_at']
            ];
        }
    }

    // Recent session completions
    $recentSessionsQuery = "SELECT s.client_id, c.first_name, c.last_name, s.updated_at 
                           FROM sessions s
                           LEFT JOIN clients c ON s.client_id = c.client_id
                           WHERE s.STATUS = 'Rendered' 
                           ORDER BY s.updated_at DESC 
                           LIMIT 3";
    $recentSessionsResult = $conn->query($recentSessionsQuery);
    if ($recentSessionsResult) {
        while ($row = $recentSessionsResult->fetch_assoc()) {
            if ($row['first_name']) {
                $timeAgo = getTimeAgo($row['updated_at']);
                $activities[] = [
                    'type' => 'session',
                    'title' => 'Session completed',
                    'description' => $row['first_name'] . ' ' . $row['last_name'] . ' - ' . $timeAgo,
                    'timestamp' => $row['updated_at']
                ];
            }
        }
    }

    // Sort activities by timestamp and limit to 10
    usort($activities, function($a, $b) {
        return strtotime($b['timestamp']) - strtotime($a['timestamp']);
    });
    $activities = array_slice($activities, 0, 10);

    echo json_encode([
        'success' => true,
        'data' => [
            'activeClients' => $activeClients,
            'activeStaff' => $activeStaff,
            'sessionsToday' => $sessionsToday,
            'pendingSessions' => $pendingSessions,
            'upcomingSessions' => $upcomingSessions,
            'totalTargets' => $totalTargets,
            'activities' => $activities
        ]
    ]);

    $conn->close();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
