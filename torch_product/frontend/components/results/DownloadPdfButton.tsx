'use client';

import { useState } from 'react';
import { getToken } from '@/lib/api';

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');

type Props = {
  assessmentId: string;
  filename: string;
  disabled?: boolean;
};

export function DownloadPdfButton({ assessmentId, filename, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/api/assessments/${assessmentId}/pdf`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('PDF generation failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-meta" style={{ color: 'var(--color-flame-700)' }}>
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={download}
        disabled={busy || disabled}
        className="btn btn-flame"
      >
        {busy ? 'Generating…' : 'Download PDF Report'}
      </button>
    </div>
  );
}
