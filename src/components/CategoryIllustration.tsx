import { resolveIllustration } from "./category-illustrations";

type CategoryIllustrationProps = {
  /**
   * The category or sub-category slug. Drawn from the site's design tokens as
   * inline SVG, so there is no image to upload, resize or lazy-load.
   */
  slug?: string | null;
  /**
   * The parent category slug, when `slug` is a sub-category. Several
   * sub-category slugs appear under more than one department, so the parent
   * decides which drawing is used when the slug has no drawing of its own.
   */
  parentSlug?: string | null;
  className?: string;
};

/**
 * The category hero's artwork: a line drawing chosen by slug, drawn in code.
 *
 * Used by category, sub-category and navigation pages in place of an uploaded
 * hero photo. It is decorative - the page's own `h1` already names the
 * category - so it is hidden from assistive technology and scales to whatever
 * box its container gives it.
 */
export default function CategoryIllustration({
  slug,
  parentSlug,
  className,
}: CategoryIllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className ?? "h-full w-full p-6 sm:p-9"}
    >
      {resolveIllustration(slug, parentSlug)}
    </svg>
  );
}