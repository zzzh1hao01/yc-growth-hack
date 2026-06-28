"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="western-page-shell flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="western-title text-xl">Something went wrong</h2>
      <p className="western-body max-w-md">{error.message}</p>
      <button type="button" onClick={reset} className="western-btn western-btn-primary px-4 py-2">
        Try again
      </button>
    </div>
  );
}
