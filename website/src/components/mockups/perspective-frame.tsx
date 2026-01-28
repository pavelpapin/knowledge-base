"use client";

interface PerspectiveFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function PerspectiveFrame({ children, className = "" }: PerspectiveFrameProps) {
  return (
    <div className={`relative ${className}`} style={{ perspective: "1200px" }}>
      {/* 3D transformed container */}
      <div
        className="relative"
        style={{
          transform: "rotateX(8deg) rotateY(-3deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {children}

        {/* Bottom fade gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background: "linear-gradient(to top, #08090A 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Subtle reflection/glow under the card */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-16 opacity-20 blur-2xl pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(184,169,144,0.3) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
