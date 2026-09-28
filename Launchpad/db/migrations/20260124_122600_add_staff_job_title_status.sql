-- Add job title and employment status fields to Staff
ALTER TABLE Staff
  ADD COLUMN job_title VARCHAR(255) NULL AFTER last_name,
  ADD COLUMN employment_status VARCHAR(100) NULL AFTER job_title;

