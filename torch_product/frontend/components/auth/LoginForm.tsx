'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from '@/lib/schemas';
import { useAuth } from '@/lib/auth-context';
import type { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';

type Mode = 'login' | 'signup';

export function LoginForm({ mode: initialMode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [formError, setFormError] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const schema = isSignup ? signUpSchema : signInSchema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SignInInput | SignUpInput>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  function switchMode(to: Mode) {
    setMode(to);
    setFormError(null);
    reset();
    const url = new URL(window.location.href);
    if (to === 'signup') url.searchParams.set('mode', 'signup');
    else url.searchParams.delete('mode');
    window.history.replaceState({}, '', url.toString());
  }

  async function onSubmit(values: SignInInput | SignUpInput) {
    setFormError(null);
    try {
      if (isSignup) await signUp(values.email, values.password);
      else await signIn(values.email, values.password);
      router.replace(next);
    } catch (err) {
      const apiErr = err as ApiError;
      setFormError(apiErr.error || 'Something went wrong. Try again.');
    }
  }

  return (
    <>
      <h1 className="text-display mb-1">
        {isSignup ? 'Create your account.' : 'Sign in to Torch.'}
      </h1>
      <p className="text-body mb-10" style={{ color: 'var(--color-ink-500)' }}>
        {isSignup
          ? 'Use your work email. We do not accept personal addresses.'
          : 'Welcome back.'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <Field
          label="Work email"
          htmlFor="email"
          error={errors.email?.message as string | undefined}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            inputMode="email"
            placeholder="you@company.com"
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={isSignup ? 'At least 8 characters.' : undefined}
          error={errors.password?.message as string | undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            invalid={!!errors.password}
            {...register('password')}
          />
        </Field>

        {formError ? (
          <p
            role="alert"
            className="text-meta -mt-1"
            style={{ color: 'var(--color-danger-fg)' }}
          >
            {formError}
          </p>
        ) : null}

        <Button type="submit" loading={isSubmitting} fullWidth>
          {isSignup ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <div className="rule mt-10 pt-6">
        <p className="text-meta">
          {isSignup ? 'Already have an account?' : 'New to Torch?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? 'login' : 'signup')}
            className="underline decoration-[var(--color-ink-300)] underline-offset-[3px] transition-colors hover:decoration-[var(--color-ink-900)]"
            style={{ color: 'var(--color-ink-900)' }}
          >
            {isSignup ? 'Sign in instead' : 'Create an account'}
          </button>
        </p>
        <p className="text-meta mt-3">
          <Link
            href="https://lemnisca.bio/torch"
            className="underline decoration-[var(--color-ink-300)] underline-offset-[3px] transition-colors hover:decoration-[var(--color-ink-900)]"
          >
            ← Back to lemnisca.bio/torch
          </Link>
        </p>
      </div>
    </>
  );
}
