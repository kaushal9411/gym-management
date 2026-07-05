import { Footer } from './footer';
import { FloatingHelpButton } from './floating-help-button';
import { Header } from './header';
import { Sidebar } from './sidebar';

/** Full application shell for every authenticated portal route: sidebar + header + page content + footer. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
      <FloatingHelpButton />
    </div>
  );
}
