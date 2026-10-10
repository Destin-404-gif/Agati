"use client";

import Image from "next/image";
import { useMemo } from "react";
import { AtSign, Camera, Mail, MessageCircle, type LucideIcon } from "lucide-react";
import { Reveal, RevealItem } from "./Reveal";

export type TeamSocial = {
  label: string;
  href: string;
  handle?: string;
};

/**
 * The shape every member is rendered from. Adding someone is a new entry in the
 * array on the team page - no markup changes. The member whose `isOwner` is true
 * is pulled out and rendered as the featured block automatically.
 */
export type TeamMember = {
  id: string | number;
  name: string;
  role: string;
  photo: string | null;
  isOwner: boolean;
  bio: string | null;
  socials: TeamSocial[];
};

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  Instagram: Camera,
  X: AtSign,
  WhatsApp: MessageCircle,
  Email: Mail,
};

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function MemberPhoto({ member }: { member: TeamMember }) {
  if (member.photo) {
    return (
      <Image
        src={member.photo}
        alt={`${member.name} - ${member.role}`}
        fill
        sizes="(max-width: 767px) 45vw, (max-width: 1023px) 30vw, 200px"
        loading="lazy"
        className="object-cover"
      />
    );
  }
  return (
    <span className="flex size-full items-center justify-center bg-sage p-4 text-center font-display text-4xl font-black text-cream">
      {initials(member.name) || "AW"}
    </span>
  );
}

function SocialLinks({
  member,
  className = "",
}: {
  member: TeamMember;
  className?: string;
}) {
  if (member.socials.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      {member.socials.map((social) => {
        const Icon = SOCIAL_ICONS[social.label] ?? Mail;
        return (
          <a
            key={social.label}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`${social.label}${social.handle ? ` - ${social.handle}` : ""}`}
            aria-label={`${member.name} on ${social.label}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-espresso/5 text-espresso/55 transition-colors duration-300 hover:bg-terracotta hover:text-cream"
          >
            <Icon className="size-[18px]" aria-hidden />
          </a>
        );
      })}
    </div>
  );
}

/** Standard circular member card: no ring, socials fade in on hover. */
function MemberCard({ member }: { member: TeamMember }) {
  return (
    <article className="group flex h-full flex-col items-center text-center">
      <div className="relative size-36 sm:size-44 lg:size-52">
        <div className="relative h-full w-full overflow-hidden rounded-full bg-cream-dark shadow-soft ring-1 ring-espresso/10 transition-all duration-300 ease-out group-hover:scale-[1.045] group-hover:shadow-lift">
          <MemberPhoto member={member} />

          {member.socials.length > 0 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
              {member.socials.map((social) => {
                const Icon = SOCIAL_ICONS[social.label] ?? Mail;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${member.name} on ${social.label}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-espresso/80 text-cream backdrop-blur-sm transition-colors duration-300 hover:bg-terracotta"
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <h3 className="mt-5 text-[17px] leading-tight font-bold tracking-tight text-espresso">
        {member.name}
      </h3>
      <div className="mt-1 flex min-h-6 items-center justify-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta">
          {member.role}
        </p>
      </div>
    </article>
  );
}

export function TeamGrid({ members }: { members: TeamMember[] }) {
  const owner = useMemo(() => members.find((m) => m.isOwner) ?? null, [members]);
  const others = useMemo(() => members.filter((m) => !m.isOwner), [members]);

  if (members.length === 0) {
    return (
      <div className="rounded-[2rem] bg-white px-6 py-20 text-center shadow-soft">
        <p className="text-eyebrow text-terracotta">Our bench</p>
        <h2 className="mt-4 text-display text-[clamp(1.6rem,3vw,2.2rem)] text-espresso">
          The workshop is forming.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-espresso/60">
          We are recruiting and will introduce our people here as they join the
          bench.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* --------------------------------------------- featured owner block */}
      {owner && (
        <Reveal>
          <RevealItem fade>
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-col items-center gap-12 text-center lg:flex-row lg:items-center lg:gap-16 lg:text-left">
                <div className="relative shrink-0">
                  <div
                    className="relative size-[280px] overflow-hidden rounded-full border-4 border-terracotta bg-cream-dark sm:size-[320px]"
                    style={{
                      boxShadow:
                        "0 0 0 14px rgba(199,123,93,0.15), 0 24px 60px -20px rgba(36,28,20,0.35)",
                    }}
                  >
                    <MemberPhoto member={owner} />
                  </div>
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-terracotta px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cream shadow-lift">
                    Founder &amp; Owner
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-eyebrow text-terracotta">Workshop lead</p>
                  <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1.1] font-bold text-espresso">
                    {owner.name}
                  </h2>
                  <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-espresso/45">
                    {owner.role}
                  </p>
                  {owner.bio && (
                    <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-espresso/70 lg:mx-0">
                      {owner.bio}
                    </p>
                  )}
                  <SocialLinks
                    member={owner}
                    className="mt-6 justify-center lg:justify-start"
                  />
                </div>
              </div>
            </div>
          </RevealItem>
        </Reveal>
      )}

      {/* --------------------------------------------------- the rest of us */}
      {others.length > 0 && (
        <>
          <Reveal>
            <RevealItem fade>
              <div className="flex items-center gap-5">
                <span className="h-px flex-1 bg-espresso/10" aria-hidden="true" />
                <h2 className="whitespace-nowrap font-display text-2xl font-bold text-espresso">
                  Meet the Team
                </h2>
                <span className="h-px flex-1 bg-espresso/10" aria-hidden="true" />
              </div>
            </RevealItem>
          </Reveal>

          <Reveal
            stagger={0.08}
            className="grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-3 lg:grid-cols-4 lg:gap-y-16"
          >
            {others.map((member) => (
              <RevealItem key={member.id}>
                <MemberCard member={member} />
              </RevealItem>
            ))}
          </Reveal>
        </>
      )}
    </div>
  );
}