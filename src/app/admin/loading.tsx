/**
 * Shown the moment an admin link is clicked, inside the admin shell, while the
 * next page loads — so a click is answered at once rather than after the
 * server replies.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-6 w-48" />
      <div className="skeleton h-4 w-80 max-w-full" />
      <div className="space-y-2 pt-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="skeleton h-[92px] w-full" />
        ))}
      </div>
    </div>
  );
}
