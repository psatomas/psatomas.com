"use server";

import { authoringService } from "@/lib/research/authoring-service";
import type { AuthoringResult } from "@/lib/research/authoring-service";
import type { DraftInput, ResearchArticleRecord } from "@/lib/research";

/**
 * Thin Server Action wrappers around authoring-service.ts — this file
 * exists so the Client Component editor has something to import and call
 * directly (Next.js requires "use server" functions to live in their own
 * module or be marked individually), not because there's any logic here
 * beyond delegation. Every one of these re-checks authorization itself,
 * through authoringService, using the current request's session — never
 * anything the client passes in. A client can call any of these directly
 * (a Server Action is just an HTTP endpoint under the hood, regardless of
 * whether the write layout rendered first), so that check has to happen
 * here regardless of the layout-level gate in layout.tsx.
 */

export async function createDraftAction(
  input: DraftInput,
): Promise<AuthoringResult<ResearchArticleRecord>> {
  return authoringService.createDraft(input);
}

export async function updateDraftAction(
  id: string,
  input: Partial<DraftInput>,
): Promise<AuthoringResult<ResearchArticleRecord>> {
  return authoringService.updateDraft(id, input);
}

export async function publishAction(id: string): Promise<AuthoringResult<ResearchArticleRecord>> {
  return authoringService.publish(id);
}

export async function unpublishAction(id: string): Promise<AuthoringResult<ResearchArticleRecord>> {
  return authoringService.unpublish(id);
}

export async function deleteArticleAction(id: string): Promise<AuthoringResult<null>> {
  return authoringService.deleteArticle(id);
}
