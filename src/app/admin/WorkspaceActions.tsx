"use client";
import { ArrowUpRight, CircleDollarSign, Target, WalletCards } from "lucide-react";

export default function WorkspaceActions({ onSelect, staff = false }: { onSelect: (view: string) => void; staff?: boolean }) {
  const actions = [
    { view: "fundraising", title: "Campaign studio", detail: "Shape the next chapter of giving", icon: Target, tone: "violet" },
    { view: "donations", title: "Giving ledger", detail: "Review gifts and donor activity", icon: CircleDollarSign, tone: "gold" },
    { view: "expenses", title: "Expense desk", detail: "Keep every ministry cost organised", icon: WalletCards, tone: "green" },
  ];
  return <section className="workspace-launch" aria-label="Workspace shortcuts">
    <div className="workspace-section-title"><div><span>YOUR WORKSPACE</span><h2>{staff ? "Where would you like to start?" : "Turn insight into action."}</h2></div><p>Three focused spaces. One shared purpose.</p></div>
    <div className="workspace-launch-grid">{actions.map(({view,title,detail,icon:Icon,tone},index)=><button key={view} className={`workspace-launch-card launch-${tone}`} onClick={()=>onSelect(view)}><span className="launch-number">0{index+1}</span><Icon size={25}/><strong>{title}</strong><span className="launch-detail">{detail}</span><ArrowUpRight className="launch-arrow" size={20}/></button>)}</div>
  </section>;
}
