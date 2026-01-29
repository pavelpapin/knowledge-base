"use client";

import { useTranslations } from "next-intl";
import { FadeIn } from "@/components/fade-in";
import { StatusLine } from "@/components/status-line";
import { Section, SectionLabel } from "@/components/section";
import { LogoMarquee } from "@/components/logo-marquee";
import { StickyCTA } from "@/components/sticky-cta";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DealVisibilityMockup, SLAViewMockup, ActionQueueMockup, OwnerDashboardMockup, PerspectiveFrame } from "@/components/mockups";

function ElioLogo({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block font-logo font-extrabold lowercase ${className ?? ""}`}
      aria-label="elio"
    >
      elio<span className="text-[#B8A990]">.</span>
    </span>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className={`opacity-40 rtl:rotate-180 ${className ?? ""}`}>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const securityIcons = [
  <svg key="lock" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>,
  <svg key="shield" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  <svg key="clock" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  <svg key="doc" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" /></svg>,
];

export default function Home() {
  const t = useTranslations();
  const dubaiCards: { title: string; desc: string }[] = t.raw("dubai.cards");
  const securityCards: { title: string; desc: string }[] = t.raw("security.cards");
  const pilotColumns: { label: string; items: string[] }[] = t.raw("pilot.columns");
  const realityQuestions: string[] = t.raw("reality.questions");
  const dealVisibilityTags: string[] = t.raw("dealVisibility.tags");
  const qualityTags: string[] = t.raw("quality.tags");
  const actionsTags: string[] = t.raw("actions.tags");

  return (
    <div className="min-h-screen bg-[#08090A] text-white font-sans v2-noise">
      <StickyCTA />

      {/* Hero */}
      <section className="relative v2-hero-bg">
        <nav className="relative z-10">
          <div className="max-w-[1000px] mx-auto px-6 sm:px-10 pt-6 sm:pt-8 flex items-center justify-between">
            <FadeIn variant="down" delay={0}>
              <ElioLogo className="text-[20px] sm:text-[24px] leading-none tracking-[-0.02em] text-[#E8E0D4]" />
            </FadeIn>
            <FadeIn variant="down" delay={0}>
              <LanguageSwitcher />
            </FadeIn>
          </div>
        </nav>
        <div className="pt-16 sm:pt-24 pb-16 sm:pb-24">
          <div className="max-w-[1000px] mx-auto px-6 sm:px-10 text-center">
            <FadeIn delay={120} variant="blur" duration={1.2}>
              <h1 className="mx-auto max-w-[20ch] text-[32px] sm:text-[72px] leading-[1.02] sm:leading-[0.98] tracking-[-0.035em]">
                <span className="font-light text-white/40">{t("hero.line1")}</span>
                <br />
                <span className="font-semibold text-gradient">{t("hero.line2")}</span>
              </h1>
            </FadeIn>
            <FadeIn delay={400} variant="none">
              <div className="mt-8 sm:mt-10">
                <StatusLine />
              </div>
            </FadeIn>
            <FadeIn delay={600} variant="scale">
              <div className="mt-10 sm:mt-14">
                <a
                  href="http://t.me/pashapapin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="v2-cta-glow inline-flex items-center gap-2.5 bg-[#E8E0D4] text-[#08090A] px-7 py-3.5 rounded-[10px] text-[14px] font-semibold hover:bg-[#F0EAE0] transition-colors duration-200"
                >
                  {t("nav.requestPilot")}
                  <ArrowIcon />
                </a>
                <a
                  href="#how"
                  className="block mt-5 text-[14px] text-white/20 hover:text-white/40 transition-colors duration-200"
                >
                  {t("nav.seeHow")} &darr;
                </a>
              </div>
            </FadeIn>
          </div>
        </div>

        <div className="pb-8 sm:pb-12">
          <div className="max-w-[1000px] mx-auto">
            <FadeIn delay={750} variant="none">
              <LogoMarquee />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Meet Elio */}
      <Section id="how">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <FadeIn variant="none"><SectionLabel>{t("meet.label")}</SectionLabel></FadeIn>
            <FadeIn delay={100} variant="blur">
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                {t("meet.title")}
              </h2>
            </FadeIn>
            <FadeIn delay={200}>
              <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
                {t("meet.desc")}
              </p>
            </FadeIn>
          </div>
          <FadeIn delay={300} variant="scale">
            <div className="lg:ltr:-mr-[15%] lg:rtl:-ml-[15%]">
              <PerspectiveFrame heroMode fadeDirection="left-bottom">
                <OwnerDashboardMockup />
              </PerspectiveFrame>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Deal Visibility */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <FadeIn variant="none"><SectionLabel>{t("dealVisibility.label")}</SectionLabel></FadeIn>
            <FadeIn delay={80} variant="blur">
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                {t("dealVisibility.title")}
              </h2>
            </FadeIn>
            <FadeIn delay={160}>
              <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
                {t("dealVisibility.desc")}
              </p>
            </FadeIn>
            <FadeIn delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                {dealVisibilityTags.map((tag) => (
                  <span key={tag} className="text-[12px] text-white/30 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={200} variant="scale">
            <div className="lg:ltr:-mr-[15%] lg:rtl:-ml-[15%]">
              <PerspectiveFrame fadeDirection="left-bottom">
                <DealVisibilityMockup />
              </PerspectiveFrame>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Quality & SLA */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <FadeIn delay={200} variant="scale" className="order-2 lg:order-1">
            <div className="lg:ltr:-ml-[15%] lg:rtl:-mr-[15%]">
              <PerspectiveFrame fadeDirection="bottom">
                <SLAViewMockup />
              </PerspectiveFrame>
            </div>
          </FadeIn>
          <div className="order-1 lg:order-2">
            <FadeIn variant="none"><SectionLabel>{t("quality.label")}</SectionLabel></FadeIn>
            <FadeIn delay={80} variant="blur">
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                {t("quality.title")}
              </h2>
            </FadeIn>
            <FadeIn delay={160}>
              <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
                {t("quality.desc")}
              </p>
            </FadeIn>
            <FadeIn delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                {qualityTags.map((tag) => (
                  <span key={tag} className="text-[12px] text-white/30 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </Section>

      {/* Smart Actions */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <FadeIn variant="none"><SectionLabel>{t("actions.label")}</SectionLabel></FadeIn>
            <FadeIn delay={80} variant="blur">
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                {t("actions.title")}
              </h2>
            </FadeIn>
            <FadeIn delay={160}>
              <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
                {t("actions.desc")}
              </p>
            </FadeIn>
            <FadeIn delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                {actionsTags.map((tag) => (
                  <span key={tag} className="text-[12px] text-white/30 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={200} variant="scale">
            <div className="lg:ltr:-mr-[15%] lg:rtl:-ml-[15%]">
              <PerspectiveFrame fadeDirection="left-bottom">
                <ActionQueueMockup />
              </PerspectiveFrame>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Reality check */}
      <Section>
        <FadeIn variant="none"><SectionLabel>{t("reality.label")}</SectionLabel></FadeIn>
        <FadeIn delay={80} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[22ch]">
            {t("reality.title")}
          </h2>
        </FadeIn>
        <FadeIn delay={160}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[52ch]">
            {t("reality.subtitle")}
          </p>
        </FadeIn>
        <div className="mt-14 sm:mt-20 space-y-4">
          {realityQuestions.map((question, i) => (
            <FadeIn key={i} delay={200 + i * 120} variant="left">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-9 flex gap-5 sm:gap-6">
                <span className="text-[28px] sm:text-[36px] font-medium tracking-[-0.03em] text-[#B8A990] leading-none shrink-0 pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[16px] sm:text-[18px] text-white/60 leading-[1.6]">
                  {question}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={600}>
          <p className="mt-8 text-[14px] text-[#B8A990]/60 leading-[1.6] text-center">
            {t("reality.footer")}
          </p>
        </FadeIn>
      </Section>

      {/* Why this matters in Dubai */}
      <Section>
        <FadeIn variant="none"><SectionLabel>{t("dubai.label")}</SectionLabel></FadeIn>
        <FadeIn delay={100} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
            {t("dubai.title")}
          </h2>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
            {t("dubai.desc")}
          </p>
        </FadeIn>
        <div className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dubaiCards.map((item, i) => (
            <FadeIn key={i} delay={300 + i * 120} variant="scale">
              <div className="card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-9 h-full">
                <p className="text-[15px] text-white/80 font-medium leading-[1.4] mb-2">{item.title}</p>
                <p className="text-[15px] text-white/30 leading-[1.7]">{item.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* Built for Dubai */}
      <Section>
        <FadeIn variant="none"><SectionLabel>{t("builtFor.label")}</SectionLabel></FadeIn>
        <FadeIn delay={80} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
            {t("builtFor.title")}
          </h2>
        </FadeIn>
        <FadeIn delay={160}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
            {t("builtFor.desc")}
          </p>
        </FadeIn>
        <div className="mt-12 sm:mt-16">
          <FadeIn delay={240} variant="none">
            <LogoMarquee logos={["whatsapp", "property-finder", "bayut", "propspace", "pixxi", "saphyte"]} height="h-4 sm:h-5" />
          </FadeIn>
        </div>
      </Section>

      {/* Security & Privacy */}
      <Section>
        <FadeIn variant="none"><SectionLabel>{t("security.label")}</SectionLabel></FadeIn>
        <FadeIn delay={80} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[20ch]">
            {t("security.title")}
          </h2>
        </FadeIn>
        <FadeIn delay={160}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[52ch]">
            {t("security.desc")}
          </p>
        </FadeIn>
        <div className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {securityCards.map((item, i) => (
            <FadeIn key={i} delay={200 + i * 100} variant="scale">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-9 h-full">
                <span className="text-[#B8A990]/70 mb-5 block">{securityIcons[i]}</span>
                <p className="text-[15px] text-white/80 font-medium leading-[1.4] mb-2">{item.title}</p>
                <p className="text-[14px] text-white/30 leading-[1.7]">{item.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* Private pilot */}
      <Section id="pilot">
        <FadeIn variant="none"><SectionLabel>{t("pilot.label")}</SectionLabel></FadeIn>
        <FadeIn delay={80} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[22ch]">
            {t("pilot.title")}
          </h2>
        </FadeIn>
        <FadeIn delay={160}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[52ch]">
            {t("pilot.desc")}
          </p>
        </FadeIn>

        <div className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {pilotColumns.map((block, i) => (
            <FadeIn key={i} delay={200 + i * 120} variant="scale">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-9 h-full">
                <span className="text-[11px] uppercase tracking-[0.15em] text-[#B8A990]/70 mb-5 block">
                  {block.label}
                </span>
                <ul className="space-y-3">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-3 text-[14px] text-white/40 leading-[1.6]">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-[#B8A990]/50">
                        <path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>

      </Section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 border-t border-white/[0.06] relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(184,169,144,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-[1000px] mx-auto px-6 sm:px-10 text-center relative">
          <FadeIn variant="blur" duration={1}>
            <h2 className="text-[26px] sm:text-[40px] leading-[1.1] tracking-[-0.03em] max-w-[20ch] mx-auto">
              <span className="font-light text-white/40">{t("finalCta.line1")}</span>
              <br />
              <span className="font-semibold text-gradient">{t("finalCta.line2")}</span>
            </h2>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto] gap-10 sm:gap-16">
            <div className="col-span-2 sm:col-span-1">
              <ElioLogo className="text-[22px] leading-none tracking-[-0.02em] text-[#E8E0D4]/70 mb-4" />
              <p className="text-[14px] text-white/20 leading-[1.6] max-w-[32ch]">
                {t("footer.tagline")}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/20 mb-4">{t("footer.product")}</p>
              <div className="space-y-2.5">
                <a href="#pilot" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">{t("footer.privatePilot")}</a>
                <a href="#how" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">{t("footer.howItWorks")}</a>
                <a href="mailto:hello@getelio.co" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">{t("footer.contact")}</a>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/20 mb-4">{t("footer.connect")}</p>
              <div className="space-y-2.5">
                <a href="https://linkedin.com/company/getelio" target="_blank" rel="noopener noreferrer" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">LinkedIn</a>
                <a href="https://instagram.com/getelio" target="_blank" rel="noopener noreferrer" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">Instagram</a>
                <a href="https://getelio.co" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">getelio.co</a>
              </div>
            </div>
          </div>
          <div className="mt-14 pt-6 border-t border-white/[0.06] space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="text-[11px] text-white/20">
                &copy; {new Date().getFullYear()} {t("footer.rights")}
              </p>
              <a href="mailto:hello@getelio.co" className="text-[11px] text-white/20 hover:text-white/40 transition-colors">hello@getelio.co</a>
            </div>
            <div className="text-[11px] text-white/20 leading-[1.6]">
              <p>{t("footer.company")}</p>
              <p>{t("footer.address")}</p>
            </div>
          </div>
        </div>
      </footer>

      <div className="h-20 sm:hidden" />
    </div>
  );
}
