'use client';

import { useState, useTransition } from 'react';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { formatCount } from '@/lib/domain/format';
import { suspendAccountAction, restoreAccountAction, deleteAccountAction } from '@/app/admin/actions';
import type { AccountSummary } from '@/lib/services/accounts';

/**
 * The account list and its two moderation outcomes.
 *
 * Suspending is presented as the ordinary action and deleting as the one that
 * needs a second thought: it takes every reaction, opinion and comment with it
 * and moves the public counters. So deletion asks for the display name to be
 * typed back, which is slow on purpose.
 */
export function AccountsTable({ accounts, viewerId }: { accounts: AccountSummary[]; viewerId: string }) {
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [typedName, setTypedName] = useState('');
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    startTransition(async () => {
      const result = await action();
      setNotice({ ok: result.ok, message: result.message ?? (result.ok ? 'Done.' : 'That did not work.') });
      setConfirming(null);
      setTypedName('');
    });
  };

  if (accounts.length === 0) {
    return <p className="divider py-8 text-sm text-tertiary">No accounts match.</p>;
  }

  return (
    <div className={pending ? 'opacity-60 transition-opacity duration-150' : ''}>
      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-[var(--radius-control)] border px-4 py-3 text-sm ${
            notice.ok
              ? 'border-[var(--border-subtle)] bg-surface text-secondary'
              : 'border-[var(--border-default)] bg-surface text-error'
          }`}
        >
          {notice.message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left">
              <th scope="col" className="py-2.5 pr-4 font-medium text-tertiary">Person</th>
              <th scope="col" className="py-2.5 pr-4 font-medium text-tertiary">Joined</th>
              <th scope="col" className="py-2.5 pr-4 font-medium text-tertiary">Last seen</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium text-tertiary">Reactions</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium text-tertiary">Opinions</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium text-tertiary">Comments</th>
              <th scope="col" className="py-2.5 text-right font-medium text-tertiary">Actions</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((account) => {
              const isSelf = account.id === viewerId;
              const protectedAccount = isSelf || account.isAdmin;

              return (
                <tr key={account.id} className="border-b border-[var(--border-subtle)] align-top last:border-0">
                  <td className="py-3.5 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-primary">{account.displayName}</span>
                      {account.isAdmin && <Badge tone="brand">Admin</Badge>}
                      {isSelf && <Badge>You</Badge>}
                      {account.suspendedAt && <Badge tone="egg">Suspended</Badge>}
                      {!account.emailVerifiedAt && <Badge>Unverified</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-tertiary">{account.email}</p>
                    {account.suspendedReason && (
                      <p className="mt-1 text-xs text-egg">Reason: {account.suspendedReason}</p>
                    )}
                  </td>

                  <td className="py-3.5 pr-4 text-tertiary">
                    <RelativeTime iso={account.createdAt} />
                  </td>
                  <td className="py-3.5 pr-4 text-tertiary">
                    {account.lastSeenAt ? <RelativeTime iso={account.lastSeenAt} /> : '—'}
                  </td>

                  <td className="numeric py-3.5 pr-4 text-right text-secondary">{formatCount(account.reactionCount)}</td>
                  <td className="numeric py-3.5 pr-4 text-right text-secondary">{formatCount(account.opinionCount)}</td>
                  <td className="numeric py-3.5 pr-4 text-right text-secondary">{formatCount(account.commentCount)}</td>

                  <td className="py-3.5 text-right">
                    {protectedAccount ? (
                      <span className="text-xs text-disabled">{isSelf ? 'Your account' : 'Protected'}</span>
                    ) : confirming === account.id ? (
                      <div className="flex flex-col items-end gap-2">
                        <p className="max-w-[16rem] text-left text-xs leading-relaxed text-secondary">
                          This removes {formatCount(account.reactionCount)} reactions and{' '}
                          {formatCount(account.commentCount)} comments, and the public totals will drop. Type{' '}
                          <span className="text-primary">{account.displayName}</span> to confirm.
                        </p>
                        <input
                          value={typedName}
                          onChange={(event) => setTypedName(event.target.value)}
                          aria-label={`Type ${account.displayName} to confirm deletion`}
                          className="w-48 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-surface px-3 py-2 text-sm text-primary focus:border-[var(--border-strong)] focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirming(null);
                              setTypedName('');
                            }}
                            className="min-h-9 rounded-md border border-[var(--border-default)] px-3 text-xs text-secondary hover:border-[var(--border-strong)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={typedName !== account.displayName}
                            onClick={() => run(() => deleteAccountAction(account.id))}
                            className="min-h-9 rounded-md bg-brand px-3 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Delete for good
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {account.suspendedAt ? (
                          <button
                            type="button"
                            onClick={() => run(() => restoreAccountAction(account.id))}
                            className="min-h-9 rounded-md border border-[var(--border-default)] px-3 text-xs text-primary hover:border-[var(--border-strong)]"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt(`Why is ${account.displayName} being suspended?`) ?? '';
                              run(() => suspendAccountAction(account.id, reason));
                            }}
                            className="min-h-9 rounded-md border border-[var(--border-default)] px-3 text-xs text-primary hover:border-[var(--border-strong)]"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setConfirming(account.id);
                            setTypedName('');
                          }}
                          className="min-h-9 rounded-md px-3 text-xs text-tertiary transition-colors duration-150 hover:text-error"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'brand' | 'egg' }) {
  const colour =
    tone === 'brand' ? 'text-brand' : tone === 'egg' ? 'text-egg' : 'text-tertiary';
  return (
    <span className={`rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[0.6875rem] ${colour}`}>
      {children}
    </span>
  );
}
