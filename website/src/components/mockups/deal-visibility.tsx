"use client";

const deals = [
  { client: "Ahmed Al-Rashid", property: "Marina Vista 3BR", score: 92, stage: "Negotiation", health: "hot", lastAction: "Counter-offer sent", owner: "buyer", time: "2h" },
  { client: "Sarah Thompson", property: "JBR Penthouse", score: 78, stage: "Viewing", health: "warm", lastAction: "Viewing confirmed Thu", owner: "agent", time: "5h" },
  { client: "James Liu", property: "Downtown 1BR", score: 45, stage: "Initial", health: "cold", lastAction: "No reply to follow-up", owner: "agent", time: "3d" },
  { client: "Fatima Rahman", property: "Palm Duplex", score: 88, stage: "Documents", health: "hot", lastAction: "MOU draft sent", owner: "buyer", time: "1h" },
  { client: "Wei Chen", property: "Creek Tower 2BR", score: 61, stage: "Viewing", health: "warm", lastAction: "Asked about payment plan", owner: "buyer", time: "12h" },
];

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  const bg = score >= 80 ? "bg-emerald-400/10" : score >= 60 ? "bg-amber-400/10" : "bg-red-400/10";
  return <span className={`${color} ${bg} text-[11px] font-mono font-medium px-2 py-0.5 rounded`}>{score}</span>;
}

function HealthDot({ health }: { health: string }) {
  const color = health === "hot" ? "bg-emerald-400" : health === "warm" ? "bg-amber-400" : "bg-red-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} shrink-0`} />;
}

function OwnerTag({ owner }: { owner: string }) {
  const isAgent = owner === "agent";
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap ${isAgent ? "bg-blue-500/20 text-blue-400" : "bg-white/[0.06] text-white/30"}`}>
      {isAgent ? "You" : "Buyer"}
    </span>
  );
}

export function DealVisibilityMockup() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0C0D0F] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
          <span className="text-[13px] font-medium text-white/70">Active Deals</span>
          <span className="text-[11px] text-white/20 ml-1">5 deals</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[minmax(90px,110px)_45px_70px_1fr_45px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-white/20 border-b border-white/[0.04]">
        <span>Client</span>
        <span className="text-center">Score</span>
        <span>Stage</span>
        <span>Last action</span>
        <span className="text-right">Next</span>
      </div>

      {/* Rows */}
      {deals.map((deal, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(90px,110px)_45px_70px_1fr_45px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
        >
          {/* Client + Property */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <HealthDot health={deal.health} />
              <p className="text-[12px] text-white/80 font-medium truncate">{deal.client}</p>
            </div>
            <p className="text-[10px] text-white/25 mt-0.5 truncate pl-3.5">{deal.property}</p>
          </div>

          {/* Score */}
          <div className="flex justify-center">
            <ScoreBadge score={deal.score} />
          </div>

          {/* Stage */}
          <span className="text-[11px] text-white/40 truncate">{deal.stage}</span>

          {/* Last action */}
          <div className="min-w-0">
            <p className="text-[11px] text-white/50">{deal.lastAction}</p>
            <p className="text-[9px] text-white/15 mt-0.5">{deal.time} ago</p>
          </div>

          {/* Who moves next */}
          <div className="flex justify-end">
            <OwnerTag owner={deal.owner} />
          </div>
        </div>
      ))}
    </div>
  );
}
