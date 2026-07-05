import Link from 'next/link';

export default function SessionExpiredPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Your session has expired</h1>
      <p className="text-sm text-muted-foreground">Please sign in again to continue.</p>
      <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
