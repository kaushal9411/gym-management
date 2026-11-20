import { HomeThemeDefault } from './home-theme-default';
import { AnalyticsSection } from './analytics-section';
import { AppsSection } from './apps-section';
import { BillingSection } from './billing-section';
import { ContactSection } from './contact-section';
import { CtaBand } from './cta-band';
import { FaqSection, StepsSection } from './content-sections';
import { FeatureShowcase } from './feature-showcase';
import { GallerySection } from './gallery-section';
import { HeroSection } from './hero-section';
import { ScrollProgress } from './motion';
import { PricingSection } from './pricing-section';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { StatsStrip } from './stats-strip';

/**
 * The public home page of the platform (what a visitor sees at the bare domain).
 * Light by default (it follows the app theme, so the toggle in the header, the
 * login screen and the register screen all stay in step). Login and Register
 * are links in the corner; the page never redirects by itself.
 */
export function HomePage({ name }: { name: string }) {
  return (
    <div className="home-root min-h-dvh bg-background text-foreground antialiased">
      <style>{`
        html { scroll-behavior: smooth; }
        .home-glow {
          background-image:
            radial-gradient(42% 38% at 12% 12%, rgba(255,106,53,0.16) 0%, transparent 70%),
            radial-gradient(40% 36% at 92% 70%, rgba(34,211,238,0.14) 0%, transparent 70%);
        }
        .dark .home-glow {
          background-image:
            radial-gradient(42% 38% at 12% 12%, rgba(255,106,53,0.26) 0%, transparent 70%),
            radial-gradient(40% 36% at 92% 70%, rgba(34,211,238,0.2) 0%, transparent 70%);
        }
        .home-grid {
          background-image: radial-gradient(circle, rgba(120,120,140,0.28) 1px, transparent 1.2px);
          background-size: 26px 26px;
          mask-image: radial-gradient(70% 60% at 50% 30%, #000 20%, transparent 75%);
          -webkit-mask-image: radial-gradient(70% 60% at 50% 30%, #000 20%, transparent 75%);
        }
        @keyframes home-shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        .home-shimmer { background-size: 200% 100%; animation: home-shimmer 6s linear infinite; }
        @keyframes home-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .home-marquee-track { animation: home-marquee 38s linear infinite; }
        .home-marquee:hover .home-marquee-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .home-shimmer, .home-marquee-track { animation: none; }
        }
      `}</style>
      <a href="#features" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg">
        Skip to content
      </a>
      <HomeThemeDefault />
      <ScrollProgress />
      <SiteHeader name={name} />
      <main>
        <HeroSection name={name} />
        <StatsStrip />
        <GallerySection />
        <FeatureShowcase />
        <AnalyticsSection />
        <BillingSection />
        <AppsSection />
        <StepsSection />
        <PricingSection />
        <FaqSection />
        <CtaBand name={name} />
        <ContactSection />
      </main>
      <SiteFooter name={name} />
    </div>
  );
}
