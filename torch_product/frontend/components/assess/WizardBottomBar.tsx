'use client';

import { Button } from '@/components/ui/Button';

type Props = {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  finalStep?: boolean;
  errorSummary?: string | null;
};

export function WizardBottomBar({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  nextLoading,
  finalStep,
  errorSummary,
}: Props) {
  return (
    <div
      className="glass-surface sticky bottom-0 z-20 mt-12"
      style={{ borderTop: '1px solid var(--color-rule)' }}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3">
        <div className="min-w-0 flex-1">
          {errorSummary ? (
            <p
              role="alert"
              className="text-meta truncate"
              style={{ color: 'var(--color-danger-fg)' }}
            >
              {errorSummary}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          ) : null}
          <Button
            type="button"
            variant={finalStep ? 'strong' : 'primary'}
            onClick={onNext}
            loading={nextLoading}
            disabled={nextDisabled}
          >
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
