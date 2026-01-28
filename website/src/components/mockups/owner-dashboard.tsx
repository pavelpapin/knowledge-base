"use client";

const stats = [
  { value: "47", label: "Active conversations", color: "text-white/90" },
  { value: "12", label: "High-intent deals", color: "text-emerald-400" },
  { value: "8", label: "Attention required", color: "text-amber-400" },
  { value: "3", label: "SLA breaches", color: "text-red-400" },
];

const attentionItems = [
  { client: "Mohammed Al-R.", agent: "Artem K.", score: "High", stage: "After viewing", issue: "Follow-up overdue 3 days", time: "3d", severity: "red" },
  { client: "Sarah Thompson", agent: "Maria S.", score: "High", stage: "Negotiation", issue: "Price objection not addressed", time: "1d", severity: "amber" },
  { client: "Ivan Petrov", agent: "Artem K.", score: "Med", stage: "After viewing", issue: "Client questions unanswered", time: "2d", severity: "red" },
  { client: "James Liu", agent: "David R.", score: "High", stage: "Pricing", issue: "SLA breach — 48h no response", time: "4d", severity: "red" },
];

const insights = [
  "Deals stall after viewings — 4 of 8 attention items are post-viewing",
  "Follow-ups after pricing take the longest to resolve",
  "Most attention items wait on agency action, not client",
];

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="bg-white/[0.03] rounded-md px-3 py-2.5 border border-white/[0.06]">
      <p className={`text-[22px] font-semibold leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-white/30 mt-1">{label}</p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === "red" ? "bg-red-400" : "bg-amber-400";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} shrink-0`} />;
}

function ScoreLabel({ score }: { score: string }) {
  const colors: Record<string, string> = {
    High: "text-emerald-400",
    Med: "text-amber-400",
    Low: "text-white/30",
  };
  return <span className={`text-[10px] font-medium ${colors[score]}`}>{score}</span>;
}

export function OwnerDashboardMockup() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0B] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <p className="text-[13px] font-medium text-white/80">Deal intelligence for WhatsApp conversations</p>
        <p className="text-[10px] text-white/30 mt-0.5">Owner view</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 p-3">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      {/* Attention table */}
      <div className="px-3 pb-2">
        <div className="bg-white/[0.02] rounded-md border border-white/[0.06] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-white/[0.06]">
            <p className="text-[11px] font-medium text-white/60">Attention required</p>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[90px_55px_40px_65px_1fr_30px] gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/20 border-b border-white/[0.04]">
            <span>Client</span>
            <span>Agent</span>
            <span>Score</span>
            <span>Stage</span>
            <span>Issue</span>
            <span className="text-right">When</span>
          </div>

          {/* Rows */}
          {attentionItems.map((item, i) => (
            <div key={i} className="grid grid-cols-[90px_55px_40px_65px_1fr_30px] gap-1.5 px-3 py-1.5 border-b border-white/[0.03] last:border-0 items-center">
              <p className="text-[10px] text-white/70 truncate">{item.client}</p>
              <p className="text-[9px] text-white/30 truncate">{item.agent}</p>
              <ScoreLabel score={item.score} />
              <p className="text-[9px] text-white/30 truncate">{item.stage}</p>
              <div className="flex items-center gap-1.5 min-w-0">
                <SeverityDot severity={item.severity} />
                <p className={`text-[10px] truncate ${item.severity === "red" ? "text-red-400/80" : "text-amber-400/80"}`}>
                  {item.issue}
                </p>
              </div>
              <p className="text-[9px] text-white/20 text-right">{item.time}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly insights */}
      <div className="px-3 pb-3">
        <div className="bg-white/[0.02] rounded-md border border-white/[0.06] px-3 py-2.5">
          <p className="text-[10px] font-medium text-white/50 mb-2">This week</p>
          <div className="space-y-1">
            {insights.map((insight, i) => (
              <p key={i} className="text-[10px] text-white/30 leading-snug">
                <span className="text-white/20 mr-1.5">·</span>
                {insight}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
