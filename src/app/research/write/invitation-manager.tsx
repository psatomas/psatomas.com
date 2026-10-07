"use client";
import { useState, useTransition } from "react";
import type { GuestInvitation } from "@/lib/research";
import { createGuestInvitationAction, revokeGuestInvitationAction } from "./actions";

export function InvitationManager({ invitations }: { invitations: GuestInvitation[] }) {
  const [items, setItems] = useState(invitations); const [name,setName]=useState(""); const [email,setEmail]=useState("");
  const [link,setLink]=useState<string>(); const [message,setMessage]=useState<string>(); const [pending,start]=useTransition();
  function create() { start(async()=>{ const result=await createGuestInvitationAction(name,email); if(!result.ok){setMessage(result.message);return;} const item=result.data; setItems([item,...items]); setLink(`${location.origin}/research/contribute/accept/${item.urlToken}`); setName("");setEmail(""); }); }
  function revoke(id:string) { start(async()=>{ const result=await revokeGuestInvitationAction(id); if(result.ok) setItems(items.map(i=>i.id===id?{...i,state:"revoked",revokedAt:new Date().toISOString()}:i)); }); }
  return <section className="border-t border-border pt-8"><h2 className="text-xl font-semibold">Guest invitations</h2><p className="mt-1 text-sm text-muted">Each active link permits one draft and closes on submission.</p>
    <div className="mt-4 flex flex-wrap gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Guest name" className="rounded border border-border bg-surface px-3 py-2 text-sm"/><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="guest@example.com" className="rounded border border-border bg-surface px-3 py-2 text-sm"/><button type="button" disabled={pending} onClick={create} className="rounded border border-accent px-3 py-2 font-mono text-xs uppercase text-accent">Create link</button></div>
    {link && <div className="mt-3 rounded border border-accent/40 p-3 text-sm"><p className="text-muted">Copy now — this is the only time the secret link is shown.</p><code className="break-all text-accent">{link}</code></div>}{message&&<p className="mt-2 text-warn">{message}</p>}
    <ul className="mt-5 divide-y divide-border">{items.map(i=><li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span><strong>{i.guestName}</strong> <span className="text-muted">{i.guestEmail} · {i.state} · expires {new Date(i.expiresAt).toLocaleString()}</span>{i.articleId&&<a className="ml-2 text-accent" href={`/research/write/${i.articleId}`}>Review contribution</a>}</span>{i.state==="active"&&<button type="button" onClick={()=>revoke(i.id)} className="font-mono text-xs uppercase text-warn">Revoke</button>}</li>)}</ul>
  </section>;
}
