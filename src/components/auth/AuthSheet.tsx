'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LoginForm, RegisterForm } from './AuthForms';
import { reactionStore } from '@/lib/client/reaction-store';
import { formatCount } from '@/lib/domain/format';

/**
 * Sign-in surface that opens over whatever the person was reacting to.
 * A bottom sheet on mobile, a centred dialog on larger screens — their held
 * taps stay buffered the whole time and are applied on success.
 */
export function AuthSheet({
  open,
  onClose,
  pendingCount,
}: {
  open: boolean;
  onClose: () => void;
  pendingCount: number;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [config, setConfig] = useState<{ turnstileSiteKey: string; turnstileDisabled: boolean } | null>(null);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    fetch('/api/auth/config')
      .then((response) => response.json())
      .then((data: { turnstileSiteKey: string; turnstileDisabled: boolean }) => setConfig(data))
      .catch(() => setConfig(null));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const focusTimer = setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      clearTimeout(focusTimer);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const held = pendingCount || reactionStore.pendingAnonymousReactions().reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close sign-in"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-sheet-title"
        className="glass-strong relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-8 sm:max-w-md sm:rounded-[28px] sm:p-7"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />

        <div className="mb-5">
          <p className="label-caps text-brand-bright">Your taps are safe</p>
          <h2 id="auth-sheet-title" className="mt-2 text-2xl font-bold leading-tight text-chalk">
            {held > 0 ? `${formatCount(held)} ${held === 1 ? 'reaction' : 'reactions'} waiting to land` : 'Make it count'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-haze">
            {held > 0
              ? 'Sign in and we will add them to the public counter straight away.'
              : 'Anyone can watch the numbers move. Sending reactions needs an account — one email confirmation, then a PIN.'}
          </p>
        </div>

        <div role="tablist" aria-label="Sign in or create an account" className="mb-5 flex rounded-full bg-black/40 p-1">
          {(['register', 'login'] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                mode === value ? 'bg-white/12 text-chalk' : 'text-haze hover:text-chalk'
              }`}
            >
              {value === 'register' ? 'Create account' : 'Log in'}
            </button>
          ))}
        </div>

        {config ? (
          mode === 'login' ? (
            <LoginForm
              siteKey={config.turnstileSiteKey}
              turnstileDisabled={config.turnstileDisabled}
              redirectTo={pathname}
              compact
              onAuthenticated={onClose}
            />
          ) : (
            <RegisterForm
              siteKey={config.turnstileSiteKey}
              turnstileDisabled={config.turnstileDisabled}
              redirectTo={pathname}
              compact
            />
          )
        ) : (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
