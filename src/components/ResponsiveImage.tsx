"use client";

/* eslint-disable @next/next/no-img-element */
/*
 * A plain `<img>` is deliberate: the upload pipeline already produced a WebP/PNG
 * for every width, so letting the Next image optimizer touch them again would
 * re-compress files that are already optimal. Building the `srcSet` ourselves
 * means the browser picks the sharpest file its screen can use with no server
 * round trip and no extra generation loss.
 */

import { useState } from "react";
import { buildSrcSet, type ImageVariant } from "@/lib/image-variants";

export interface ResponsiveImageProps {
  /** Fallback / largest url, used when no variants are known. */
  src: string;
  variants?: readonly ImageVariant[] | null;
  /** A small version painted underneath (blurred) while the real file loads. */
  placeholderUrl?: string | null;
  alt: string;
  /** Required for the browser to pick a variant. */
  sizes?: string;
  /** Classes for the image itself (e.g. `object-cover`). */
  className?: string;
  /** Classes for the sizing wrapper. */
  wrapperClassName?: string;
  width?: number | null;
  height?: number | null;
  /** CSS aspect-ratio (e.g. `"4 / 5"`); prevents layout shift before load. */
  aspect?: string;
  priority?: boolean;
  /** Fill the (positioned) parent instead of sizing to width/height. */
  fill?: boolean;
}

export default function ResponsiveImage({
  src,
  variants,
  placeholderUrl,
  alt,
  sizes,
  className,
  wrapperClassName,
  width,
  height,
  aspect,
  priority = false,
  fill = false,
}: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const srcSet = buildSrcSet(variants, src);
  const ratio = aspect ?? (width && height ? `${width} / ${height}` : undefined);
  const wrapper = fill
    ? "absolute inset-0 overflow-hidden"
    : "relative block overflow-hidden";

  return (
    <span className={`${wrapper} ${wrapperClassName ?? ""}`} style={{ aspectRatio: ratio }}>
      {placeholderUrl && !loaded && (
        <img
          src={placeholderUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full scale-105 object-cover blur-xl"
        />
      )}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={fill || ratio ? undefined : (width ?? undefined)}
        height={fill || ratio ? undefined : (height ?? undefined)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`relative h-full w-full transition-opacity duration-500 motion-reduce:transition-none ${
          loaded || !placeholderUrl ? "opacity-100" : "opacity-0"
        } ${className ?? ""}`}
      />
    </span>
  );
}