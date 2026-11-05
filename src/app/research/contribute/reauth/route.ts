import { guestContributionService } from "@/lib/research/guest-contribution-service";
import { confirmationPage, redeemPost } from "@/lib/research/redemption-page";

export async function GET() { return confirmationPage("Restore contributor access"); }
export async function POST(request: Request) { return redeemPost(request, (token) => guestContributionService.reauthenticate(token)); }
