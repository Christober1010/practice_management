# Google Drive Status Check Guide

## Status Endpoint

Access the status endpoint to check your Google Drive integration:

**Production:**
```
https://www.mahabehavioralhealth.com/mahaverse-backend-logics/check-drive-status.php
```

**Test Environment:**
```
https://www.mahabehavioralhealth.com/mahaverse-backend-test/check-drive-status.php
```

## What the Status Endpoint Shows

The endpoint provides comprehensive information about:

1. **Environment Variables** - Which Google Drive config vars are set
2. **File Dependencies** - Whether drive_helper.php and vendor/autoload.php exist
3. **Connection Status** - OAuth connection, Drive API access, root folder accessibility
4. **Recommendations** - Actionable steps to fix any issues

## Common Issues and Solutions

### Issue: "Vendor folder not found"
**Solution:** Upload the `maha-launchpad/vendor/` folder to your server, or install dependencies via composer:
```bash
cd maha-launchpad
composer install
```

### Issue: "OAuth not connected"
**Solution:** 
1. Make sure `GoogleDriveOAuthTokens` table exists in your database
2. Complete the OAuth flow by visiting the OAuth start URL
3. Check that redirect URI is added to Google Cloud Console

### Issue: "Google Cloud Console changes pending"
**Solution:**
1. Go to https://console.cloud.google.com/
2. Navigate to: APIs & Services → Credentials
3. Click on your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", add:
   - `https://www.mahabehavioralhealth.com/mahaverse-backend-logics/drive_oauth_callback.php`
   - `https://www.mahabehavioralhealth.com/mahaverse-backend-test/drive_oauth_callback.php`
5. Save and wait 2-5 minutes for changes to propagate

### Issue: "drive_helper.php not found"
**Solution:** The file should be in the backend directory. If missing, copy it:
```bash
cp maha-launchpad/backend/drive_helper.php backend/drive_helper.php
cp maha-launchpad/backend/drive_helper.php backend-test/drive_helper.php
```
Note: On the server, these correspond to `mahaverse-backend-logics/` and `mahaverse-backend-test/` directories.

## Overall Status Values

- `ready` - Everything is configured and working
- `configured_but_not_connected` - Config is set but OAuth not connected
- `configured_but_client_failed` - Config set but Google Client creation failed
- `enabled_but_missing_files` - Drive enabled but vendor/drive_helper missing
- `not_configured` - Drive not enabled or missing basic config

## Next Steps After Status Check

1. Fix any issues shown in `recommendations`
2. Upload vendor folder if missing
3. Complete OAuth flow if not connected
4. Test document upload again

