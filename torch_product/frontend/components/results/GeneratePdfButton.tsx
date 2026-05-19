'use client';

// Lazy-loads @react-pdf/renderer + the PdfReport definition on click so
// neither lands in the main bundle. Generates the Blob client-side and
// triggers a download via an ephemeral anchor.

import { useState } from 'react';
import type { ProcessInputs, PartialAssessmentResult } from '@torch/core-shared';
import { speciesLabel } from '@/lib/format';

type Props = {
  inputs: ProcessInputs;
  results: PartialAssessmentResult;
  disabled?: boolean;
};

function filename(inputs: ProcessInputs): string {
  const species = speciesLabel(inputs.organism_species).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const date = new Date().toISOString().slice(0, 10);
  return `lemnisca-torch-${species}-${date}.pdf`;
}

export function GeneratePdfButton({ inputs, results, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { PdfReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/lib/pdf/PdfReport'),
      ]);
      const blob = await pdf(<PdfReportDocument inputs={inputs} results={results} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename(inputs);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('PDF generation failed', err);
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
        onClick={generate}
        disabled={busy || disabled}
        className="btn btn-flame"
      >
        {busy ? 'Generating…' : 'Generate PDF Report'}
      </button>
    </div>
  );
}
