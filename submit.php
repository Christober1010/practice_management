<?php
// submit.php
require_once "db.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  exit("Method Not Allowed");
}

// Helper: safe fetch & trim
function f($key, $default = '') {
  return isset($_POST[$key]) ? trim($_POST[$key]) : $default;
}
function j($arr) {
  if (!is_array($arr)) return null;
  return json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// Demographic
$child_name        = f('child_name');
$child_dob         = f('child_dob');
$completer_name    = f('completer_name');
$address_line1     = f('address_line1');
$address_line2     = f('address_line2');
$city              = f('city');
$state             = f('state');
$zip               = f('zip');
$country           = f('country');
$phone_home        = f('phone_home');
$phone_cell        = f('phone_cell');
$physician         = f('physician');
$neurologist       = f('neurologist');
$family_composition= f('family_composition');

// General
$goals_for_therapy = f('goals_for_therapy');
$preferred_times   = f('preferred_times');
$pref_edible       = f('pref_edible');
$pref_tangible     = f('pref_tangible');
$pref_social       = f('pref_social');
$pref_activity     = f('pref_activity');

// Medical
$diagnosis         = f('diagnosis');
$medical_conditions= f('medical_conditions');
$special_diet      = f('special_diet');
$conditions        = isset($_POST['conditions']) ? $_POST['conditions'] : [];
$conditions_desc   = f('conditions_description');
$medications       = isset($_POST['medications']) ? array_values(array_filter($_POST['medications'], function($m){
  return isset($m['name']) && trim($m['name']) !== '';
})) : [];

// Education
$school_name       = f('school_name');
$grade             = f('grade');
$teachers          = f('teachers');
$classroom_type    = f('classroom_type');
$school_address    = f('school_address');
$school_hours      = f('school_hours');
$transportation    = f('transportation');
$supportive_therapies = f('supportive_therapies');
$past_aba          = f('past_aba');

// Guidelines & Signatures
$guidelines_agree  = isset($_POST['guidelines_agree']) ? 1 : 0;
$guidelines_version= f('guidelines_version', 'MBHS-CG-v1');
$signature_guardian= f('signature_guardian');
$signature_guardian_date = f('signature_guardian_date');
$signature_provider= f('signature_provider');
$signature_provider_date = f('signature_provider_date');

// Minimal required validations (server-side)
$errors = [];
if ($child_name === '') $errors[] = "Child name is required.";
if ($child_dob === '') $errors[] = "Child DOB is required.";
if ($completer_name === '') $errors[] = "Completer name is required.";
if ($address_line1 === '') $errors[] = "Address Line 1 is required.";
if ($guidelines_agree !== 1) $errors[] = "Caregiver guidelines agreement is required.";
if ($signature_guardian === '' || $signature_guardian_date === '') $errors[] = "Guardian signature and date are required.";

if (!empty($errors)) {
  http_response_code(400);
  echo "Validation errors:\n- " . implode("\n- ", $errors);
  exit;
}

// Prepare insert
$sql = "INSERT INTO intake_forms (
  child_name, child_dob, completer_name,
  address_line1, address_line2, city, state, zip, country,
  phone_home, phone_cell, physician, neurologist, family_composition,
  goals_for_therapy, preferred_times, pref_edible, pref_tangible, pref_social, pref_activity,
  diagnosis, medical_conditions, special_diet, conditions_json, conditions_description, medications_json,
  school_name, grade, teachers, classroom_type, school_address, school_hours, transportation, supportive_therapies, past_aba,
  guidelines_agree, guidelines_version, signature_guardian, signature_guardian_date, signature_provider, signature_provider_date
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

$stmt = $conn->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  exit("DB Prepare failed: " . $conn->error);
}

$conditions_json  = j($conditions);
$medications_json = j($medications);

$stmt->bind_param(
  "sssssssssssssssssssssssssssssssssiissss",
  $child_name, $child_dob, $completer_name,
  $address_line1, $address_line2, $city, $state, $zip, $country,
  $phone_home, $phone_cell, $physician, $neurologist, $family_composition,
  $goals_for_therapy, $preferred_times, $pref_edible, $pref_tangible, $pref_social, $pref_activity,
  $diagnosis, $medical_conditions, $special_diet, $conditions_json, $conditions_desc, $medications_json,
  $school_name, $grade, $teachers, $classroom_type, $school_address, $school_hours, $transportation, $supportive_therapies, $past_aba,
  $guidelines_agree, $guidelines_version, $signature_guardian, $signature_guardian_date, $signature_provider, $signature_provider_date
);

if (!$stmt->execute()) {
  http_response_code(500);
  echo "DB Insert failed: " . $stmt->error;
  $stmt->close();
  $conn->close();
  exit;
}

$stmt->close();
$conn->close();

// Simple success page
echo "Form submitted successfully. Thank you!";
