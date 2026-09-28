'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ShareKeyModalProps {
  isOpen: boolean;
  shareKey?: string;
  expiresAt?: string;
  error?: string;
  onClose: () => void;
}

export default function ShareKeyModal({
  isOpen,
  shareKey,
  expiresAt,
  error,
  onClose,
}: ShareKeyModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!shareKey) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 modal-backdrop transition-opacity duration-300 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 transform transition-all duration-300">
        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {error ? 'Share Key Error' : 'Share Key Generated'}
        </h3>
        {error ? (
          <p className="text-slate-600 mb-6">{error}</p>
        ) : (
          <>
            <p className="text-slate-600 mb-4">
              This key expires {expiresAt ? `at ${expiresAt}` : 'in 36 hours'}.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={shareKey || ''}
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-mono"
              />
              <Button onClick={handleCopy} className="bg-teal-600 hover:bg-teal-700">
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

