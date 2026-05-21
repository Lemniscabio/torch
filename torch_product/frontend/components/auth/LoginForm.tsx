'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/schemas';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
type AuthFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
};

export function LoginForm({
  mode: initialMode,
  next,
  resetToken,
}: {
  mode: Mode;
  next: string;
  resetToken?: string;
}) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const schema = isReset
    ? resetPasswordSchema
    : isForgot
      ? forgotPasswordSchema
      : isSignup
        ? signUpSchema
        : signInSchema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AuthFormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  function switchMode(to: Mode) {
    setMode(to);
    setFormError(null);
    setSuccessMessage(null);
    reset();
    const url = new URL(window.location.href);
    if (to === 'signup') url.searchParams.set('mode', 'signup');
    else if (to === 'forgot') url.searchParams.set('mode', 'forgot');
    else if (to === 'reset') url.searchParams.set('mode', 'reset');
    else url.searchParams.delete('mode');
    if (to !== 'reset') url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
  }

  async function onSubmit(values: AuthFormValues) {
    setFormError(null);
    setSuccessMessage(null);
    try {
      if (isForgot) {
        await api('/api/auth/forgot-password', {
          authed: false,
          method: 'POST',
          body: JSON.stringify({ email: values.email }),
        });
        setSuccessMessage('If an account exists for that email, we sent a reset link.');
        return;
      }
      if (isReset) {
        if (!resetToken) {
          setFormError('Reset link is missing or expired.');
          return;
        }
        await api('/api/auth/reset-password', {
          authed: false,
          method: 'POST',
          body: JSON.stringify({ token: resetToken, password: values.password }),
        });
        reset();
        setMode('login');
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
        setSuccessMessage('Password updated. You can sign in now.');
        return;
      }
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
        {isReset
          ? 'Choose a new password.'
          : isForgot
            ? 'Reset your password.'
            : isSignup
              ? 'Create your account.'
              : 'Sign in to Torch.'}
      </h1>
      <p className="text-body mb-10" style={{ color: 'var(--color-ink-500)' }}>
        {isReset
          ? 'Enter a new password for your account.'
          : isForgot
            ? 'We will send a secure reset link to your email.'
            : isSignup
              ? 'Use your work email. We do not accept personal addresses.'
              : 'Welcome back.'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {!isReset ? (
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
        ) : null}

        {!isForgot ? (
          <Field
            label={isReset ? 'New password' : 'Password'}
            htmlFor="password"
            hint={isSignup || isReset ? 'At least 8 characters.' : undefined}
            error={errors.password?.message as string | undefined}
          >
            <Input
              id="password"
              type="password"
              autoComplete={isSignup || isReset ? 'new-password' : 'current-password'}
              autoFocus={isReset}
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
        ) : null}

        {isSignup || isReset ? (
          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message as string | undefined}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
          </Field>
        ) : null}

        {formError ? (
          <p
            role="alert"
            className="text-meta -mt-1"
            style={{ color: 'var(--color-danger-fg)' }}
          >
            {formError}
          </p>
        ) : null}

        {successMessage ? (
          <p
            role="status"
            className="text-meta -mt-1"
            style={{ color: 'var(--color-ink-700)' }}
          >
            {successMessage}
          </p>
        ) : null}

        <Button type="submit" loading={isSubmitting} fullWidth>
          {isReset
            ? 'Update password'
            : isForgot
              ? 'Send reset link'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
        </Button>
      </form>

      <div className="rule mt-10 pt-6">
        {!isSignup && !isForgot && !isReset ? (
          <p className="text-meta mb-3">
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="underline decoration-[var(--color-ink-300)] underline-offset-[3px] transition-colors hover:decoration-[var(--color-ink-900)]"
              style={{ color: 'var(--color-ink-900)' }}
            >
              Forgot password?
            </button>
          </p>
        ) : null}
        <p className="text-meta">
          {isReset || isForgot
            ? 'Remembered it?'
            : isSignup
              ? 'Already have an account?'
              : 'New to Torch?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(isSignup || isForgot || isReset ? 'login' : 'signup')}
            className="underline decoration-[var(--color-ink-300)] underline-offset-[3px] transition-colors hover:decoration-[var(--color-ink-900)]"
            style={{ color: 'var(--color-ink-900)' }}
          >
            {isSignup || isForgot || isReset ? 'Sign in instead' : 'Create an account'}
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
