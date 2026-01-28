"use client";

import { FadeIn } from "@/components/fade-in";
import { AnimatedStat } from "@/components/animated-stat";
import { StatusLine } from "@/components/status-line";
import { Section, SectionLabel } from "@/components/section";
import { LogoMarquee } from "@/components/logo-marquee";
import { StickyCTA } from "@/components/sticky-cta";
import { DealVisibilityMockup, SLAViewMockup, ActionQueueMockup, OwnerDashboardMockup, PerspectiveFrame } from "@/components/mockups";

/* Logo: "elio." with period, heavier weight, off-white */
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

export default function Home() {
  return (
    <div className="min-h-screen bg-[#08090A] text-white font-sans v2-noise">
      {/* Mobile sticky CTA */}
      <StickyCTA />

      {/* Hero (gradient covers nav + content) */}
      <section className="relative v2-hero-bg">
        {/* Nav */}
        <nav className="relative z-10">
          <div className="max-w-[1000px] mx-auto px-6 sm:px-10 pt-6 sm:pt-8">
            <FadeIn variant="down" delay={0}>
              <ElioLogo className="text-[20px] sm:text-[24px] leading-none tracking-[-0.02em] text-[#E8E0D4]" />
            </FadeIn>
          </div>
        </nav>
        <div className="pt-16 sm:pt-24 pb-16 sm:pb-24">
          <div className="max-w-[1000px] mx-auto px-6 sm:px-10 text-center">
            <FadeIn delay={120} variant="blur" duration={1.2}>
              <h1 className="mx-auto max-w-[20ch] text-[32px] sm:text-[72px] leading-[1.02] sm:leading-[0.98] tracking-[-0.035em]">
                <span className="font-light text-white/40">Turn WhatsApp chats into</span>
                <br />
                <span className="font-semibold text-gradient">closed deals.</span>
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
                  href="#pilot"
                  className="v2-cta-glow inline-flex items-center gap-2.5 bg-[#E8E0D4] text-[#08090A] px-7 py-3.5 rounded-[10px] text-[14px] font-semibold hover:bg-[#F0EAE0] transition-colors duration-200"
                >
                  Request private pilot
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="opacity-40">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a
                  href="#how"
                  className="block mt-5 text-[14px] text-white/20 hover:text-white/40 transition-colors duration-200"
                >
                  See how it works &darr;
                </a>
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Logo marquee — infinite scroll */}
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
        <FadeIn variant="none">
          <SectionLabel>Meet Elio</SectionLabel>
        </FadeIn>
        <FadeIn delay={100} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
            AI-powered deal assistant for real estate teams.
          </h2>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
            Connects to WhatsApp conversations in real deals.
            Shows where money is being made, delayed, or lost.
          </p>
        </FadeIn>
        <FadeIn delay={300} variant="scale">
          <div className="mt-8 sm:mt-10 lg:-mr-[10%]">
            <PerspectiveFrame heroMode fadeDirection="left-bottom">
              <OwnerDashboardMockup />
            </PerspectiveFrame>
          </div>
        </FadeIn>
      </Section>

      {/* VALUE BLOCK 1: Deal Visibility */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <FadeIn variant="none"><SectionLabel>Deal visibility</SectionLabel></FadeIn>
            <FadeIn delay={80} variant="blur">
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                See every deal. Know who moves next.
              </h2>
            </FadeIn>
            <FadeIn delay={160}>
              <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
                Lead score, deal stage, deal health, and last action — all in one view.
              </p>
            </FadeIn>
            <FadeIn delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Lead score", "Deal stage", "Deal health", "Last action"].map((tag) => (
                  <span key={tag} className="text-[12px] text-white/30 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={200} variant="scale">
            <div className="lg:-mr-[15%]">
              <PerspectiveFrame fadeDirection="left-bottom">
                <DealVisibilityMockup />
              </PerspectiveFrame>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* VALUE BLOCK 2: Quality & SLA */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <FadeIn delay={200} variant="scale" className="order-2 lg:order-1">
            <div className="lg:-ml-[15%]">
              <PerspectiveFrame fadeDirection="bottom">
                <SLAViewMockup />
              </PerspectiveFrame>
            </div>
          </FadeIn>
          <div className="order-1 lg:order-2">
            <FadeIn variant="none"><SectionLabel>Quality control</SectionLabel></FadeIn>
            <FadeIn delay={80} variant="blur">
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                Track SLAs. Catch problems early.
              </h2>
            </FadeIn>
            <FadeIn delay={160}>
              <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
                First response time, follow-up speed, missed conversations, and script compliance.
              </p>
            </FadeIn>
            <FadeIn delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                {["First response SLA", "Follow-up SLA", "Missed follow-ups", "Script compliance"].map((tag) => (
                  <span key={tag} className="text-[12px] text-white/30 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </Section>

      {/* VALUE BLOCK 3: Actions */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <FadeIn variant="none"><SectionLabel>Smart actions</SectionLabel></FadeIn>
            <FadeIn delay={80} variant="blur">
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                Know exactly what to do next.
              </h2>
            </FadeIn>
            <FadeIn delay={160}>
              <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
                Priority queue, escalation flags, and weekly action plans for every deal.
              </p>
            </FadeIn>
            <FadeIn delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Next best step", "Priority queue", "Escalation flags", "Weekly plan"].map((tag) => (
                  <span key={tag} className="text-[12px] text-white/30 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
                    {tag}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={200} variant="scale">
            <div className="lg:-mr-[15%]">
              <PerspectiveFrame fadeDirection="left-bottom">
                <ActionQueueMockup />
              </PerspectiveFrame>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Deal impact overview */}
      <Section>
        <FadeIn variant="none"><SectionLabel>Deal impact overview</SectionLabel></FadeIn>
        <FadeIn delay={80} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
            What changes when you see the full picture
          </h2>
        </FadeIn>
        <div className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { stat: "20–30%", desc: "fewer deals lost after initial interest" },
            { stat: "2×", desc: "faster follow-ups on high-intent buyers" },
            { stat: "10–15%", desc: "higher close rate from the same pipeline" },
          ].map((item, i) => (
            <FadeIn key={i} delay={150 + i * 150} variant="scale">
              <div className="stat-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-9 h-full">
                <span className="block text-[36px] sm:text-[44px] font-medium tracking-[-0.03em] text-[#B8A990] min-h-[1.15em]">
                  <AnimatedStat value={item.stat} />
                </span>
                <p className="mt-3 text-[15px] text-white/30 leading-[1.6]">
                  {item.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* Why this matters in Dubai */}
      <Section>
        <FadeIn variant="none"><SectionLabel>Why this matters in Dubai</SectionLabel></FadeIn>
        <FadeIn delay={100} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
            In Dubai real estate, speed decides outcomes.
          </h2>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
            Elio shows where deals slow down — while there is still time to fix them.
          </p>
        </FadeIn>
        <div className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Buyers move quickly", desc: "International investors compare 5–10 options at once. First clear response wins." },
            { title: "Silence kills deals", desc: "48 hours without a reply and buyer interest drops by half." },
            { title: "Late follow-ups cost revenue", desc: "By the time you notice a stalled deal, the commission is already lost." },
          ].map((item, i) => (
            <FadeIn key={i} delay={300 + i * 120} variant="scale">
              <div className="card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:p-9 h-full">
                <p className="text-[15px] text-white/80 font-medium leading-[1.4] mb-2">
                  {item.title}
                </p>
                <p className="text-[15px] text-white/30 leading-[1.7]">
                  {item.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* Built for Dubai */}
      <Section>
        <FadeIn variant="none"><SectionLabel>Built for Dubai</SectionLabel></FadeIn>
        <FadeIn delay={80} variant="blur">
          <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
            Works with the tools your agency already uses
          </h2>
        </FadeIn>
        <FadeIn delay={160}>
          <p className="mt-6 text-[16px] sm:text-[18px] text-white/40 leading-[1.6] max-w-[48ch]">
            Portals, WhatsApp, and local CRM systems — Elio connects to all of them.
          </p>
        </FadeIn>
        <div className="mt-12 sm:mt-16">
          <FadeIn delay={240} variant="none">
            <LogoMarquee
              logos={["whatsapp", "property-finder", "bayut", "propspace", "pixxi", "saphyte"]}
              height="h-4 sm:h-5"
            />
          </FadeIn>
        </div>
      </Section>

      {/* Private pilot */}
      <Section id="pilot">
        <FadeIn variant="none"><SectionLabel>Private pilot</SectionLabel></FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-10 sm:gap-20">
          <FadeIn delay={100}>
            <div>
              <h2 className="text-gradient text-[28px] sm:text-[48px] font-medium leading-[1.1] tracking-[-0.03em] max-w-[18ch]">
                Private pilot for real estate agencies
              </h2>
              <p className="mt-4 text-[15px] text-white/40 leading-[1.7]">
                30-day pilot. Limited availability.
              </p>
              <div className="mt-6 space-y-1 text-[14px] text-white/20">
                <p>Minimal setup.</p>
                <p>Direct access.</p>
              </div>
              <div className="mt-8">
                <a
                  href="mailto:hello@getelio.co"
                  className="v2-cta-glow inline-flex items-center gap-2.5 bg-[#E8E0D4] text-[#08090A] px-7 py-3.5 rounded-[10px] text-[14px] font-semibold hover:bg-[#F0EAE0] transition-colors duration-200"
                >
                  Request private pilot
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="opacity-40">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
          </FadeIn>
          <div className="space-y-4">
            {[
              { num: "01", text: "Connection to WhatsApp deal communication" },
              { num: "02", text: "Full deal visibility for your team" },
              { num: "03", text: "Visibility into stalled conversations" },
              { num: "04", text: "End-of-pilot summary with findings" },
            ].map((item, i) => (
              <FadeIn key={i} delay={200 + i * 120} variant="left">
                <div className="flex gap-4 py-4 border-t border-white/[0.06] first:border-t-0">
                  <span className="text-[11px] text-[#B8A990]/70 font-mono pt-0.5 shrink-0">
                    {item.num}
                  </span>
                  <p className="text-[15px] text-white/40 leading-[1.7]">
                    {item.text}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 border-t border-white/[0.06] relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(184,169,144,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-[1000px] mx-auto px-6 sm:px-10 text-center relative">
          <FadeIn variant="blur" duration={1}>
            <h2 className="text-[26px] sm:text-[40px] leading-[1.1] tracking-[-0.03em] max-w-[20ch] mx-auto">
              <span className="font-light text-white/40">Control conversations.</span>
              <br />
              <span className="font-semibold text-gradient">Close more deals.</span>
            </h2>
          </FadeIn>
          <FadeIn delay={300} variant="scale">
            <div className="mt-12">
              <a
                href="mailto:hello@getelio.co"
                className="v2-cta-glow inline-flex items-center gap-2.5 bg-[#E8E0D4] text-[#08090A] px-7 py-3.5 rounded-[10px] text-[14px] font-semibold hover:bg-[#F0EAE0] transition-colors duration-200"
              >
                Request private pilot
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="opacity-40">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
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
                AI-powered deal assistant for real estate teams. Built for Dubai.
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/20 mb-4">Product</p>
              <div className="space-y-2.5">
                <a href="#pilot" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">Private pilot</a>
                <a href="#how" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">How it works</a>
                <a href="mailto:hello@getelio.co" className="block text-[14px] text-white/40 hover:text-white/60 transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/20 mb-4">Connect</p>
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
                &copy; {new Date().getFullYear()} Elio Technologies LLC. All rights reserved.
              </p>
              <a href="mailto:hello@getelio.co" className="text-[11px] text-white/20 hover:text-white/40 transition-colors">hello@getelio.co</a>
            </div>
            <div className="text-[11px] text-white/20 leading-[1.6]">
              <p>Elio Technologies LLC &middot; License No. 1047832 &middot; TRN: 104783200003</p>
              <p>Office 2418, Al Shatha Tower, Dubai Media City, P.O. Box 502886, Dubai, UAE</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 sm:hidden" />
    </div>
  );
}
