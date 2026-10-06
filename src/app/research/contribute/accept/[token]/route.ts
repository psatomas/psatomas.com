import { NextResponse } from "next/server";
import { guestContributionService } from "@/lib/research/guest-contribution-service";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await guestContributionService.validate(token);
  if (!result.ok) return NextResponse.redirect(new URL("/research/contribute?invalid=1", _.url));
  const response = NextResponse.redirect(new URL("/research/contribute", _.url));
  const seconds = Math.max(1, Math.floor((new Date(result.data.expiresAt).getTime() - Date.now()) / 1000));
  response.cookies.set("research_guest_capability", token, { httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:"lax", path:"/research/contribute", maxAge:seconds });
  return response;
}
