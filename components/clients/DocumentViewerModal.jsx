'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DocumentViewerModal({
  isOpen,
  documentPath,
  filename,
  documentFilename,
  baseUrl,
  onClose,
}) {
  if (!isOpen) return null;

  const isDrivePath = !!documentPath && documentPath.startsWith('drive://');
  const driveFileIdFromPath = isDrivePath ? documentPath.slice('drive://'.length) : null;
  // Prefer documentFilename because legacy rows used drive://<folderId> in document_path.
  const driveFileId = (documentFilename && String(documentFilename).trim() !== '' ? documentFilename : driveFileIdFromPath);
  const isDriveFile = !!driveFileId;

  const extractUploadsRelPath = (path) => {
    if (!path) return null;
    // If we already have a relative uploads path, keep it.
    if (path.startsWith('uploads/')) return path;
    // If it's a full URL, try to extract /uploads/... portion.
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const u = new URL(path);
        const idx = u.pathname.indexOf('/uploads/');
        if (idx >= 0) return u.pathname.slice(idx + 1); // drop leading '/'
      } catch {
        return null;
      }
    }
    return null;
  };

  const uploadsRelPathRaw = !isDriveFile ? extractUploadsRelPath(documentPath) : null;
  const uploadsRelPath =
    uploadsRelPathRaw &&
    (uploadsRelPathRaw.endsWith('/documents') || uploadsRelPathRaw.endsWith('/documents/')) &&
    documentFilename
      ? `${uploadsRelPathRaw.replace(/[\\/]+$/, '')}/${documentFilename}`
      : uploadsRelPathRaw;

  // Build URLs for viewing and downloading
  const buildUrl = (path, isDownload = false) => {
    // Handle Drive files - extract file ID from path if documentFilename is empty
    const effectiveDriveFileId = driveFileId || (path?.startsWith('drive://') ? path.slice('drive://'.length) : null);
    if (effectiveDriveFileId) {
      const params = new URLSearchParams();
      params.set('file_id', effectiveDriveFileId);
      if (filename) params.set('filename', filename);
      const endpoint = isDownload ? 'download-client-document.php' : 'view-client-document.php';
      return baseUrl ? `${baseUrl}/${endpoint}?${params.toString()}` : `/${endpoint}?${params.toString()}`;
    }

    // Handle local uploads via proxy endpoints (avoids CORS/403 on direct Apache paths)
    if (uploadsRelPath) {
      const params = new URLSearchParams();
      params.set('path', uploadsRelPath);
      if (filename) params.set('filename', filename);
      const endpoint = isDownload ? 'download-client-upload.php' : 'view-client-upload.php';
      return baseUrl ? `${baseUrl}/${endpoint}?${params.toString()}` : `/${endpoint}?${params.toString()}`;
    }
    
    // Handle regular URLs
    if (path?.startsWith('http://') || path?.startsWith('https://')) {
      return path;
    }
    
    // Handle local file paths (never use drive:// as a relative path)
    if (path?.startsWith('drive://')) return null;
    const cleanPath = path?.startsWith('/') ? path.slice(1) : (path || '');
    return baseUrl ? `${baseUrl}/${cleanPath}` : `/${cleanPath}`;
  };

  const [viewBlobUrl, setViewBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detectedContentType, setDetectedContentType] = useState(null);

  const viewUrl = buildUrl(documentPath, false);
  const downloadUrl = buildUrl(documentPath, true);

  const sniffTypeFromName = (filePathOrName) => {
    if (!filePathOrName) return 'unknown';
    const extension = String(filePathOrName).split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'application/pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return `image/${extension}`;
    return 'unknown';
  };

  const mimeType = detectedContentType || sniffTypeFromName(filename || documentPath);
  const canDisplayInline = mimeType === 'application/pdf' || (typeof mimeType === 'string' && mimeType.startsWith('image/'));

  // Load file as blob for viewing (works for Drive + local proxy + avoids iframe/CORS weirdness)
  useEffect(() => {
    let currentBlobUrl = null;
    
    const shouldFetch = isOpen && (isDriveFile || !!uploadsRelPath);
    if (!shouldFetch) {
      setViewBlobUrl(null);
      setDetectedContentType(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    fetch(viewUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load file');
        }
        const ct = response.headers.get('content-type');
        if (ct) setDetectedContentType(ct);
        return response.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        currentBlobUrl = blobUrl;
        setViewBlobUrl(blobUrl);
        setLoading(false);
      })
      .catch(err => {
        console.error('View error:', err);
        setError(err.message);
        setLoading(false);
      });

    // Cleanup blob URL on unmount or when component closes
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [isOpen, isDriveFile, viewUrl]);

  // Prefer blob URLs when we fetched them; otherwise fall back to direct URL.
  const effectiveViewUrl = viewBlobUrl || viewUrl;

  const handleDownload = async () => {
    try {
      if (!downloadUrl) {
        alert('Download URL could not be built. Ensure NEXT_PUBLIC_BASE_URL is set for Drive/local documents.');
        return;
      }
      const response = await fetch(downloadUrl, { credentials: 'omit' });
      if (!response.ok) {
        let errMsg = `Download failed (${response.status})`;
        const ct = response.headers.get('content-type');
        const errText = await response.text().catch(() => '');
        if (ct && ct.includes('application/json') && errText) {
          try {
            const j = JSON.parse(errText);
            errMsg = j.message || errMsg;
          } catch { /* use errMsg */ }
        } else if (errText) errMsg = errText;
        throw new Error(errMsg);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file: ' + (error.message || 'Please try again.'));
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-75 z-50 transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 truncate">{filename || 'Document'}</h3>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-600 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          {canDisplayInline ? (
            <div className="w-full h-full flex items-center justify-center">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading document...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <p className="text-red-600 mb-4">Error loading document: {error}</p>
                  <Button
                    onClick={handleDownload}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              ) : mimeType === 'application/pdf' ? (
                <iframe
                  src={effectiveViewUrl}
                  className="w-full h-full min-h-[600px] border border-slate-300 rounded-lg"
                  title={filename}
                />
              ) : (
                <img
                  src={effectiveViewUrl}
                  alt={filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    // If image fails to load, show error message
                    const target = e.target;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full text-center p-8">
                          <p class="text-slate-600 mb-4">
                            Unable to display this file. Please download to view.
                          </p>
                          <button class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                            Download File
                          </button>
                        </div>
                      `;
                      const downloadBtn = parent.querySelector('button');
                      if (downloadBtn) {
                        downloadBtn.onclick = handleDownload;
                      }
                    }
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-slate-600 mb-4">
                This file type cannot be previewed. Please download to view.
              </p>
              <Button
                onClick={handleDownload}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

