import assert from "node:assert/strict";
import { test } from "node:test";
import { createGuestContributionService, hashCapability } from "./guest-contribution-service.ts";
import type { GuestInvitation, ResearchArticleRecord } from "./domain.ts";
import type { GuestInvitationRepository } from "./repository.ts";

const invitation: GuestInvitation = { id:"invite-1",guestName:"Guest",guestEmail:"guest@example.com",state:"active",createdAt:"2026-10-05T00:00:00.000Z",expiresAt:"2026-10-09T00:00:00.000Z",submittedAt:null,revokedAt:null,acceptedAt:null,articleId:null };
const input={title:"Guest",description:"D",category:"EVM" as const,tags:[],content:"Body"};
const article: ResearchArticleRecord = {id:"article-1",slug:"guest",title:"Guest",description:"D",category:"EVM",tags:[],content:"Body",readingMinutes:1,status:"draft",publishedAt:null,createdAt:"2026-10-06T00:00:00.000Z",updatedAt:"2026-10-06T00:00:00.000Z"};

async function fixture(at = new Date("2026-10-06T00:00:00.000Z")) {
  let record={...invitation}; let contribution:ResearchArticleRecord|null=null; const sessions=new Map<string,string>(); const links=new Set<string>();
  const repo:GuestInvitationRepository={
    createInvitation:async()=>record,listInvitations:async()=>[record],revokeInvitation:async()=>{record={...record,state:"revoked",revokedAt:at.toISOString()};return true;},getInvitationByCapabilityHash:async()=>record,
    acceptInvitation:async(_,sessionHash,__,created,sessionExpiresAt)=>{if(record.acceptedAt||record.expiresAt<=created)return null;record={...record,acceptedAt:created};sessions.set(sessionHash,sessionExpiresAt);return record;},
    getInvitationBySessionHash:async(hash,now)=>sessions.get(hash)! > now&&record.state!=="revoked"?record:null,
    createReauthenticationLink:async(_,hash)=>{links.add(hash);return true;},
    redeemReauthenticationLink:async(hash,sessionHash,_,__,sessionExpiresAt)=>{if(!links.delete(hash)||record.state!=="active")return null;sessions.set(sessionHash,sessionExpiresAt);return record;},
    getContribution:async()=>contribution,
    createContribution:async(hash,now)=>sessions.get(hash)! > now&&record.state==="active"?(contribution??={...article}):null,
    updateContribution:async(hash,now,patch)=>sessions.get(hash)! > now&&record.state==="active"&&contribution&&contribution.status==="draft"?(contribution={...contribution,...patch}):null,
    submitContribution:async(hash,now)=>{if(!(sessions.get(hash)! > now)||record.state!=="active"||!contribution)return false;record={...record,state:"submitted"};return true;},
  };
  return {repo,get now(){return at;},setNow(value:Date){at=value;},record:()=>record,contribution:()=>contribution};
}

test("an invitation expires before acceptance, but its accepted editor session survives 72 hours", async()=>{
  const store=await fixture(); const service=createGuestContributionService({getRepository:async()=>store.repo,now:()=>store.now,random:()=>"s".repeat(64)});
  const accepted=await service.accept("i".repeat(64)); assert.equal(accepted.ok,true); if(!accepted.ok)return;
  assert.equal((await service.save(accepted.data.sessionToken,input)).ok,true);
  store.setNow(new Date("2026-10-10T00:00:00.000Z"));
  assert.equal((await service.save(accepted.data.sessionToken,{...input,content:"Later"})).ok,true);
  assert.equal((await service.submit(accepted.data.sessionToken)).ok,true);
  const expired=await fixture(new Date("2026-10-10T00:00:00.000Z")); const denied=createGuestContributionService({getRepository:async()=>expired.repo,now:()=>expired.now});
  assert.equal((await denied.accept("i".repeat(64))).ok,false);
});

test("expired sessions require a single-use owner link and preserve the original draft", async()=>{
  const store=await fixture(); let now=store.now; const service=createGuestContributionService({getRepository:async()=>store.repo,now:()=>now,random:()=>"s".repeat(64)});
  const accepted=await service.accept("i".repeat(64)); assert.equal(accepted.ok,true); if(!accepted.ok)return;
  await service.save(accepted.data.sessionToken,input);
  now=new Date("2026-11-06T00:00:00.000Z"); assert.equal((await service.save(accepted.data.sessionToken,input)).ok,false);
  const link="r".repeat(64); assert.equal(await store.repo.createReauthenticationLink(store.record().id,await hashCapability(link),"link",now.toISOString(),new Date(now.getTime()+86_400_000).toISOString()),true);
  const reauth=await service.reauthenticate(link); assert.equal(reauth.ok,true); if(!reauth.ok)return;
  assert.equal((await service.save(reauth.data.sessionToken,{...input,content:"Resumed"})).ok,true);
  assert.equal(store.contribution()?.content,"Resumed");
  assert.equal((await service.reauthenticate(link)).ok,false);
});

test("revocation closes sessions and concurrent first saves still produce one article", async()=>{
  const store=await fixture(); const service=createGuestContributionService({getRepository:async()=>store.repo,now:()=>store.now,random:()=>"s".repeat(64)});
  const accepted=await service.accept("i".repeat(64)); assert.equal(accepted.ok,true); if(!accepted.ok)return;
  const saves=await Promise.all([service.save(accepted.data.sessionToken,input),service.save(accepted.data.sessionToken,input)]);
  assert.equal(saves.filter(result=>result.ok).length,2); assert.equal(store.contribution()?.id,"article-1");
  await store.repo.revokeInvitation(store.record().id,store.now.toISOString());
  assert.equal((await service.save(accepted.data.sessionToken,input)).ok,false);
});

test("submitted articles are neither editable nor resubmittable", async()=>{
  const store=await fixture(); const service=createGuestContributionService({getRepository:async()=>store.repo,now:()=>store.now,random:()=>"s".repeat(64)});
  const accepted=await service.accept("i".repeat(64)); assert.equal(accepted.ok,true); if(!accepted.ok)return;
  await service.save(accepted.data.sessionToken,input); assert.equal((await service.submit(accepted.data.sessionToken)).ok,true);
  assert.equal((await service.save(accepted.data.sessionToken,input)).ok,false); assert.equal((await service.submit(accepted.data.sessionToken)).ok,false);
});
