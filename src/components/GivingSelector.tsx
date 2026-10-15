"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Heart, Church } from "lucide-react";
import type { Campaign } from "../lib/data";
import styles from "./GivingSelector.module.css";

const offerings: Campaign[] = [
  {id:"0",title:"General Offering",description:"Support the everyday work of the ministry.",category:"GIVING",amount:0,goal:0,image:"",status:"active"},
  {id:"tithe",title:"Tithe",description:"Honour God through faithful giving.",category:"GIVING",amount:0,goal:0,image:"",status:"active"},
  {id:"offering",title:"Special Offering",description:"Give an additional gift to the ministry.",category:"GIVING",amount:0,goal:0,image:"",status:"active"},
];

export default function GivingSelector({campaigns,selected,onChange}:{campaigns:Campaign[];selected:Campaign;onChange:(campaign:Campaign)=>void}) {
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const options=useRef<(HTMLButtonElement|null)[]>([]);
  const id=useId();
  const active=campaigns.filter(c=>c.status==="active");
  const items=[...offerings,...active];
  const close=()=>{setOpen(false);trigger.current?.focus();};
  return <div className={styles.root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null))setOpen(false);}}>
    <span id={`${id}-label`} className={styles.label}>Where would you like to give?</span>
    <button type="button" ref={trigger} className={styles.trigger} aria-expanded={open} aria-controls={`${id}-options`} aria-labelledby={`${id}-label ${id}-value`} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==="ArrowDown"){e.preventDefault();setOpen(true);requestAnimationFrame(()=>options.current[Math.max(0,items.findIndex(c=>c.id===selected.id))]?.focus());}}}>
      <span className={styles.thumb}>{selected.image?<img src={selected.image} alt="" />:<Heart size={21}/>}</span>
      <span className={styles.copy}><strong id={`${id}-value`}>{selected.title}</strong><small>{selected.category==="GIVING"?"Tithes & offerings":"Campaign gift"}</small></span>
      <ChevronDown size={18} className={open?styles.rotated:undefined}/>
    </button>
    {open && <div id={`${id}-options`} className={styles.panel} role="group" aria-labelledby={`${id}-label`} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();e.preventDefault();close();}else if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)){e.preventDefault();const index=options.current.indexOf(document.activeElement as HTMLButtonElement);const next=e.key==="Home"?0:e.key==="End"?items.length-1:(index+(e.key==="ArrowDown"?1:-1)+items.length)%items.length;options.current[next]?.focus();}}}>
      {items.map((c,i)=><div key={c.id}>
        {(i===0||i===offerings.length)&&<p className={styles.group}>{i===0?"Tithes & offerings":"Support a campaign"}</p>}
        <button type="button" ref={node=>{options.current[i]=node;}} aria-pressed={selected.id===c.id} className={`${styles.option} ${selected.id===c.id?styles.selected:""}`} onClick={()=>{onChange(c);close();}}>
          <span className={styles.thumb}>{c.image?<img src={c.image} alt="" loading="lazy"/>:<Church size={20}/>}</span>
          <span className={styles.copy}><strong>{c.title}</strong><small>{c.category==="GIVING"?c.description:c.category.toLowerCase().replaceAll("_"," ")}</small></span>
          {selected.id===c.id&&<Check size={18} aria-label="Selected"/>}
        </button>
      </div>)}
      {active.length===0&&<p className={styles.empty}>Campaigns will appear here when available.</p>}
    </div>}
  </div>;
}
