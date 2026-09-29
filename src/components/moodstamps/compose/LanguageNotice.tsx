/**
 * The rule, stated before anyone types: MoodStamps carry criticism, not
 * abuse. Said up front so the first time a sender meets it is not as an
 * error on something they already wrote.
 */
export function LanguageNotice() {
  return (
    <aside aria-labelledby="moodstamp-language-heading" className="msc-notice">
      <span aria-hidden="true" className="msc-notice-icon">
        !
      </span>
      <div>
        <h2 id="moodstamp-language-heading" className="text-[15px] font-extrabold leading-snug">
          Keep it honest, not hurtful.
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[rgb(23_20_15/0.78)]">
          A MoodStamp can carry hard criticism — not abuse. Swearing, sexual or 18+ content, slurs, personal insults and
          threats are blocked, in English and Hindi. Criticise what happened, not who they are.
        </p>
      </div>
    </aside>
  );
}

/** Shown under a field the moment its text crosses the line, and read out when it appears. */
export function FieldWarning({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={id} role="status" aria-live="polite" className={message ? 'msc-warning' : 'sr-only'}>
      {message && (
        <>
          <span aria-hidden="true" className="msc-warning-icon">
            !
          </span>
          <span>{message}</span>
        </>
      )}
    </p>
  );
}
