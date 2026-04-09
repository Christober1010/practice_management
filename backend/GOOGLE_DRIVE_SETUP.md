# Google Drive Setup for Mahaverse

This document explains how to set up Google Drive integration for Mahaverse insurance document uploads.

## Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp backend/env.example backend/.env
   ```

2. **Edit `backend/.env` and configure:**
   - `GOOGLE_DRIVE_ENABLED=true`
   - `GOOGLE_DRIVE_AUTH_MODE=oauth`
   - OAuth credentials (can reuse same as launchpad)
   - Root folder ID for storing insurance documents

3. **Add OAuth Redirect URI to Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services > Credentials
   - Edit your OAuth 2.0 Client ID
   - Add authorized redirect URI: `https://mahaverse-dev.mahabehavioralhealth.com/backend/drive_oauth_callback.php`
   - Save changes

4. **Create OAuth Callback File (if needed):**
   - Copy `maha-launchpad/backend/drive_oauth_callback.php` to `backend/drive_oauth_callback.php`
   - Or create a symlink if both apps share the same callback logic

## Environment Variables

### Required for OAuth Mode:
- `GOOGLE_DRIVE_ENABLED=true`
- `GOOGLE_DRIVE_AUTH_MODE=oauth`
- `GOOGLE_DRIVE_OAUTH_CLIENT_ID` - Your OAuth client ID
- `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` - Your OAuth client secret
- `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` - Must match Google Cloud Console
- `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` - Base64 encoded 32-byte key
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` - Google Drive folder ID for storage

### Optional:
- `GOOGLE_DRIVE_SCOPES` - Default: `https://www.googleapis.com/auth/drive.file`
- `GOOGLE_DRIVE_SHARED_DRIVE_ID` - If using Shared Drives
- `SSN_ENCRYPTION_KEY` - For encrypting sensitive data

## Folder Structure

Insurance documents will be stored in Google Drive with this structure:
```
Root Folder (GOOGLE_DRIVE_ROOT_FOLDER_ID)
└── clients/
    └── client_<CLIENT_ID>/
        └── insurance_documents/
            └── <document_file>
```

## Testing

1. Upload an insurance document in the client form
2. Check Google Drive to verify the file was uploaded
3. Check the database to verify `insurance_document_path` and `insurance_document_filename` are stored

## Troubleshooting

- **OAuth errors**: Verify redirect URI matches exactly in Google Cloud Console
- **Upload fails**: Check error logs, verify folder permissions in Google Drive
- **Local fallback**: If Drive fails, files will be stored locally in `backend/uploads/`

