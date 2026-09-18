// Preserve Next 16.3.1's existing default 404 UI byte-for-byte. Only its metadata
// is specialized here; next/error is a different (Pages Router) presentation.
export { default } from "next/dist/client/components/builtin/not-found";
import { missingSocialMetadata } from "@/lib/social/metadata";

export const metadata = missingSocialMetadata("Research article");
