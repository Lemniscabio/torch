'use client';

// One react-hook-form instance shared by every step of the wizard. Each step
// pulls from the same `useFormContext()` so the user's earlier answers
// persist as they navigate forward and back. The form draft is also written
// to sessionStorage on every change so accidental reload doesn't lose data.

import {
  FormProvider,
  useForm,
  useWatch,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import {
  ASSESS_DEFAULTS,
  fullAssessSchema,
  type AssessFormValues,
} from '@/lib/assess-schema';
import { loadDraft, saveDraft } from '@/lib/assess-storage';

export function AssessFormProvider({ children }: { children: React.ReactNode }) {
  const initialValues = useMemo<Partial<AssessFormValues>>(() => {
    const draft = typeof window === 'undefined' ? null : loadDraft();
    // Strip null values — NaN fields serialise as null in JSON and would
    // otherwise override ASSESS_DEFAULTS, leaving required enum fields as null.
    const cleanDraft = draft
      ? Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== null))
      : {};
    return { ...ASSESS_DEFAULTS, ...cleanDraft };
  }, []);

  const methods = useForm<AssessFormValues>({
    resolver: zodResolver(fullAssessSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    delayError: 180,
    defaultValues: initialValues as AssessFormValues,
    shouldUnregister: false,
  });

  return (
    <FormProvider {...methods}>
      <DraftAutosave methods={methods} />
      {children}
    </FormProvider>
  );
}

// Tiny child component so the watch subscription stays scoped here rather
// than re-rendering the whole wizard tree on every keystroke.
function DraftAutosave({ methods }: { methods: UseFormReturn<AssessFormValues> }) {
  const values = useWatch({ control: methods.control });
  useEffect(() => {
    if (!values) return;
    saveDraft(values as Partial<AssessFormValues>);
  }, [values]);
  return null;
}
