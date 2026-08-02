/**
 * App Router Suspense-fallback boundary — required so navigation into this
 * segment is non-blocking (the old page stays interactive while the new one
 * streams in), but renders nothing: `GlobalLoader` (mounted once in
 * `AppProviders`) is the app's single loading indicator, so this doesn't
 * need its own competing spinner.
 */
export default function Loading() {
  return null;
}
