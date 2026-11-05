export type ContributorLinkKind = "accept" | "reauth";

/** The bearer secret lives only in the URL fragment, which HTTP never sends. */
export function contributorLink(origin: string, kind: ContributorLinkKind, token: string) {
  const url = new URL(`/research/contribute/${kind}`, origin);
  url.hash = token;
  return url.toString();
}
