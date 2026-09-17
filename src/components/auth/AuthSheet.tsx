'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LoginForm, RegisterForm } from './AuthForms';

interface AuthConfig {
  turnstileSiteKey: string;
  turnstileDisabled: boolean;
  turnstileRequired: boolean;
  emailVerificationRequired: boolean;
}

/**
 * Sign-in surface that opens over whatever the person was reading — a bottom
 * sheet on mobile, a centred dialog above it. This is the one place a shadow is
 * used, because the surface is genuinely temporary and above the page.
 */
export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    fetch('/api/auth/config')
      .then((response) => response.json())
      .then((data: AuthConfig) => setConfig(data))
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-sheet-title"
        className="pop-in relative max-h-[92dvh] w-full overflow-y-auto border-2 border-ink on-paper bg-paper p-5 pb-8 text-ink sm:max-w-[440px] sm:p-7"
        style={{ boxShadow: 'var(--shadow-overlay)' }}
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-9 bg-[rgb(23_20_15_/_0.2)] sm:hidden" />

        <h2 id="auth-sheet-title" className="display-sm m-0 text-[clamp(22px,2.4vw,28px)]">
          Sign in to react
        </h2>
        <p className="mt-2 text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.68)]">
          Sign in to keep your reactions, track your opinion and continue where you left off.
        </p>

        <div
          role="tablist"
          aria-label="Sign in or create an account"
          className="mb-6 mt-5 flex border-b-2 border-[var(--rule-default)]"
        >
          {(['register', 'login'] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`relative -mb-0.5 border-b-[3px] px-3 pb-2.5 text-[13px] leading-none transition-colors duration-150 ${
                mode === value
                  ? 'border-[color:var(--color-egg)] font-extrabold text-ink'
                  : 'border-transparent font-semibold text-[rgb(23_20_15_/_0.55)] hover:text-ink'
              }`}
            >
              {value === 'register' ? 'Create account' : 'Sign in'}
            </button>
          ))}
        </div>

        {config ? (
          mode === 'login' ? (
            <LoginForm
              siteKey={config.turnstileSiteKey}
              turnstileDisabled={config.turnstileDisabled}
              turnstileRequired={config.turnstileRequired}
              redirectTo={pathname}
              compact
              onAuthenticated={onClose}
            />
          ) : (
            <RegisterForm
              siteKey={config.turnstileSiteKey}
              turnstileDisabled={config.turnstileDisabled}
              turnstileRequired={config.turnstileRequired}
              emailVerificationRequired={config.emailVerificationRequired}
              redirectTo={pathname}
              compact
              onAuthenticated={onClose}
            />
          )
        ) : (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-11" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
