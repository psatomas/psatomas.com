/**
 * A campaign's standing authorizations (docs/map-authoring/l2-authoring.md,
 * "Merging"): the human's merge authorization, under which a run may merge its
 * own validated PR, and the standing repair exception. Kept in the checkout's
 * local campaign file (`.map-authoring/l2/campaign.json`, never committed).
 *
 * A merge authorization is copied into each run's state when the run starts.
 * Revoking it removes it from the campaign, so runs started afterwards end at
 * a validated PR awaiting human merge; a run started before the revocation is
 * refused at its merge stage. Nothing is deleted: a revoked or replaced
 * authorization moves to an append-only history with when and why.
 * Pure; development tooling only.
 */

export type L2Authorization = { at: string; authorization: string };
/** A merge authorization that is no longer active: revoked by a human decision, or replaced by a later authorization. */
export type L2AuthorizationChange =
  | { kind: "revoked"; authorization: L2Authorization; revokedAt: string; decision: string }
  | { kind: "superseded"; authorization: L2Authorization; supersededAt: string };
export type L2Campaign = {
  mergeAuthorization?: L2Authorization;
  repairException?: L2Authorization;
  /** Every merge authorization that stopped being active, oldest first. Never rewritten. */
  mergeAuthorizationHistory?: L2AuthorizationChange[];
  /** Anything else the file holds is kept as it is. */
  [key: string]: unknown;
};

export class AuthorizationError extends Error {}

/**
 * What `l2 authorize` was asked to do: record a merge authorization, record a
 * repair exception, or revoke the merge authorization. Exactly one, with
 * exactly the arguments it takes; anything else is refused as ambiguous.
 */
export type AuthorizeRequest = { kind: "merge"; authorization: string } | { kind: "repair-exception"; authorization: string } | { kind: "revoke-merge"; decision: string };
export function authorizeRequest(args: { authorization?: string; repairException?: string; revokeMerge: boolean; decision?: string }): AuthorizeRequest {
  const chosen = [args.authorization !== undefined && "--authorization", args.repairException !== undefined && "--repair-exception", args.revokeMerge && "--revoke-merge"].filter((entry): entry is string => Boolean(entry));
  if (chosen.length !== 1) {
    throw new AuthorizationError(
      chosen.length
        ? `authorize takes one of --authorization, --repair-exception or --revoke-merge, not ${chosen.join(" and ")}`
        : 'authorize needs --authorization "<the human\'s explicit campaign authorization>", --repair-exception "<..>", or --revoke-merge --decision "<..>"',
    );
  }
  if (!args.revokeMerge && args.decision !== undefined) throw new AuthorizationError("--decision belongs to --revoke-merge");
  if (args.revokeMerge) {
    if (!args.decision?.trim()) throw new AuthorizationError('--revoke-merge needs the human decision: --decision "<why merges now need a human>"');
    return { kind: "revoke-merge", decision: args.decision };
  }
  if (args.authorization !== undefined) {
    if (!args.authorization.trim()) throw new AuthorizationError("--authorization needs the human's explicit campaign authorization, quoted");
    return { kind: "merge", authorization: args.authorization };
  }
  if (!args.repairException!.trim()) throw new AuthorizationError("--repair-exception needs the human's standing authorization, quoted");
  return { kind: "repair-exception", authorization: args.repairException! };
}

const withHistory = (campaign: L2Campaign, change: L2AuthorizationChange): L2AuthorizationChange[] => [...(campaign.mergeAuthorizationHistory ?? []), change];

/** The campaign with a new merge authorization. One it replaces moves to the history, never overwritten. */
export function authorizeMerge(campaign: L2Campaign, authorization: string, now: string): L2Campaign {
  const previous = campaign.mergeAuthorization;
  return {
    ...campaign,
    mergeAuthorization: { at: now, authorization },
    ...(previous ? { mergeAuthorizationHistory: withHistory(campaign, { kind: "superseded", authorization: previous, supersededAt: now }) } : {}),
  };
}

/**
 * The campaign with its merge authorization revoked: the authorization, when
 * it was given, when it was revoked and the human decision move to the
 * history. Everything else (the repair exception, any other entry) is kept.
 * With no active authorization nothing changes: revoking twice is safe.
 */
export function revokeMerge(campaign: L2Campaign, decision: string, now: string): { campaign: L2Campaign; revoked?: L2Authorization } {
  if (!decision.trim()) throw new AuthorizationError("revoking the merge authorization needs the human decision");
  const active = campaign.mergeAuthorization;
  if (!active) return { campaign };
  const rest: L2Campaign = { ...campaign };
  delete rest.mergeAuthorization;
  return { campaign: { ...rest, mergeAuthorizationHistory: withHistory(campaign, { kind: "revoked", authorization: active, revokedAt: now, decision }) }, revoked: active };
}

/** The authorization a run starting now inherits: the campaign's active one, never for the pilot. */
export const inheritedMergeAuthorization = (campaign: L2Campaign, { pilot = false } = {}): L2Authorization | undefined => (pilot ? undefined : campaign.mergeAuthorization);

/** The revocation of the authorization a run started under, if it has since been revoked. */
export function revocationOf(campaign: L2Campaign, runAuthorization: L2Authorization | undefined): Extract<L2AuthorizationChange, { kind: "revoked" }> | undefined {
  if (!runAuthorization) return undefined;
  return (campaign.mergeAuthorizationHistory ?? []).find(
    (change): change is Extract<L2AuthorizationChange, { kind: "revoked" }> => change.kind === "revoked" && change.authorization.at === runAuthorization.at && change.authorization.authorization === runAuthorization.authorization,
  );
}

/** `l2 campaign`'s merging lines: the active authorization, or none, then every change in the history. */
export function mergeStatusLines(campaign: L2Campaign): string[] {
  const active = campaign.mergeAuthorization;
  return [
    `merging: ${active ? `authorized ${active.at}: ${active.authorization}` : "not authorized; each validated PR awaits human merge"}`,
    ...(campaign.mergeAuthorizationHistory ?? []).map((change) =>
      change.kind === "revoked"
        ? `  revoked ${change.revokedAt}: the authorization of ${change.authorization.at} ("${change.authorization.authorization}"); decision: ${change.decision}`
        : `  superseded ${change.supersededAt}: the authorization of ${change.authorization.at} ("${change.authorization.authorization}")`,
    ),
  ];
}
