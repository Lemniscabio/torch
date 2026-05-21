'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getToken } from '@/lib/api';
import { captureEvent } from '@/lib/analytics';

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');

type Props = {
  assessmentId: string;
  filename: string;
  disabled?: boolean;
};

type ModalState = 'loading' | 'ready' | 'error';

export function DownloadPdfButton({ assessmentId, filename, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ModalState>('loading');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  function openModal() {
    if (disabled) return;
    captureEvent('pdf_download_clicked', { has_assessment_id: Boolean(assessmentId) });
    setOpen(true);
    setState('loading');
    fetchedRef.current = false;
    setBlobUrl(null);
  }

  function closeModal() {
    setOpen(false);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  }

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;

    const token = getToken();
    fetch(`${BACKEND_URL}/api/assessments/${assessmentId}/pdf`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setState('ready');
        captureEvent('pdf_download_completed', { has_assessment_id: Boolean(assessmentId) });
        // Auto-save to local disk as soon as the PDF arrives.
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(() => {
        setState('error');
        captureEvent('pdf_download_failed', { has_assessment_id: Boolean(assessmentId) });
      });
  }, [open, assessmentId]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={disabled}
        className="btn btn-strong"
      >
        Download PDF Report
      </button>

      {open && typeof document !== 'undefined' ? createPortal((
        <div
          role="dialog"
          aria-modal="true"
          aria-label="PDF preview"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 py-6"
        >
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={closeModal}
          />

          <div
            className="relative flex flex-col w-full rounded-2xl border shadow-[0_28px_90px_-44px_rgba(0,0,0,0.85)] overflow-hidden"
            style={{
              maxWidth: 860,
              height: '88vh',
              borderColor: 'var(--color-rule-strong)',
              background: 'var(--color-paper-100)',
            }}
          >
            {/* header */}
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--color-rule)' }}
            >
              <p className="text-[14px] font-semibold" style={{ color: 'var(--color-ink-800)' }}>
                PDF Report
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="btn btn-ghost"
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                Close
              </button>
            </div>

            {/* body */}
            <div className="flex-1 min-h-0 relative">
              {state === 'loading' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Spinner />
                  <p className="text-[13px]" style={{ color: 'var(--color-ink-400)' }}>
                    Generating PDF…
                  </p>
                </div>
              ) : state === 'error' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <p className="text-[14px]" style={{ color: 'var(--color-danger-fg)' }}>
                    PDF generation failed.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 13 }}
                    onClick={() => {
                      setState('loading');
                      fetchedRef.current = false;
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : blobUrl ? (
                <iframe
                  src={blobUrl}
                  className="w-full h-full"
                  style={{ border: 'none', display: 'block' }}
                  title="PDF preview"
                />
              ) : null}
            </div>
          </div>
        </div>
      ), document.body) : null}
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="pdf-spinner"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
    >
      <circle cx="14" cy="14" r="11" stroke="var(--color-rule-strong)" strokeWidth="3" />
      <path
        d="M14 3 A11 11 0 0 1 25 14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
