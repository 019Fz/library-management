// Shown by the route guards while the saved login is being checked.
export default function PageLoading() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center bg-surface">
      <p className="text-muted">Loading...</p>
    </div>
  );
}
