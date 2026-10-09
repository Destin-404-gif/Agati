import Image from "next/image";
import type { ComponentType } from "react";
import * as LucideIcons from "lucide-react";

const Icons = LucideIcons as unknown as Record<string, ComponentType<{ className?: string }>>;

export function NavigationIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  if (name.startsWith("/")) {
    return <Image src={name} alt="" width={24} height={24} className={className} />;
  }
  const Glyph = Icons[name] ?? LucideIcons.Package;
  return <Glyph className={className} aria-hidden="true" />;
}