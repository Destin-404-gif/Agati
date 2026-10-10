import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { TeamGrid, type TeamMember, type TeamSocial } from "@/components/TeamGrid";
import { getMedia, pageHeroSlot } from "@/lib/media";
import { listPublicTeam, type PublicTeamMember } from "@/lib/team";
import { SOCIALS } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Team",
  description:
    "The makers behind Agati Wood Works - the people who run the sawmill, fill the drying racks and keep the furniture repairable.",
};

// The roster and the banner come from the database.
export const dynamic = "force-dynamic";

/** The workshop's public accounts, narrowed to the ones a person profile shows. */
const ALL_SOCIALS: TeamSocial[] = SOCIALS.map((social) => ({
  label: social.label,
  href: social.href,
  handle: social.handle,
}));

const FOUNDER_SOCIALS: TeamSocial[] = ALL_SOCIALS.filter((social) =>
  ["Instagram", "WhatsApp", "Email"].includes(social.label),
);

const OWNER_BIO =
  "Founded Agati in 2019 with one bench, a stack of locally-felled hardwood and a stubborn belief that good furniture should be repairable. Still draws every commission before it is cut, and still signs off the last coat of oil himself.";

/**
 * Maps a database roster row onto the display model the grid renders. Name,
 * role, photo and the owner flag come from the row; the bio and social links
 * are workshop copy that only the founder's block needs.
 */
function toDisplayMember(member: PublicTeamMember): TeamMember {
  const isOwner = member.role === "owner";
  const role =
    member.job_title?.trim() ||
    (member.role === "owner"
      ? "Founder"
      : member.role === "administrator"
        ? "Co-founder"
        : "Workshop");

  return {
    id: member.id,
    name: member.full_name,
    role,
    photo: member.photo_url,
    isOwner,
    bio: isOwner ? OWNER_BIO : null,
    socials: isOwner || member.role === "administrator" ? FOUNDER_SOCIALS : [],
  };
}

/**
 * Rendered only if the roster cannot be read, so the page still shows a complete
 * team layout (with placeholder avatars) instead of an empty bench.
 */
const FALLBACK_TEAM: TeamMember[] = [
  {
    id: "owner",
    name: "J. Tuyishime",
    role: "Founder",
    photo: null,
    isOwner: true,
    bio: OWNER_BIO,
    socials: FOUNDER_SOCIALS,
  },
  {
    id: "co-founder",
    name: "Gatoto Destin",
    role: "Co-founder",
    photo: null,
    isOwner: false,
    bio: null,
    socials: FOUNDER_SOCIALS,
  },
  { id: "sawyer", name: "Rose Mukamana", role: "Sawyer", photo: null, isOwner: false, bio: null, socials: [] },
  { id: "joiner", name: "Eric Nshimiyimana", role: "Joiner", photo: null, isOwner: false, bio: null, socials: [] },
  { id: "finisher", name: "Sandra Uwase", role: "Finisher", photo: null, isOwner: false, bio: null, socials: [] },
];

export default async function TeamPage() {
  const slot = pageHeroSlot("team");
  const media = await getMedia([slot]);

  let members: TeamMember[] = [];
  try {
    const roster = await listPublicTeam();
    members = roster.map(toDisplayMember);
  } catch (err) {
    console.error("[team] could not load the roster, using the static team", err);
  }
  if (members.length === 0) members = FALLBACK_TEAM;

  return (
    <main>
      <PageHero
        eyebrow="The makers"
        title={"Our\nTeam"}
        intro="Sawyers, joiners and finishers who would rather mend a chair than sell you a new one - eleven hands and a very well-used bench."
        image={media[slot] ?? null}
        crumbs={[{ label: "Home", href: "/" }, { label: "Team" }]}
      />

      <section className="bg-cream py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <TeamGrid members={members} />
        </div>
      </section>
    </main>
  );
}