import { notFound } from "next/navigation";
import { authoringService } from "@/lib/research/authoring-service";
import { ArticleEditor } from "../article-editor";

export const dynamic = "force-dynamic";

export default async function EditResearchArticlePage(
  props: PageProps<"/research/write/[id]">,
) {
  const { id } = await props.params;
  const result = await authoringService.getArticleForEditing(id);

  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    // unauthenticated/forbidden here would mean the session that passed
    // the write layout's check a moment ago is no longer valid by the
    // time this ran — vanishingly unlikely, but notFound() is still the
    // right fallback rather than leaking which id exists.
    notFound();
  }

  return <ArticleEditor article={result.data} />;
}
