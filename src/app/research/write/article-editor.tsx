"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { RESEARCH_CATEGORIES, slugify } from "@/lib/research";
import type { ArticleStatus, ResearchArticleRecord, ResearchCategory } from "@/lib/research";
import {
  createDraftAction,
  deleteArticleAction,
  publishAction,
  unpublishAction,
  updateDraftAction,
} from "./actions";
import { MarkdownPreview } from "./markdown-preview";

type SaveState = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

/**
 * The one editor component behind both /research/write/new and
 * /research/write/[id] — "new" is simply this component with no
 * `article` prop and no id yet. Every mutation goes through the Server
 * Actions in ./actions.ts, which re-check authorization server-side on
 * every call; nothing here ever assumes the current render is allowed to
 * write just because the layout let it render once.
 */
export function ArticleEditor({ article }: { article?: ResearchArticleRecord }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [id, setId] = useState(article?.id);
  const [status, setStatus] = useState<ArticleStatus>(article?.status ?? "draft");
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(article));
  const [description, setDescription] = useState(article?.description ?? "");
  const [category, setCategory] = useState<ResearchCategory>(article?.category ?? RESEARCH_CATEGORIES[0]);
  const [tagsInput, setTagsInput] = useState(article?.tags.join(", ") ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const isNew = id === undefined;
  const isPublished = status === "published";
  const tags = useMemo(
    () => tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
    [tagsInput],
  );

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
    setSaveState({ kind: "idle" });
  }

  function applyRecord(record: ResearchArticleRecord) {
    setId(record.id);
    setStatus(record.status);
    setTitle(record.title);
    setSlug(record.slug);
    setDescription(record.description);
    setCategory(record.category);
    setTagsInput(record.tags.join(", "));
    setContent(record.content);
  }

  function handleSave() {
    setSaveState({ kind: "saving" });
    startTransition(async () => {
      const input = { title, slug, description, category, tags, content };

      const result = isNew
        ? await createDraftAction(input)
        : await updateDraftAction(id!, input);

      if (!result.ok) {
        setSaveState({ kind: "error", message: result.message });
        return;
      }

      setSaveState({ kind: "saved" });
      applyRecord(result.data);
      if (isNew) router.replace(`/research/write/${result.data.id}`);
    });
  }

  function handlePublishToggle() {
    if (!id) return;
    setSaveState({ kind: "saving" });
    startTransition(async () => {
      const result = isPublished ? await unpublishAction(id) : await publishAction(id);
      if (!result.ok) {
        setSaveState({ kind: "error", message: result.message });
        return;
      }
      setSaveState({ kind: "saved" });
      applyRecord(result.data);
    });
  }

  function handleDelete() {
    if (!id) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteArticleAction(id);
      if (!result.ok) {
        setSaveState({ kind: "error", message: result.message });
        return;
      }
      router.push("/research/write");
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-8 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MonoLabel className="text-dim">
            RESEARCH / WRITE / {isNew ? "NEW" : status.toUpperCase()}
          </MonoLabel>
          <SaveIndicator state={saveState} isPending={isPending} />
        </div>

        <input
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Article title"
          className="w-full border-b border-border bg-transparent pb-3 text-2xl font-semibold text-foreground placeholder:text-dim focus:border-accent focus:outline-none sm:text-3xl"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug">
            <input
              value={slug}
              disabled={isPublished}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
                setSaveState({ kind: "idle" });
              }}
              className="w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground disabled:opacity-50 focus:border-accent focus:outline-none"
            />
            {isPublished && (
              <p className="mt-1 text-xs text-dim">
                Locked — this article is published at /research/{slug}.
              </p>
            )}
          </Field>

          <Field label="Category">
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as ResearchCategory);
                setSaveState({ kind: "idle" });
              }}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              {RESEARCH_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Excerpt / Summary" className="sm:col-span-2">
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSaveState({ kind: "idle" });
              }}
              rows={2}
              className="w-full resize-y rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </Field>

          <Field label="Tags (comma-separated)" className="sm:col-span-2">
            <input
              value={tagsInput}
              onChange={(event) => {
                setTagsInput(event.target.value);
                setSaveState({ kind: "idle" });
              }}
              placeholder="evm, state-transitions"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-dim focus:border-accent focus:outline-none"
            />
          </Field>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 border-t border-border px-6 pt-4 lg:hidden">
        <ViewToggleButton active={view === "editor"} onClick={() => setView("editor")}>
          Editor
        </ViewToggleButton>
        <ViewToggleButton active={view === "preview"} onClick={() => setView("preview")}>
          Preview
        </ViewToggleButton>
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-6 lg:grid-cols-2">
        <div className={view === "editor" ? "block" : "hidden lg:block"}>
          <textarea
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setSaveState({ kind: "idle" });
            }}
            placeholder={"# Heading\n\nWrite Markdown/MDX here..."}
            spellCheck={false}
            className="h-[60vh] w-full resize-y rounded border border-border bg-surface p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-dim focus:border-accent focus:outline-none"
          />
        </div>

        <div className={view === "preview" ? "block" : "hidden lg:block"}>
          <div className="h-[60vh] overflow-y-auto rounded border border-border p-4">
            {content.trim() ? (
              <MarkdownPreview content={content} />
            ) : (
              <p className="text-dim">Preview appears here as you write.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 border-t border-border px-6 pt-6">
        <ActionButton primary onClick={handleSave} disabled={isPending || !title.trim() || !content.trim()}>
          {isNew ? "Save Draft" : "Save Changes"}
        </ActionButton>

        {!isNew && (
          <ActionButton onClick={handlePublishToggle} disabled={isPending}>
            {isPublished ? "Unpublish" : "Publish"}
          </ActionButton>
        )}

        {!isNew && (
          <ActionButton onClick={handleDelete} disabled={isPending} destructive>
            Delete
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <MonoLabel className="text-dim">{label}</MonoLabel>
      {children}
    </label>
  );
}

function ViewToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] transition-colors ${
        active ? "bg-surface text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  primary,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  const base = "rounded border px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] transition-colors disabled:opacity-40";
  const tone = primary
    ? "border-accent bg-accent text-accent-foreground hover:opacity-90"
    : destructive
      ? "border-border text-warn hover:border-warn"
      : "border-border-strong text-foreground hover:border-accent hover:text-accent";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tone}`}>
      {children}
    </button>
  );
}

function SaveIndicator({ state, isPending }: { state: SaveState; isPending: boolean }) {
  if (isPending || state.kind === "saving") {
    return <MonoLabel className="text-dim">SAVING…</MonoLabel>;
  }
  if (state.kind === "saved") {
    return <MonoLabel className="text-accent">SAVED</MonoLabel>;
  }
  if (state.kind === "error") {
    return <MonoLabel className="text-warn">{state.message ?? "Error saving"}</MonoLabel>;
  }
  return null;
}
