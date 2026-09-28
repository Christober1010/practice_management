-- Stores a single Google Drive OAuth refresh token for the app (encrypted at rest).
-- This is used only if GOOGLE_DRIVE_AUTH_MODE=oauth.
--
-- IMPORTANT: set GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY (base64 of 32 random bytes) on the server.

CREATE TABLE IF NOT EXISTS GoogleDriveOAuthTokens (
  id INT PRIMARY KEY,
  refresh_token_encrypted TEXT NOT NULL,
  connected_by_user_id INT NULL,
  connected_by_username VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Single-row table pattern
INSERT IGNORE INTO GoogleDriveOAuthTokens (id, refresh_token_encrypted)
VALUES (1, ''); 


