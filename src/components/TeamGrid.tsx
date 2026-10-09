"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Reveal, RevealItem } from "./Reveal";

type TeamRole = "owner" | "administrator" | "worker";
type TeamStatus = "working" | "off_duty" | "on_leave";

interface PublicTeamMember {
  id: number;
  full_name: string;
  role: TeamRole;
  job_title: string | null;
  photo_url: string | null;
  status: TeamStatus;
}

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  administrator: "Administrators",
  worker: "Workers",
};

const ROLE_ORDER: TeamRole[] = ["owner", "administrator", "worker"];

const STATUS_LABELS: Record<TeamStatus, string> = {
  working: "Working",
  off_duty: "Off duty",
  on_leave: "On leave",
};

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function MemberSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[2rem] bg-white shadow-soft">
      <div className="aspect-[4/5] w-full bg-cream-dark" />
      <div className="space-y-2 p-5">
        <div className="h-4 w-3/4 rounded-full bg-cream-dark" />
        <div className="h-3 w-1/2 rounded-full bg-cream-dark" />
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: TeamStatus }) {
  if (status === "working") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sage px-3 py-1 text-[11px] font-bold tracking-wide text-cream uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-cream" />
        Working
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-espresso/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-espresso/55 uppercase">
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TeamGrid() {
  const [members, setMembers] = useState<PublicTeamMember[] | null>(null);
  const [tab, setTab] = useState<"all" | "working">("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/team/public", { cache: "no-store" });
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const list = members ?? [];
    if (tab === "working") return list.filter((m) => m.status === "working");
    return list;
  }, [members, tab]);

  const sections = useMemo(
    () =>
      ROLE_ORDER.map((role) => ({
        role,
        label: ROLE_LABELS[role],
        members: filtered.filter((m) => m.role === role),
      })).filter((s) => s.members.length > 0),
    [filtered],
  );

  if (members === null) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <MemberSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-[2rem] bg-white px-6 py-20 text-center shadow-soft">
        <p className="text-eyebrow text-terracotta">Team</p>
        <h2 className="mt-4 text-display text-[clamp(1.6rem,3vw,2.2rem)] text-espresso">
          The workshop is forming.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-espresso/60">
          We are recruiting and will introduce our people here as they join the bench.
        </p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-[2rem] bg-white px-6 py-20 text-center shadow-soft">
        <p className="text-[15px] leading-relaxed text-espresso/60">
          Nobody on the bench is marked as working right now - the coffee machine should be blamed, not the joiners.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {/* ---------------------------------------------------------- filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-espresso/10 bg-white p-1 shadow-soft">
          {([
            { key: "all", label: "All Team" },
            { key: "working", label: "Currently Working" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-espresso text-cream"
                  : "text-espresso/60 hover:text-espresso"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs uppercase tracking-[0.14em] text-espresso/40">
          {tab === "all"
            ? `${filtered.length} on the roster`
            : `${filtered.length} at the bench right now`}
        </p>
      </div>

      {/* ------------------------------------------------------- sections */}
      {sections.map((section) => (
        <section key={section.role}>
          <Reveal>
            <RevealItem>
              <div className="mb-6 flex items-baseline gap-3">
                <h2 className="text-display text-[clamp(1.4rem,3vw,1.9rem)] text-espresso">
                  {section.label}
                </h2>
                <span className="text-[11px] uppercase tracking-[0.16em] text-espresso/40">
                  {section.members.length}
                </span>
              </div>
            </RevealItem>
          </Reveal>

          <Reveal stagger={0.08} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {section.members.map((member) => (
              <RevealItem key={member.id}>
                <article className="group h-full overflow-hidden rounded-[2rem] bg-white shadow-soft transition-shadow hover:shadow-lift">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-cream-dark">
                    {member.photo_url ? (
                      <Image
                        src={member.photo_url}
                        alt={`${member.full_name} - ${member.job_title ?? ROLE_LABELS[member.role]}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-sage">
                        <span className="font-display text-[clamp(3rem,8vw,5rem)] font-black text-cream/90">
                          {initials(member.full_name)}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <StatusChip status={member.status} />
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-display text-xl font-black text-espresso">
                      {member.full_name}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">
                      {member.job_title || ROLE_LABELS[member.role].replace(/s$/, "")}
                    </p>
                  </div>
                </article>
              </RevealItem>
            ))}
          </Reveal>
        </section>
      ))}
    </div>
  );
}