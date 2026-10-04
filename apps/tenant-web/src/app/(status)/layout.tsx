/** Full-screen shell for standalone status pages (no login split-screen). */
export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
