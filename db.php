<?php
// db.php
$host = "YOUR_IONOS_DB_HOST";
$user = "YOUR_IONOS_DB_USER";
$pass = "YOUR_IONOS_DB_PASSWORD";
$db   = "YOUR_IONOS_DB_NAME";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}
// Use UTF-8
$conn->set_charset("utf8mb4");
