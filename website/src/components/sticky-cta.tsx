"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export function StickyCTA() {
  const t = useTranslations("stickyCta");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after scrolling past hero (~500px)
      setVisible(window.scrollY > 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed bottom-6 left-0 right-0 z-50 flex justify-center sm:hidden pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      <a
        href="http://t.me/pashapapin"
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto inline-flex items-center gap-2.5 bg-[#E8E0D4] text-[#08090A] px-7 py-3.5 rounded-full text-[14px] font-semibold shadow-[0_0_30px_rgba(232,224,212,0.2),0_4px_20px_rgba(0,0,0,0.5)]"
      >
        {t("text")}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="opacity-40 rtl:rotate-180">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </div>
  );
}
