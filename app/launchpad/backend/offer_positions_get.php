<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$authUser = requireUser();

$conn = getDBConnection();

// Ensure table exists and is seeded (best-effort).
$conn->query("
    CREATE TABLE IF NOT EXISTS OfferLetterPositions (
      position_id   INT AUTO_INCREMENT PRIMARY KEY,
      position_code VARCHAR(50)   NOT NULL,
      position_name VARCHAR(255)  NOT NULL,
      offer_letter_template  TEXT NOT NULL,
      job_description_template TEXT NOT NULL,
      is_active     TINYINT(1)   NOT NULL DEFAULT 1,
      created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_offer_pos_code (position_code)
    )
");

// Seed default positions if the table is empty.
$countRes = $conn->query("SELECT COUNT(*) AS cnt FROM OfferLetterPositions");
$countRow = $countRes ? $countRes->fetch_assoc() : null;
if (!$countRow || (int)$countRow['cnt'] === 0) {
    $rbtTemplate = "We are pleased to formally offer you the position of \"{{position}}\" on a part-time basis at \"Maha Behavioral Health Services\".\n\nThe starting compensation for this role is {{pay_rate}}, with payments processed on a biweekly basis. Please note that this offer is contingent upon the successful completion of a background check.\n\nWe believe your skills and experience will be a valuable asset to our team, and we look forward to your contributions.\n\nShould you have any questions or require further clarification, please contact me at info@mahabehavioralhealth.com.\n\nThank you,\nHarini Chandramouli, MS, BCBA (She/her)\nFounder and Clinical Director\nMaha Behavioral Health Services";
    $rbtJd = "Registered Behavior Technicians considered for employment by MAHA BEHAVIORAL HEALTH SERVICES will meet the following requirements:\n\n\u2022 Must have a high school diploma at a minimum; bachelor's degree preferred with coursework in behavior analysis or a related field.\n\u2022 Complete 40-hour Registered Behavior Technician training.\n\u2022 Maintain recertification of RBT training annually.\n\u2022 Complete all necessary Medicaid Waiver training and documents.\n\nJob Responsibilities and Expectations:\n\n\u2022 Receive training on Behavior Analysis Service Plans (BASPs) for each consumer on their caseload.\n\u2022 Implement BASPs as written.\n\u2022 Provide services to consumers based on hours set by the Behavior Analyst.\n\u2022 Collect data on a daily basis and provide it to the Behavior Analyst on a weekly basis.\n\u2022 Communicate regularly with the Behavior Analyst.\n\u2022 Train caregivers to implement the BASPs.\n\u2022 Implement the BASP in all relevant settings.\n\u2022 Attend meetings regarding consumer's behavior services as necessary.";

    $bcTemplate = "On behalf of Maha Behavioral Health, I am absolutely thrilled to offer you the position of Behavior Consultant. We have been incredibly impressed by your background, your dedication to clinical excellence, and your upcoming readiness to sit for the Board Certified Behavior Analyst\u00ae (BCBA\u00ae) exam. We are confident that your skills will be a wonderful asset to our team and the families we serve.\n\nPlease find the details of your employment offer outlined below:\n\n  \u2022 Position: Behavior Consultant\n  \u2022 Company: Maha Behavioral Health\n  \u2022 Compensation: {{pay_rate}}\n  \u2022 Classification: [Insert Exempt/Non-Exempt or Full-Time/Part-Time status]\n  \u2022 Start Date: [Insert Target Start Date]\n\nContingencies of Employment\nThis offer of employment is contingent upon the successful completion of a comprehensive background check, reference checks, and verification of your legal right to work in the United States.\n\nBCBA Certification & Compensation Adjustment\nWe recognize that you are preparing to take your BCBA exam in the near future. Upon your successful passing of the BCBA exam and official verification of your certification with the Behavior Analyst Certification Board (BACB\u00ae), your position, responsibilities, and compensation will be adjusted. Specifically, your hourly rate will increase from {{pay_rate}} to the New BCBA Hourly Rate, effective on the first pay period following the submission of your official BCBA certification to Human Resources.\n\nAt-Will Employment\nPlease note that this offer letter is not a contract or guarantee of employment for a definitive period of time. Your employment with Maha Behavioral Health is \"at-will,\" meaning that either you or the company may terminate the employment relationship at any time, with or without cause or advance notice.\n\nTo accept this offer, please sign and date this letter below and return it to info@mahabehavioralhealth.com.\n\nIf you have any questions regarding these terms, please don't hesitate to reach out. We are incredibly excited about the prospect of you joining Maha Behavioral Health and growing your clinical career with us!\n\nWarmly,\nHarini Chandramouli, MS, BCBA (She/her)\nFounder and Clinical Director\nMaha Behavioral Health";
    $bcJd = "Behavior Consultants considered for employment by MAHA BEHAVIORAL HEALTH SERVICES will meet the following requirements:\n\n\u2022 Must hold at minimum a bachelor's degree in behavior analysis, psychology, education, or a related field; master's degree strongly preferred.\n\u2022 Must be eligible to sit for the Board Certified Behavior Analyst\u00ae (BCBA\u00ae) exam or have recently completed the required supervised fieldwork hours.\n\u2022 Maintain active registration/certification status with the Behavior Analyst Certification Board (BACB\u00ae) throughout employment.\n\u2022 Complete all required Medicaid Waiver training and documentation as applicable.\n\nJob Responsibilities and Expectations:\n\n\u2022 Assessment Assistance: Conduct functional behavior assessments (FBAs) and skills assessments (such as the VB-MAPP, AFLS, or Vineland) under the direct supervision of a credentialed BCBA.\n\u2022 Program Development: Draft behavior intervention plans (BIPs) and skill acquisition programs based on assessment data for supervisor review and approval.\n\u2022 Data System Management: Set up and maintain data collection systems (electronic or paper-based) to track client progress accurately.\n\u2022 Direct Therapy Implementation: Provide high-quality, direct Applied Behavior Analysis (ABA) therapy to clients during scheduled sessions if needed.\n\u2022 Progress Monitoring: Regularly review client data to evaluate the effectiveness of current interventions and suggest program modifications to the supervising BCBA.\n\u2022 Crisis Intervention: Implement approved safety and crisis management protocols when challenging behaviors escalate.\n\u2022 RBT Support & Mentorship: Provide peer modeling, guidance, and fidelity checks to Registered Behavior Technicians (RBTs) on behavior plans and data collection techniques.\n\u2022 Caregiver Training: Assist in conducting parent/caregiver training sessions to teach strategies that promote behavior generalization at home.\n\u2022 Interdisciplinary Collaboration: Coordinate with the supervising BCBA and multi-disciplinary team members (speech therapists, occupational therapists, teachers) to ensure consistency in client care.\n\u2022 Clinical Documentation: Complete timely, professional, and accurate session notes, progress reports, and insurance authorization updates.\n\u2022 Supervision Compliance: Proactively schedule, track, and document monthly supervised fieldwork hours in strict accordance with BACB requirements as applicable.\n\u2022 Ethical & Regulatory Adherence: Maintain strict adherence to the BACB's Ethics Code for Behavior Analysts and HIPAA confidentiality guidelines.";

    $seed = $conn->prepare("INSERT IGNORE INTO OfferLetterPositions (position_code, position_name, offer_letter_template, job_description_template) VALUES (?, ?, ?, ?), (?, ?, ?, ?)");
    if ($seed) {
        $rbtCode = 'RBT'; $rbtName = 'Registered Behavior Technician';
        $bcCode = 'BC';   $bcName = 'Behavior Consultant';
        $seed->bind_param("ssssssss", $rbtCode, $rbtName, $rbtTemplate, $rbtJd, $bcCode, $bcName, $bcTemplate, $bcJd);
        $seed->execute();
        $seed->close();
    }
}

try {
    // Optional: filter by position_code for a single record.
    $code = isset($_GET['code']) ? trim((string)$_GET['code']) : '';

    if ($code !== '') {
        $stmt = $conn->prepare("SELECT position_id, position_code, position_name, offer_letter_template, job_description_template, is_active FROM OfferLetterPositions WHERE position_code = ? LIMIT 1");
        if (!$stmt) throw new Exception('Query failed');
        $stmt->bind_param("s", $code);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Position not found']);
            exit;
        }
        $row['position_id'] = (int)$row['position_id'];
        $row['is_active'] = (int)$row['is_active'];
        echo json_encode(['success' => true, 'position' => $row]);
    } else {
        $stmt = $conn->prepare("SELECT position_id, position_code, position_name, offer_letter_template, job_description_template, is_active FROM OfferLetterPositions WHERE is_active = 1 ORDER BY position_name ASC");
        if (!$stmt) throw new Exception('Query failed');
        $stmt->execute();
        $res = $stmt->get_result();
        $positions = [];
        while ($row = $res->fetch_assoc()) {
            $row['position_id'] = (int)$row['position_id'];
            $row['is_active'] = (int)$row['is_active'];
            $positions[] = $row;
        }
        $stmt->close();
        echo json_encode(['success' => true, 'positions' => $positions]);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conn->close();
