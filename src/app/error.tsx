"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5e6c8] p-8 text-center">
      <h2 className="text-xl font-bold text-amber-950">Something went wrong</h2>
      <p className="max-w-md text-sm text-amber-900/70">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white"
      >
        Try again
      </button>
    </div>
  );
}
