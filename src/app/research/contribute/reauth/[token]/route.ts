import { guestContributionService } from "@/lib/research/guest-contribution-service";
import { confirmationPage, redeemPost } from "@/lib/research/redemption-page";

export async function GET() { return confirmationPage("Restore contributor access"); }

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return redeemPost(request, () => guestContributionService.reauthenticate(token));
}
