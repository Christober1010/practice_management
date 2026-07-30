# Remaining Setup Steps for Google Drive Integration

Based on the status check, here's what needs to be completed:

## ✅ Already Configured

- ✅ Environment variables are set correctly
- ✅ `drive_helper.php` is present and loaded
- ✅ All required PHP files are in place
- ✅ Database connection is working

## ❌ Issues to Fix

### 1. Missing Vendor Folder (CRITICAL)

**Problem:** `vendor/autoload.php` is missing, which means Google API client cannot be loaded.

**Solution:** Upload the `vendor/` folder from `maha-launchpad/` to your server.

**Steps:**
1. On your local machine, navigate to the `maha-launchpad` directory
2. Upload the entire `vendor/` folder to your server at:
   - `/homepages/13/d1011178552/htdocs/maha-launchpad/vendor/`
   
   OR if you prefer to keep it separate:
   - `/homepages/13/d1011178552/htdocs/mahaverse-backend-test/vendor/`
   
   (If you put it in `mahaverse-backend-test/vendor/`, you'll need to update the path resolution in `upload-client-document.php`)

**Alternative:** If you have SSH access, you can install via Composer:
```bash
cd /homepages/13/d1011178552/htdocs/maha-launchpad
composer install
```

### 2. Wrong OAuth Redirect URI

**Problem:** Your `.env` file has:
```
GOOGLE_DRIVE_OAUTH_REDIRECT_URI=https://mahaverse-dev.mahabehavioralhealth.com/backend-test/drive_oauth_callback.php
```

**Should be:**
```
GOOGLE_DRIVE_OAUTH_REDIRECT_URI=https://www.mahabehavioralhealth.com/mahaverse-backend-test/drive_oauth_callback.php
```

**Steps:**
1. Edit `/homepages/13/d1011178552/htdocs/mahaverse-backend-test/.env`
2. Update the `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` line
3. **IMPORTANT:** Also add this exact URI to Google Cloud Console:
   - Go to https://console.cloud.google.com/
   - Navigate to: APIs & Services → Credentials
   - Click on your OAuth 2.0 Client ID (the one you created for this app)
   - Under "Authorized redirect URIs", add:
     ```
     https://www.mahabehavioralhealth.com/mahaverse-backend-test/drive_oauth_callback.php
     ```
   - Save and wait 2-5 minutes for changes to propagate

### 3. Missing Database Table

**Problem:** `GoogleDriveOAuthTokens` table doesn't exist in your database.

**Solution:** Run the SQL script to create the table.

**Steps:**
1. Open your database management tool (phpMyAdmin, MySQL Workbench, etc.)
2. Select your test database
3. Run the SQL from `migration/shared/20260325_205126_create_google_drive_oauth_tokens_table.sql`:

```sql
CREATE TABLE IF NOT EXISTS GoogleDriveOAuthTokens (
  id INT PRIMARY KEY,
  refresh_token_encrypted TEXT NOT NULL,
  connected_by_user_id INT NULL,
  connected_by_username VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO GoogleDriveOAuthTokens (id, refresh_token_encrypted)
VALUES (1, '');
```

## After Fixing These Issues

1. **Re-run the status check:**
   ```
   https://www.mahabehavioralhealth.com/mahaverse-backend-test/check-drive-status-simple.php
   ```

2. **Verify the status shows:**
   - `google_client_available: true`
   - `database.oauth_table_exists: true`
   - `overall_status: "ready"` (or `configured_but_not_connected` if OAuth not completed yet)

3. **Complete OAuth Connection:**
   - Visit: `https://www.mahabehavioralhealth.com/mahaverse-backend-test/drive_oauth_start.php`
   - Follow the prompts to authorize Google Drive access
   - After successful connection, the status should show `overall_status: "ready"`

4. **Test Document Upload:**
   - Try uploading a document in the client documents tab
   - Check that it appears in Google Drive under the root folder

## Summary Checklist

- [ ] Upload `vendor/` folder to server
- [ ] Update `.env` file with correct redirect URI
- [ ] Add redirect URI to Google Cloud Console
- [ ] Create `GoogleDriveOAuthTokens` table in database
- [ ] Re-run status check
- [ ] Complete OAuth connection flow
- [ ] Test document upload

