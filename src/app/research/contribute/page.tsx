import { cookies } from "next/headers";
import { Container } from "@/components/ui/container";
import { guestContributionService } from "@/lib/research/guest-contribution-service";
import { GuestEditor } from "./guest-editor";
export const dynamic = "force-dynamic";
export default async function GuestContributionPage(){ const token=(await cookies()).get("research_guest_capability")?.value ?? ""; const result=await guestContributionService.getContributionForDisplay(token); if(!result.ok)return <Container as="main" className="py-16"><h1 className="text-2xl font-semibold">Contribution unavailable</h1><p className="mt-3 text-muted">{result.message}</p></Container>; return <GuestEditor article={result.data.article} submitted={result.data.submitted}/>; }
