import { NextResponse } from "next/server";
import { getMenuImages } from "@/lib/menu-images";

export const dynamic = "force-dynamic";

/**
 * The pictures the mega menu shows in its right-hand column, flat and in display
 * order. Read by categoryId, so the storefront never has to join anything.
 *
 * Public on purpose - the images it returns are the same files the menu already
 * renders, so there is nothing here to hide. Empty when no category has any, and
 * a database problem resolves to an empty list rather than a 500, so a menu can
 * always open.
 */
export async function GET() {
  const items = await getMenuImages();
  return NextResponse.json({ items, count: items.length });
}