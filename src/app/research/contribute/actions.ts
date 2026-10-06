"use server";
import { cookies } from "next/headers";
import { guestContributionService } from "@/lib/research/guest-contribution-service";
import type { DraftInput } from "@/lib/research";
async function token(){ return (await cookies()).get("research_guest_capability")?.value ?? ""; }
export async function saveGuestContributionAction(input: DraftInput){ return guestContributionService.save(await token(),input); }
export async function submitGuestContributionAction(){ return guestContributionService.submit(await token()); }
