-- Test Users for Role-Based Access Testing
-- Password for all test users: Test@123

-- HR User - Can submit and view all staff entries
INSERT INTO `Users` (`username`, `password_hash`, `email`, `role`, `is_active`)
VALUES (
  'hr_test',
  '$2y$10$Fm9IppmZnhVgLFV6LF2gFemN6IsVsI4TJ74mEbkYspGPVfJCVVJjm', -- Test@123
  'hr@mahabehavioralhealth.com',
  'hr',
  1
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- Staff User - Can submit forms for themselves, view their own entries
INSERT INTO `Users` (`username`, `password_hash`, `email`, `role`, `is_active`)
VALUES (
  'staff_test',
  '$2y$10$Fm9IppmZnhVgLFV6LF2gFemN6IsVsI4TJ74mEbkYspGPVfJCVVJjm', -- Test@123
  'staff@mahabehavioralhealth.com',
  'staff',
  1
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- Viewer/Reader User - Read-only access, can search by name/email
INSERT INTO `Users` (`username`, `password_hash`, `email`, `role`, `is_active`)
VALUES (
  'viewer_test',
  '$2y$10$Fm9IppmZnhVgLFV6LF2gFemN6IsVsI4TJ74mEbkYspGPVfJCVVJjm', -- Test@123
  'viewer@mahabehavioralhealth.com',
  'viewer',
  1
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- Additional test user for reader role (maps to viewer)
INSERT INTO `Users` (`username`, `password_hash`, `email`, `role`, `is_active`)
VALUES (
  'reader_test',
  '$2y$10$Fm9IppmZnhVgLFV6LF2gFemN6IsVsI4TJ74mEbkYspGPVfJCVVJjm', -- Test@123
  'reader@mahabehavioralhealth.com',
  'viewer',
  1
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- Test Results:
-- admin: username 'admin', password 'Admin@123' (already exists)
-- hr: username 'hr_test', password 'Test@123'
-- staff: username 'staff_test', password 'Test@123'
-- viewer: username 'viewer_test', password 'Test@123'
-- reader: username 'reader_test', password 'Test@123' (maps to viewer role)


reader_test Test@123 : for reader
viewer_test Test@123 : for viewer
* Login (dashboard only)
* Cannot submit forms (redirected to dashboard)

staff_test Test@123 : for staff
* Login and submit profile forms
* View ONLY their own submitted entries ("My Staff Entries")

hr_test Test@123 : for hr
* Login and access all features
* Can submit profile forms
* Can view all staff entries in "All Staff Entries"
* Can view all attachments

admin Admin@123 : for admin
* Login and access all features
* Can submit profile forms
* Can view all staff entries in "All Staff Entries"
* Can view all attachments