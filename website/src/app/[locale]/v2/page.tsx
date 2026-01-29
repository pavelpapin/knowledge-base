"use client";

import { FadeIn } from "@/components/fade-in";
import { AnimatedStat } from "@/components/animated-stat";
import { StatusLine } from "@/components/status-line";
import { Section, SectionLabel } from "@/components/section";

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

export default function V2() {
  return (
    <div className="min-h-screen bg-[#08090A] text-white/90 font-sans v2-noise">
      {/* Hero (gradient covers nav + content) */}
      <section className="relative v2-hero-bg">
        {/* Nav */}
        <nav className="relative z-10">
          <div className="max-w-[1000px] mx-auto px-6 sm:px-10 pt-6 sm:pt-8">
            <FadeIn>
              <ElioLogo className="text-[20px] sm:text-[24px] leading-none tracking-[-0.02em] text-[#E8E0D4]" />
            </FadeIn>
          </div>
        </nav>
        <div className="pt-16 sm:pt-24 pb-16 sm:pb-24">
          <div className="max-w-[1000px] mx-auto px-6 sm:px-10 text-center">
            <FadeIn delay={120}>
              <h1 className="mx-auto max-w-[20ch] text-[32px] sm:text-[72px] leading-[1.02] sm:leading-[0.98] tracking-[-0.035em]">
                <span className="font-light text-white/50">Turn WhatsApp chats into</span>
                <br />
                <span className="font-semibold text-white">closed deals.</span>
              </h1>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="mt-8 sm:mt-10">
                <StatusLine />
              </div>
            </FadeIn>
            <FadeIn delay={450}>
              <div className="mt-10 sm:mt-14">
                <a
                  href="http://t.me/pashapapin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="v2-cta-glow inline-flex items-center gap-2.5 bg-[#E8E0D4] text-[#08090A] px-7 py-3.5 rounded-[10px] text-[15px] font-semibold hover:bg-[#F0EAE0] transition-colors duration-200"
                >
                  Request pilot
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="opacity-40">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a
                  href="#how"
                  className="block mt-5 text-[13px] text-white/25 hover:text-white/40 transition-colors duration-200"
                >
                  See how it works &darr;
                </a>
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Social proof — inside hero, ultra-low contrast */}
        <div className="pb-8 sm:pb-12">
          <div className="max-w-[1000px] mx-auto px-6 sm:px-10">
            <div className="flex flex-wrap justify-center items-center gap-x-6 sm:gap-x-14 gap-y-4 sm:gap-y-5">
              {["damac", "emaar", "sobha", "dewa", "nakheel", "meraas"].map((name, i) => (
                <FadeIn key={name} delay={550 + i * 60}>
                  <img
                    src={`/logos/${name}.svg`}
                    alt={name.toUpperCase()}
                    className="h-3.5 sm:h-[18px] opacity-[0.35] select-none"
                  />
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Meet Elio — bold typographic statements */}
      <Section id="how">
        <FadeIn>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/20 mb-10 sm:mb-14">Meet Elio</p>
        </FadeIn>
        <div className="space-y-8 sm:space-y-12">
          <FadeIn delay={100}>
            <p className="text-[24px] sm:text-[40px] font-medium leading-[1.15] tracking-[-0.025em] text-white/80 max-w-[20ch]">
              AI-powered deal assistant
              <span className="text-white/30"> for real estate teams.</span>
            </p>
          </FadeIn>
          <FadeIn delay={200}>
            <div className="pl-0 sm:pl-24 border-l-2 border-[#B8A990]/20 ml-0 sm:ml-0 pl-5 sm:pl-28">
              <p className="text-[17px] sm:text-[20px] text-white/40 leading-[1.6] max-w-[36ch]">
                Connects to WhatsApp conversations in real deals. Shows where money is being made, delayed, or lost.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={300}>
            <p className="text-[28px] sm:text-[48px] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
              Elio does not
              <br />
              replace agents.
            </p>
          </FadeIn>
          <FadeIn delay={400}>
            <div className="flex items-start gap-4 sm:gap-6">
              <span className="block w-8 sm:w-12 h-px bg-[#B8A990]/30 mt-3 sm:mt-4 shrink-0" />
              <p className="text-[18px] sm:text-[24px] font-light text-white/50 leading-[1.35] tracking-[-0.01em] max-w-[28ch]">
                It gives your team clear visibility into deal flow and outcomes.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* What Elio does */}
      <Section>
        <FadeIn><SectionLabel>What Elio does</SectionLabel></FadeIn>
        <FadeIn delay={80}>
          <h2 className="text-[24px] sm:text-[32px] font-medium leading-[1.2] tracking-[-0.02em] max-w-[36ch]">
            Control deal momentum, not just activity.
          </h2>
        </FadeIn>
        <FadeIn delay={160}>
          <p className="mt-6 text-[16px] sm:text-[17px] text-white/40 leading-[1.7] max-w-[56ch]">
            Elio analyzes real WhatsApp conversations with buyers and investors
            and turns them into clear, actionable signals for your team.
          </p>
        </FadeIn>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { num: "01", title: "Active deals", desc: "See which deals are moving and which need attention right now." },
            { num: "02", title: "Lost momentum", desc: "Spot conversations losing energy before the buyer goes silent." },
            { num: "03", title: "Failed follow-ups", desc: "Know where follow-ups fail to push decisions forward." },
            { num: "04", title: "Team leverage", desc: "See exactly where your team's intervention changes outcomes." },
          ].map((item, i) => (
            <FadeIn key={i} delay={200 + i * 100}>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
                <span className="text-xs text-[#B8A990]/70 font-mono">
                  {item.num}
                </span>
                <p className="mt-3 text-[16px] text-white/70 font-medium leading-[1.4]">
                  {item.title}
                </p>
                <p className="mt-2 text-[14px] text-white/30 leading-[1.6]">
                  {item.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={600}>
          <p className="mt-10 text-[19px] sm:text-[22px] text-white/50 leading-[1.5] tracking-[-0.01em] max-w-[56ch]">
            This is not CRM status. This is deal reality.
          </p>
        </FadeIn>
      </Section>

      {/* Deal impact overview */}
      <Section>
        <FadeIn><SectionLabel>Deal impact overview</SectionLabel></FadeIn>
        <FadeIn delay={80}>
          <h2 className="text-[24px] sm:text-[32px] font-medium leading-[1.2] tracking-[-0.02em] max-w-[36ch]">
            What changes when you see the full picture
          </h2>
        </FadeIn>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-[56ch] sm:max-w-none">
          {[
            { stat: "20–30%", desc: "fewer deals lost after initial interest" },
            { stat: "2×", desc: "faster follow-ups on high-intent buyers" },
            { stat: "10–15%", desc: "higher close rate from the same pipeline" },
          ].map((item, i) => (
            <FadeIn key={i} delay={150 + i * 120}>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-6">
                <span className="block text-[36px] sm:text-[44px] font-medium tracking-[-0.03em] text-[#B8A990]">
                  <AnimatedStat value={item.stat} />
                </span>
                <p className="mt-2 text-[15px] text-white/40 leading-[1.5]">
                  {item.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={550}>
          <p className="mt-10 text-[19px] sm:text-[22px] text-white/50 leading-[1.5] tracking-[-0.01em] max-w-[56ch]">
            Clear priorities. Better decisions. More closed deals.
          </p>
        </FadeIn>
      </Section>

      {/* Why this matters in Dubai */}
      <section className="py-16 sm:py-24 border-t border-white/[0.06] relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(184,169,144,0.05) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-[1000px] mx-auto px-6 sm:px-10 text-center relative">
          <FadeIn>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-4">Why this matters in Dubai</p>
          </FadeIn>
          <FadeIn delay={100}>
            <h2 className="text-gradient text-[28px] sm:text-[44px] font-medium leading-[1.15] tracking-[-0.02em] max-w-[20ch] mx-auto">
              In Dubai real estate, speed decides outcomes.
            </h2>
          </FadeIn>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-8 sm:gap-16">
            <FadeIn delay={250}><p className="text-[16px] text-white/40">Buyers move quickly.</p></FadeIn>
            <FadeIn delay={400}><p className="text-[16px] text-white/40">Silence kills deals.</p></FadeIn>
            <FadeIn delay={550}><p className="text-[16px] text-white/40">Late follow-ups cost revenue.</p></FadeIn>
          </div>
          <FadeIn delay={700}>
            <p className="mt-10 text-[17px] text-white/30 max-w-[48ch] mx-auto leading-[1.7]">
              Elio shows where deals slow down — while there is still time to fix them.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Built for Dubai */}
      <Section>
        <div className="text-center">
          <FadeIn><SectionLabel>Built for Dubai</SectionLabel></FadeIn>
          <FadeIn delay={80}>
            <h2 className="text-[24px] sm:text-[32px] font-medium leading-[1.2] tracking-[-0.02em] max-w-[36ch] mx-auto">
              Works with the tools your agency already uses
            </h2>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="mt-6 text-[16px] sm:text-[17px] text-white/40 leading-[1.7] max-w-[52ch] mx-auto">
              Portals, WhatsApp, and local CRM systems — Elio connects to all of them.
            </p>
          </FadeIn>
        </div>
        <div className="mt-12 flex flex-wrap justify-center items-center gap-x-6 sm:gap-x-10 gap-y-4 sm:gap-y-5">
          {[
            { name: "WhatsApp Business", weight: "font-medium" },
            { name: "Property Finder", weight: "font-semibold" },
            { name: "Bayut", weight: "font-bold" },
            { name: "PropSpace", weight: "font-semibold" },
            { name: "Pixxi", weight: "font-medium" },
            { name: "Saphyte", weight: "font-normal" },
          ].map((item, i) => (
            <FadeIn key={item.name} delay={200 + i * 80}>
              <span className={`text-[13px] sm:text-[15px] ${item.weight} text-white/20 tracking-wide select-none`}>
                {item.name}
              </span>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={600}>
          <p className="mt-14 text-[22px] sm:text-[28px] font-medium leading-[1.3] tracking-[-0.02em] text-white/50 text-center max-w-[36ch] mx-auto">
            No new workflows. No process changes. Just control over how deals move.
          </p>
        </FadeIn>
      </Section>

      {/* Pilot */}
      <Section id="pilot">
        <FadeIn><SectionLabel>Pilot</SectionLabel></FadeIn>
        <div>
          <div className="space-y-4">
            {[
              { num: "01", text: "Connection to WhatsApp deal communication" },
              { num: "02", text: "Full deal visibility for your team" },
              { num: "03", text: "Visibility into stalled conversations" },
              { num: "04", text: "End-of-pilot summary with findings" },
            ].map((item, i) => (
              <FadeIn key={i} delay={200 + i * 100}>
                <div className="flex gap-4 py-4 border-t border-white/[0.06] first:border-t-0">
                  <span className="text-xs text-[#B8A990]/70 font-mono pt-0.5 shrink-0">
                    {item.num}
                  </span>
                  <p className="text-[16px] text-white/40 leading-[1.7]">
                    {item.text}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
        <div className="mt-10">
          <a
            href="http://t.me/pashapapin"
            target="_blank"
            rel="noopener noreferrer"
            className="v2-cta-glow inline-flex items-center gap-2.5 bg-[#E8E0D4] text-[#08090A] px-7 py-3.5 rounded-[10px] text-[15px] font-semibold hover:bg-[#F0EAE0] transition-colors duration-200"
          >
            Request pilot
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="opacity-40">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
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
          <FadeIn>
            <h2 className="text-[28px] sm:text-[44px] leading-[1.1] tracking-[-0.03em] max-w-[20ch] mx-auto">
              <span className="font-light text-white/50">Control conversations.</span>
              <br />
              <span className="font-semibold text-white">Close more deals.</span>
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
              <p className="text-[13px] text-white/25 leading-[1.6] max-w-[32ch]">
                AI-powered deal assistant for real estate teams. Built for Dubai.
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-4">Product</p>
              <div className="space-y-2.5">
                <a href="#pilot" className="block text-[13px] text-white/40 hover:text-white/60 transition-colors">Pilot</a>
                <a href="#how" className="block text-[13px] text-white/40 hover:text-white/60 transition-colors">How it works</a>
                <a href="mailto:hello@getelio.co" className="block text-[13px] text-white/40 hover:text-white/60 transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-4">Connect</p>
              <div className="space-y-2.5">
                <a href="https://linkedin.com/company/getelio" target="_blank" rel="noopener noreferrer" className="block text-[13px] text-white/40 hover:text-white/60 transition-colors">LinkedIn</a>
                <a href="https://instagram.com/getelio" target="_blank" rel="noopener noreferrer" className="block text-[13px] text-white/40 hover:text-white/60 transition-colors">Instagram</a>
                <a href="https://getelio.co" className="block text-[13px] text-white/40 hover:text-white/60 transition-colors">getelio.co</a>
              </div>
            </div>
          </div>
          <div className="mt-14 pt-6 border-t border-white/[0.06] space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="text-[11px] text-white/25">
                &copy; {new Date().getFullYear()} Elio Technologies LLC. All rights reserved.
              </p>
              <a href="mailto:hello@getelio.co" className="text-[11px] text-white/25 hover:text-white/40 transition-colors">hello@getelio.co</a>
            </div>
            <div className="text-[10px] text-white/20 leading-[1.6]">
              <p>Elio Technologies LLC &middot; License No. 1047832 &middot; TRN: 104783200003</p>
              <p>Office 2418, Al Shatha Tower, Dubai Media City, P.O. Box 502886, Dubai, UAE</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
