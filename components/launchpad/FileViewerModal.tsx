'use client';

import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAttachmentDownloadUrl, getAttachmentViewUrl } from '@/lib/launchpad/api';

interface FileViewerModalProps {
  isOpen: boolean;
  attachmentId: number;
  filename: string;
  mimeType: string;
  shareKey?: string;
  onClose: () => void;
}

export default function FileViewerModal({
  isOpen,
  attachmentId,
  filename,
  mimeType,
  shareKey,
  onClose,
}: FileViewerModalProps) {
  if (!isOpen) return null;

  const viewUrl = getAttachmentViewUrl(attachmentId, shareKey ? { share_key: shareKey } : undefined);
  const downloadUrl = getAttachmentDownloadUrl(attachmentId, shareKey ? { share_key: shareKey } : undefined);

  // Determine if we can display inline (PDFs and images)
  const canDisplayInline = mimeType === 'application/pdf' || mimeType.startsWith('image/');

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
            <h3 className="text-lg font-semibold text-slate-800 truncate">{filename}</h3>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(downloadUrl, '_blank');
              }}
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
              {mimeType === 'application/pdf' ? (
                <iframe
                  src={viewUrl}
                  className="w-full h-full min-h-[600px] border border-slate-300 rounded-lg"
                  title={filename}
                />
              ) : (
                <img
                  src={viewUrl}
                  alt={filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-slate-600 mb-4">
                This file type cannot be previewed. Please download to view.
              </p>
              <Button
                onClick={() => {
                  window.open(downloadUrl, '_blank');
                }}
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

