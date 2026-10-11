import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { resolveImageLink } from "@/lib/image-resolve";

export const dynamic = "force-dynamic";

/**
 * Resolve a pasted link to a direct image for the admin live preview.
 *
 * The admin image input pastes any https address, but a page like a Pinterest
 * pin cannot render in an `<img>`. The input calls this endpoint when its
 * preview fails so the picture can be shown without blocking the editor.
 */
export const GET = withAuth(async ({ req }) => {
  const link = new URL(req.url).searchParams.get("link")?.trim() ?? "";
  if (!link) return NextResponse.json({ url: "" });
  const url = await resolveImageLink(link);
  return NextResponse.json({ url });
});