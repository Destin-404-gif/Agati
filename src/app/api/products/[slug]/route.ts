import { handleDbError, json, notFound } from "@/lib/api";
import { getProductBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) return notFound(`No product with slug "${slug}"`);
    return json({ product });
  } catch (err) {
    return handleDbError(err);
  }
}
