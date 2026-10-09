import { handleDbError, json } from "@/lib/api";
import { getCategories, getSubcategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [categories, subcategories] = await Promise.all([getCategories(), getSubcategories()]);
    const categoryOptions = categories.map((category) => ({
      ...category,
      subcategories: subcategories
        .filter((subcategory) => subcategory.category_id === category.id)
        .map(({ id, name, slug }) => ({ id, name, slug })),
    }));
    return json({ categories: categoryOptions, count: categoryOptions.length });
  } catch (err) {
    return handleDbError(err);
  }
}
