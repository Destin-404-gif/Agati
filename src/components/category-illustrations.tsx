import type { ReactNode } from "react";

/**
 * Line drawings for the category hero card, keyed by slug.
 *
 * Every drawing is inline SVG built from the site's own tokens (`espresso`,
 * `terracotta`, `sage`, `cream`), so the illustrations inherit the palette
 * instead of carrying colours of their own. Nothing here is a raster asset:
 * there is nothing to upload, resize, optimise or cache-bust.
 *
 * Shared visual language, applied by every drawing:
 *
 * - `viewBox="0 0 320 240"`, with a floor line at y=202. Objects from different
 *   departments therefore sit on the same baseline, so swapping one drawing for
 *   another never shifts the layout.
 * - Strokes are `espresso` at 2.5 for outlines and 1.5 at lower opacity for
 *   detail, always with round caps and joins, so corners read as hand-drawn
 *   rather than machined.
 * - Fills are the same hues at low opacity, used sparingly as soft mass under a
 *   rug, a panel or a leaf.
 */

/* -------------------------------------------------------------- primitives */

/** The baseline every drawing stands on. */
function Ground() {
  return (
    <path d="M22 202h276" strokeWidth={2} strokeLinecap="round" className="stroke-espresso/25" />
  );
}

/**
 * The floor: the shared baseline plus a soft rug beneath the piece, so nothing
 * floats. Every drawing starts with this.
 */
function Floor({ cx = 160, rx = 118 }: { cx?: number; rx?: number }) {
  return (
    <>
      <Ground />
      <ellipse cx={cx} cy={202} rx={rx} ry={13} className="fill-terracotta/10" />
    </>
  );
}

/** Faint board-and-batten lines, used behind cabinet fronts. */
function Battens({ x, width, rows = 2 }: { x: number; width: number; rows?: number }) {
  return (
    <g className="stroke-espresso/15" strokeWidth={1.5} strokeLinecap="round">
      {Array.from({ length: rows }, (_, i) => (
        <line
          key={i}
          x1={x + (width / (rows + 1)) * (i + 1)}
          y1={72}
          x2={x + (width / (rows + 1)) * (i + 1)}
          y2={202}
        />
      ))}
    </g>
  );
}

/* ------------------------------------------------------- department art */

const livingRoom = (
  <>
    <Floor cx={160} rx={132} />
    {/* floor lamp */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M238 74h30l-7-22h-16z" className="fill-terracotta/12" />
      <path d="M253 52v148M236 202h34" />
    </g>
    {/* coffee table */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M104 158h84a6 6 0 0 1 6 6v4H98v-4a6 6 0 0 1 6-6z" className="fill-sage/12" />
      <path d="M110 168v32M182 168v32" />
    </g>
    {/* sofa */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M48 128a10 10 0 0 1 10-10h116a10 10 0 0 1 10 10v34H48z" className="fill-sage/12" />
      <path d="M40 138h14v24H40zM202 138h14v24h-14z" className="fill-espresso/8" />
      <path d="M48 162h136v22a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6z" className="fill-sage/15" />
      <path d="M84 118v44M148 118v44" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M60 190v12M172 190v12" />
    </g>
  </>
);

const bedroom = (
  <>
    <Floor cx={158} rx={132} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* headboard */}
      <path d="M56 66h26a10 10 0 0 1 10 10v126H46V76a10 10 0 0 1 10-10z" className="fill-sage/12" />
      <path d="M46 118h46" strokeWidth={1.5} className="stroke-espresso/30" />
      {/* mattress and base */}
      <path d="M92 148h150a8 8 0 0 1 8 8v14H92z" className="fill-cream" />
      <path d="M92 170h158v20a6 6 0 0 1-6 6H98a6 6 0 0 1-6-6z" className="fill-sage/15" />
      <path d="M102 196v6M240 196v6" />
      {/* pillows */}
      <path d="M104 130h44a8 8 0 0 1 0 18h-44a8 8 0 0 1 0-18z" className="fill-terracotta/12" />
      <path d="M158 132h44a7 7 0 0 1 0 14h-44a7 7 0 0 1 0-14z" className="fill-cream" />
    </g>
    {/* bedside table */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M258 156h40v6h-40zM262 162v38h32v-38" className="fill-sage/12" />
      <path d="M266 172h24v12h-24zM278 172v6" strokeWidth={1.5} className="stroke-espresso/30" />
    </g>
  </>
);

const office = (
  <>
    <Floor cx={160} rx={132} />
    {/* bookshelf */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M212 60h66v142h-66z" className="fill-sage/10" />
      <path d="M212 96h66M212 132h66M212 168h66" />
      <g strokeWidth={1.5} className="stroke-espresso/40">
        <path d="M226 168v-20h9v20M240 168v-13h8v13M253 168v-19h9v19" />
        <path d="M220 84h8V72h9v12h8V66h9v18" />
      </g>
    </g>
    {/* task chair behind the desk */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M96 104h40v42H96z" className="fill-espresso/8" />
      <path d="M106 118h20M106 128h20" strokeWidth={1.5} className="stroke-espresso/30" />
    </g>
    {/* desk */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M52 148h132a6 6 0 0 1 6 6v6H46v-6a6 6 0 0 1 6-6z" className="fill-sage/12" />
      <path d="M58 160v42M180 160v42" />
      <path d="M150 140h30v-6h-30z" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

const diningRoom = (
  <>
    <Floor cx={160} rx={138} />
    {/* chairs at the far end */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/45">
      <path d="M86 76h12v46H86zM136 76h12v46h-12z" className="fill-espresso/6" />
      <path d="M92 76v-10M142 76v-10M92 66h50" />
    </g>
    {/* table */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M62 130h196a6 6 0 0 1 6 6v8H56v-8a6 6 0 0 1 6-6z" className="fill-sage/12" />
      <path d="M74 144v58M246 144v58" />
      <path d="M74 172h172" strokeWidth={1.5} className="stroke-espresso/30" />
      {/* a bowl on top */}
      <path d="M148 124h24a12 12 0 0 1-24 0z" className="fill-terracotta/15" />
    </g>
    {/* chairs in front */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M92 158h36v10H92zM84 158v-34h9v34M127 158v-34h9v34" className="fill-espresso/8" />
      <path d="M96 168v34M124 168v34" />
      <path d="M192 158h36v10h-36zM184 158v-34h9v34M227 158v-34h9v34" className="fill-espresso/8" />
      <path d="M196 168v34M224 168v34" />
    </g>
  </>
);

const kitchen = (
  <>
    <Floor cx={160} rx={126} />
    {/* hanging rail with pots */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/70">
      <path d="M104 46h112" />
      <path d="M124 46v10M160 46v16M196 46v10" strokeWidth={1.5} className="stroke-espresso/40" />
      <path d="M114 56h20l-3 20h-14zM149 62h22l-3 22h-16zM186 56h20l-3 20h-14z" className="fill-terracotta/12" />
    </g>
    {/* island */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M64 132h192a8 8 0 0 1 8 8v10H56v-10a8 8 0 0 1 8-8z" className="fill-sage/12" />
      <path d="M64 150h192v44a6 6 0 0 1-6 6H70a6 6 0 0 1-6-6z" className="fill-sage/15" />
      <path d="M74 160h58v18H74zM148 160h58v18h-58z" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M103 160v18M177 160v18" strokeWidth={1.5} className="stroke-espresso/35" />
    </g>
    {/* stools */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/70">
      <path d="M96 176h32v8H96zM102 184v18M122 184v18M100 193h24" className="fill-terracotta/12" />
      <path d="M192 176h32v8h-32zM198 184v18M218 184v18M196 193h24" className="fill-terracotta/12" />
    </g>
  </>
);

const outdoor = (
  <>
    <Floor cx={160} rx={134} />
    {/* potted plant */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/70">
      <path d="M52 176h30l-4 26H56z" className="fill-terracotta/15" />
      <path d="M67 176c0-18 10-28 10-28M67 176c-8-12-20-14-20-14M67 176c6-14 20-18 20-18" />
    </g>
    {/* bench */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M96 150h92v12H96z" className="fill-sage/15" />
      <path d="M104 132h76v14h-76z" className="fill-sage/10" />
      <path d="M104 150h76" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M104 162v40M180 162v40" />
      <path d="M96 176h92" strokeWidth={1.5} className="stroke-espresso/30" />
    </g>
    {/* round patio table */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <ellipse cx={244} cy={164} rx={44} ry={12} className="fill-sage/12" />
      <path d="M244 176v24M226 202h36" />
    </g>
  </>
);

const chairsSeating = (
  <>
    <Floor cx={160} rx={140} />
    {/* spindle-back */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M44 118h10v46H44zM76 118h10v46H76zM104 118h10v46h-10z" className="fill-espresso/6" />
      <path d="M38 164h82v12H38z" className="fill-sage/15" />
      <path d="M46 176v26M112 176v26M56 108v10M92 108v10" />
    </g>
    {/* wing chair */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M136 132a12 12 0 0 1 12-12h24a12 12 0 0 1 12 12v34h-48z" className="fill-sage/12" />
      <path d="M130 142h12v24h-12zM196 142h12v24h-12z" className="fill-espresso/8" />
      <path d="M136 166h48v14a6 6 0 0 1-6 6h-36a6 6 0 0 1-6-6z" className="fill-sage/15" />
      <path d="M144 186v16M176 186v16" />
    </g>
    {/* stool */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/70">
      <path d="M228 162h56v12h-56z" className="fill-terracotta/12" />
      <path d="M236 174v28M276 174v28M234 188h44" />
    </g>
  </>
);

const storageShelving = (
  <>
    <Floor cx={160} rx={136} />
    {/* open shelving unit */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M40 54h124v148H40z" className="fill-sage/10" />
      <path d="M40 92h124M40 130h124M40 168h124" />
      <g strokeWidth={1.5} className="stroke-espresso/40">
        <path d="M52 130v-20h10v20M68 130v-13h9v13M82 130v-22h10v22" />
        <path d="M56 168v-14h24v14" />
        <path d="M124 92V70h16v22" />
      </g>
    </g>
    {/* cabinet with drawers */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M184 92h96v110h-96z" className="fill-sage/12" />
      <path d="M184 129h96M184 166h96" />
      <path d="M224 110h16M224 147h16M224 184h16" strokeWidth={2.5} className="stroke-espresso/40" />
    </g>
  </>
);

const kidsNursery = (
  <>
    <Floor cx={160} rx={138} />
    {/* crib */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M42 108h108v58H42z" className="fill-sage/10" />
      <path d="M58 108v58M74 108v58M90 108v58M106 108v58M122 108v58M138 108v58" strokeWidth={1.5} className="stroke-espresso/40" />
      <path d="M42 128h108" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M52 166v34M140 166v34" />
      <path d="M52 108V86M140 108V86M52 86h88" strokeWidth={2.5} className="stroke-espresso/40" />
    </g>
    {/* small round table */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <ellipse cx={226} cy={152} rx={40} ry={11} className="fill-sage/12" />
      <path d="M226 163v39M208 202h36" />
    </g>
    {/* tiny chair and toy blocks */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/70">
      <path d="M178 168h20v8h-20zM174 168v-20h7v20M195 168v-20h7v20M181 176v18M193 176v18" className="fill-terracotta/12" />
      <path d="M258 182h22v20h-22z" className="fill-terracotta/15" />
      <path d="M282 190h20v12h-20z" className="fill-sage/15" />
      <path d="M269 182v-8" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

const customFurniture = (
  <>
    <Ground />
    {/* blueprint grid */}
    <g className="stroke-espresso/12" strokeWidth={1}>
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`v${i}`} x1={28 + i * 33} y1={28} x2={28 + i * 33} y2={212} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`h${i}`} x1={28} y1={28 + i * 33} x2={292} y2={28 + i * 33} />
      ))}
    </g>
    {/* saw */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M52 132h58v18H52z" className="fill-sage/12" />
      <path d="M110 132l24 12-24 6z" className="fill-espresso/8" />
      <path d="M58 150v10h22v-10" />
      <path d="M110 138h8M110 144h6" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
    {/* hand plane */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M156 148h74v18h-74z" className="fill-terracotta/12" />
      <path d="M172 148v-20a8 8 0 0 1 8-8h26a8 8 0 0 1 8 8v20" />
      <path d="M188 166v6h10v-6" className="fill-espresso/8" />
    </g>
    {/* pencil and rule */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/60">
      <path d="M64 186l58-14v10l-58 14z" className="fill-sage/12" />
      <path d="M64 186l-10 6 10 4z" className="fill-espresso/8" />
      <path d="M156 190h96v10h-96z" className="fill-terracotta/10" />
      <path d="M172 190v10M188 190v10M204 190v10M220 190v10M236 190v10" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

/** Unknown slug: the workshop itself - grain, a mortise and tenon, a plane. */
const workshop = (
  <>
    <Ground />
    {/* board with grain */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/70">
      <path d="M40 96h150a8 8 0 0 1 8 8v52H32v-52a8 8 0 0 1 8-8z" className="fill-sage/12" />
      <path d="M52 116c14-8 28 8 42 0s28 8 42 0 28 8 40 0M46 138c16-9 30 9 46 0s30 9 46 0" strokeWidth={1.5} className="stroke-espresso/30" />
    </g>
    {/* mortise and tenon */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M222 96h64v52h-64z" className="fill-terracotta/10" />
      <path d="M234 110h40v24h-40z" strokeWidth={1.5} strokeDasharray="4 4" className="stroke-espresso/40" />
      <path d="M158 122h64v6h-64z" className="fill-terracotta/15" />
    </g>
    {/* plane on the bench */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M36 176h116v18H36z" className="fill-sage/12" />
      <path d="M58 176v-20a8 8 0 0 1 8-8h30a8 8 0 0 1 8 8v20" />
      <path d="M76 194v6h12v-6" className="fill-espresso/8" />
      <path d="M36 200h116" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
    {/* shavings */}
    <path
      d="M180 178c14-6 26 2 34 8M196 192c12-4 22 2 28 6"
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
      className="stroke-terracotta/60"
    />
  </>
);

/* ---------------------------------------------------- subcategory art */

const sofa = (
  <>
    <Floor cx={160} rx={142} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M46 118a12 12 0 0 1 12-12h204a12 12 0 0 1 12 12v44H46z" className="fill-sage/12" />
      <path d="M36 132h16v30H36zM268 132h16v30h-16z" className="fill-espresso/8" />
      <path d="M46 162h228v24a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8z" className="fill-sage/15" />
      <path d="M108 106v56M212 106v56" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M62 194v8M258 194v8" />
    </g>
    {/* a throw over the back */}
    <path d="M148 96c8-8 22-8 30 0-10 4-20 4-30 0z" className="fill-terracotta/15" />
    <path d="M163 96V78" strokeWidth={2.5} strokeLinecap="round" className="stroke-espresso/50" />
  </>
);

const armchair = (
  <>
    <Floor cx={160} rx={132} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* back */}
      <path d="M84 100a14 14 0 0 1 14-14h124a14 14 0 0 1 14 14v56H84z" className="fill-sage/12" />
      {/* wings */}
      <path d="M70 108h16v50H70zM234 108h16v50h-16z" className="fill-sage/10" />
      {/* seat */}
      <path d="M84 156h152v26a8 8 0 0 1-8 8H92a8 8 0 0 1-8-8z" className="fill-sage/15" />
      <path d="M120 86v70M200 86v70" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M98 190v12M222 190v12" />
    </g>
    <path d="M146 132h30a7 7 0 0 1 0 14h-30a7 7 0 0 1 0-14z" className="fill-terracotta/12" />
  </>
);

const diningChair = (
  <>
    <Floor cx={160} rx={122} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* top rail and posts */}
      <path d="M104 90h112v10H104z" className="fill-sage/12" />
      <path d="M112 100v68M208 100v68" />
      {/* slats */}
      <path d="M112 114h96M112 134h96M112 154h96" strokeWidth={1.5} className="stroke-espresso/40" />
      {/* seat */}
      <path d="M104 168h112v12a6 6 0 0 1-6 6H110a6 6 0 0 1-6-6z" className="fill-sage/15" />
      {/* legs and stretcher */}
      <path d="M114 186v16M206 186v16" />
      <path d="M118 200h84" strokeWidth={1.5} className="stroke-espresso/25" />
    </g>
  </>
);

const bed = (
  <>
    <Floor cx={160} rx={134} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M52 56h34a12 12 0 0 1 12 12v134H40V68a12 12 0 0 1 12-12z" className="fill-sage/12" />
      <path d="M40 106h58M40 132h58" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M98 148h168a8 8 0 0 1 8 8v14H98z" className="fill-cream" />
      <path d="M98 170h176v22a8 8 0 0 1-8 8H106a8 8 0 0 1-8-8z" className="fill-sage/15" />
      <path d="M110 200v2M262 200v2" />
      <path d="M110 130h50a8 8 0 0 1 0 18h-50a8 8 0 0 1 0-18z" className="fill-terracotta/12" />
      <path d="M172 132h44a7 7 0 0 1 0 14h-44a7 7 0 0 1 0-14z" className="fill-cream" />
    </g>
  </>
);

const bunkBed = (
  <>
    <Floor cx={160} rx={128} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M54 74h170v18H54zM54 142h170v18H54z" className="fill-sage/15" />
      <path d="M54 74v128M224 74v128" />
      <path d="M54 142h170" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M74 74v-14h44v14M74 142v-14h44v14" className="fill-terracotta/12" />
      {/* ladder */}
      <path d="M242 92v70M264 92v70" />
      <path d="M242 114h22M242 138h22" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

const crib = (
  <>
    <Floor cx={160} rx={132} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M58 92h204v78H58z" className="fill-sage/10" />
      <path d="M80 92v78M102 92v78M124 92v78M146 92v78M168 92v78M190 92v78M212 92v78M234 92v78" strokeWidth={1.5} className="stroke-espresso/40" />
      <path d="M58 118h204" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M70 170v32M250 170v32" />
      <path d="M70 92V70M250 92V70M70 70h180" strokeWidth={2.5} className="stroke-espresso/40" />
      <path d="M120 88c14-10 34-10 48 0-14 8-34 8-48 0z" className="fill-terracotta/15" />
    </g>
  </>
);

const wardrobe = (
  <>
    <Floor cx={160} rx={130} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M62 48h196v154H62z" className="fill-sage/10" />
      <path d="M160 48v154" />
      <path d="M74 60h74v130H74zM172 60h74v130h-74z" className="fill-sage/12" />
      <path d="M150 118h8M162 118h8" className="stroke-espresso/45" />
      <path d="M96 84h30v60H96z" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M190 96h38v14h-38zM190 126h38v40h-38z" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M62 202h196" strokeWidth={1.5} className="stroke-espresso/25" />
    </g>
  </>
);

const cabinet = (
  <>
    <Floor cx={160} rx={128} />
    <Battens x={56} width={92} rows={2} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* drawer bank */}
      <path d="M56 72h92v130H56z" className="fill-sage/12" />
      <path d="M56 118h92M56 158h92" />
      <path d="M90 95h24M90 138h24M90 179h24" className="stroke-espresso/45" />
      {/* cupboard */}
      <path d="M168 52h96v150h-96z" className="fill-sage/10" />
      <path d="M216 52v150" />
      <path d="M178 62h28v130h-28zM226 62h28v130h-28z" className="fill-espresso/6" />
      <path d="M208 124h8M220 124h8" className="stroke-espresso/45" />
    </g>
  </>
);

const drawers = (
  <>
    <Floor cx={160} rx={126} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M72 58h176v144H72z" className="fill-sage/12" />
      <path d="M72 94h176M72 130h176M72 166h176" />
      <path d="M140 76h40M140 112h40M140 148h40M140 184h40" className="stroke-espresso/40" />
      <path d="M72 202h176" strokeWidth={2} className="stroke-espresso/25" />
      {/* a second, narrower stack behind for depth */}
      <path d="M248 58v144M262 58v144" strokeWidth={1.5} className="stroke-espresso/45" />
    </g>
  </>
);

const bookshelf = (
  <>
    <Floor cx={160} rx={132} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M48 44h224v158H48z" className="fill-sage/10" />
      <path d="M48 84h224M48 124h224M48 164h224" />
      <g strokeWidth={1.5} className="stroke-espresso/40">
        <path d="M62 84V62h12v22M80 84V68h11v16M97 84V56h12v28M115 84V70h10v14" />
        <path d="M62 124v-24h14v24M84 124v-16h12v16M104 124v-28h13v28" />
        <path d="M160 164v-22h40v22zM180 142v-8M186 142v-12" />
        <path d="M214 84V66h14v18" />
      </g>
    </g>
  </>
);

const desk = (
  <>
    <Floor cx={160} rx={132} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M48 136h224a8 8 0 0 1 8 8v8H40v-8a8 8 0 0 1 8-8z" className="fill-sage/12" />
      <path d="M58 152v50M262 152v50" />
      <path d="M58 176h204" strokeWidth={1.5} className="stroke-espresso/30" />
      {/* monitor */}
      <path d="M96 136v-20h64v20" className="fill-espresso/8" />
      <path d="M110 124h36M110 132h24" strokeWidth={1.5} className="stroke-espresso/35" />
      {/* drawer */}
      <path d="M190 130h44v6h-44z" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

const smallDesk = (
  <>
    <Floor cx={160} rx={122} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M72 132h176a8 8 0 0 1 8 8v10H64v-10a8 8 0 0 1 8-8z" className="fill-sage/12" />
      <path d="M82 150v52M238 150v52" />
      <path d="M82 178h156" strokeWidth={1.5} className="stroke-espresso/30" />
      {/* pencil pot and a small stack of books */}
      <path d="M118 132v-18h48v18" className="fill-espresso/6" />
      <path d="M130 124h24" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M92 132v-10h10v10M224 122h16v10h-16z" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M96 118h8" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

const coffeeTable = (
  <>
    <Floor cx={160} rx={134} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M60 126h200a8 8 0 0 1 8 8v10H52v-10a8 8 0 0 1 8-8z" className="fill-sage/15" />
      <path d="M70 144v58M250 144v58" />
      <path d="M70 176h180" strokeWidth={1.5} className="stroke-espresso/30" />
      {/* lower shelf with a stacked pair of books */}
      <path d="M112 176h96" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M124 168h40v8h-40zM120 158h48v8h-48z" className="fill-terracotta/12" />
      {/* a bowl on top */}
      <path d="M148 120h30a15 15 0 0 1-30 0z" className="fill-terracotta/15" />
    </g>
  </>
);

const sideTable = (
  <>
    <Floor cx={160} rx={120} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M74 112h172a8 8 0 0 1 8 8v10H66v-10a8 8 0 0 1 8-8z" className="fill-sage/15" />
      <path d="M84 130v72M236 130v72" />
      <path d="M84 168h152" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M132 130v-22h56v22" className="fill-espresso/6" />
      {/* a lamp on top */}
      <path d="M150 108v-12a10 10 0 0 1 10-10h0a10 10 0 0 1 10 10v12" className="fill-terracotta/12" />
      <path d="M160 96v12" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

const mirror = (
  <>
    <Floor cx={150} rx={128} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* frame and panel */}
      <path d="M76 62h108v140H76z" className="fill-sage/12" />
      <path d="M92 78h76v108H92z" className="fill-espresso/6" />
      <path d="M104 96l40 46M104 118l54 62" strokeWidth={1.5} className="stroke-espresso/20" />
      {/* feet */}
      <path d="M64 202h52M144 202h52" />
    </g>
    {/* a low bench with a vase beside it */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/70">
      <path d="M206 168h66v10h-66z" className="fill-terracotta/12" />
      <path d="M214 178v24M264 178v24" />
      <path d="M228 168v-24h16v24z" className="fill-sage/15" />
      <path d="M236 144c-8-10-4-20 0-26 4 6 8 16 0 26z" className="fill-sage/20" />
    </g>
  </>
);

const diningTableSet = (
  <>
    <Floor cx={160} rx={142} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* table */}
      <path d="M70 124h180a8 8 0 0 1 8 8v10H62v-10a8 8 0 0 1 8-8z" className="fill-sage/12" />
      <path d="M84 142v60M236 142v60" />
      <path d="M84 174h152" strokeWidth={1.5} className="stroke-espresso/30" />
      {/* two place settings */}
      <g strokeWidth={1.5} className="stroke-espresso/55">
        <circle cx="112" cy="118" r="15" className="fill-cream" />
        <circle cx="112" cy="118" r="7" />
        <path d="M136 108v20M144 108v20" />
        <circle cx="208" cy="118" r="15" className="fill-cream" />
        <circle cx="208" cy="118" r="7" />
        <path d="M232 108v20M240 108v20" />
      </g>
    </g>
    {/* chairs at each end */}
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M30 152h34v10H30zM22 152v-30h9v30M55 152v-30h9v30" className="fill-espresso/8" />
      <path d="M34 162v40M58 162v40" />
      <path d="M256 152h34v10h-34zM248 152v-30h9v30M281 152v-30h9v30" className="fill-espresso/8" />
      <path d="M260 162v40M284 162v40" />
    </g>
  </>
);

const island = (
  <>
    <Floor cx={160} rx={134} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      <path d="M50 124h220a8 8 0 0 1 8 8v12H42v-12a8 8 0 0 1 8-8z" className="fill-sage/15" />
      <path d="M50 144h220v50a8 8 0 0 1-8 8H58a8 8 0 0 1-8-8z" className="fill-sage/10" />
      <path d="M58 158h62v20H58zM132 158h62v20h-62zM206 158h56v20h-56z" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M89 158v20M163 158v20M234 158v20" strokeWidth={1.5} className="stroke-espresso/35" />
      {/* a pan on the worktop */}
      <path d="M146 116h34a6 6 0 0 1-6 8h-22a6 6 0 0 1-6-8z" className="fill-terracotta/12" />
      <path d="M180 118h16" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
  </>
);

const bench = (
  <>
    <Floor cx={160} rx={132} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* slatted back */}
      <path d="M104 106h112v10H104z" className="fill-sage/10" />
      <path d="M112 122h96v10h-96zM112 140h96v10h-96z" className="fill-sage/12" />
      {/* seat */}
      <path d="M96 158h128v12H96z" className="fill-sage/15" />
      {/* legs and stretchers */}
      <path d="M78 170v32M242 170v32" />
      <path d="M104 158v12M216 158v12" />
      <path d="M96 186h128" strokeWidth={1.5} className="stroke-espresso/30" />
    </g>
  </>
);

const stool = (
  <>
    <Floor cx={160} rx={114} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* splayed legs */}
      <path d="M112 140l-10 62M208 140l10 62" />
      <path d="M116 168h88" strokeWidth={1.5} className="stroke-espresso/40" />
      {/* foot rail */}
      <path d="M106 178h108" strokeWidth={1.5} className="stroke-espresso/40" />
      {/* saddle seat */}
      <path d="M92 118h136a12 12 0 0 1 12 12v12H80v-12a12 12 0 0 1 12-12z" className="fill-terracotta/12" />
      <path d="M96 142h128" strokeWidth={1.5} className="stroke-espresso/30" />
    </g>
  </>
);

const tvStand = (
  <>
    <Floor cx={160} rx={130} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* screen */}
      <path d="M96 50h128v78H96z" className="fill-espresso/6" />
      <path d="M104 58h112v62H104z" strokeWidth={1.5} className="stroke-espresso/30" />
      <path d="M158 128v10M142 138h34" className="stroke-espresso/50" />
      {/* cabinet */}
      <path d="M52 142h216a8 8 0 0 1 8 8v10H44v-10a8 8 0 0 1 8-8z" className="fill-sage/15" />
      <path d="M56 160v42M264 160v42" />
      <path d="M96 160h56v18H96zM168 160h56v18h-56z" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M124 160v18M196 160v18" strokeWidth={1.5} className="stroke-espresso/35" />
    </g>
  </>
);

const toyStorage = (
  <>
    <Floor cx={160} rx={128} />
    <g strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-espresso/75">
      {/* chest with a lid */}
      <path d="M56 96h208v46H56z" className="fill-terracotta/12" />
      <path d="M52 84h216v12H52z" className="fill-sage/15" />
      <path d="M70 120h60v10H70zM146 120h60v10h-60z" strokeWidth={1.5} className="stroke-espresso/35" />
      <path d="M56 142v34M264 142v34" />
      {/* crates below */}
      <path d="M60 176h40v26H60zM112 182h36v20h-36zM160 172h44v30h-44zM216 186h40v16h-40z" className="fill-terracotta/10" />
      <path d="M172 172v-8M180 172v-6" strokeWidth={1.5} className="stroke-espresso/40" />
    </g>
    {/* a ball */}
    <circle
      cx="98"
      cy="62"
      r="11"
      strokeWidth={2.5}
      className="fill-terracotta/15 stroke-espresso/50"
    />
  </>
);

/* ------------------------------------------------------------- registry */

/**
 * Every drawing, keyed by the slug that reaches the hero.
 *
 * A key is either a department slug (`living-room`) or a sub-category slug
 * (`sofas`). Both taxonomies in the project - the `subcategories` table and the
 * groups in `src/lib/navigation.ts` - reach the same hero, and the table's
 * slugs are a subset of the navigation ones, so this single map covers both.
 *
 * `ILLUSTRATIONS` holds department and category-level drawings; `SUB_ART` holds
 * the sub-category ones. They are kept apart because a sub-category slug can
 * appear under more than one department (`armchairs` is both living-room and
 * chairs & seating), and the registry resolves the parent first.
 */
const SUB_ART: Record<string, ReactNode> = {
  /* seating */
  sofas: sofa,
  "sectional-l-shaped-couches": sofa,
  armchairs: armchair,
  "lounge-chairs": armchair,
  "reading-chairs": armchair,
  "childrens-chairs": armchair,
  "dining-chairs": diningChair,
  "office-chairs": diningChair,
  "conference-chairs": diningChair,
  "outdoor-chairs": diningChair,
  "outdoor-sofas": sofa,

  /* sleeping */
  "beds-bed-frames": bed,
  headboards: bed,
  "custom-beds": bed,
  "childrens-beds": crib,
  crib,
  "bunk-beds": bunkBed,

  /* storage */
  wardrobes: wardrobe,
  "custom-wardrobes": wardrobe,
  cabinets: cabinet,
  "custom-cabinets": cabinet,
  "kitchen-cabinets": cabinet,
  "pantry-storage": cabinet,
  "outdoor-storage": cabinet,
  "display-cabinets": cabinet,
  "sideboards-buffets": cabinet,
  "chest-of-drawers": drawers,
  "dressing-tables": drawers,
  "filing-cabinets": drawers,
  bookshelves: bookshelf,
  "kitchen-shelves": bookshelf,
  "shelving-units": bookshelf,
  "storage-benches": bench,

  /* desks and tables */
  "office-desks": desk,
  "executive-desks": desk,
  "computer-desks": desk,
  "reception-desks": desk,
  "custom-desks": desk,
  "study-desks": smallDesk,
  "coffee-tables": coffeeTable,
  "breakfast-tables": coffeeTable,
  "bedside-tables": sideTable,
  "side-console-tables": sideTable,
  "dining-tables": diningTableSet,
  "dining-sets": diningTableSet,
  "bar-tables": diningTableSet,
  "custom-tables": diningTableSet,
  "outdoor-tables": diningTableSet,
  "picnic-tables": diningTableSet,
  "patio-furniture": diningTableSet,
  "meeting-tables": diningTableSet,
  "kitchen-islands": island,
  mirrors: mirror,

  /* seating-shaped odds and ends */
  benches: bench,
  "bedroom-benches": bench,
  "garden-benches": bench,
  "wooden-loungers": bench,
  "bar-stools": stool,
  "kitchen-stools": stool,
  "tv-stands": tvStand,
  "tv-stands-units": tvStand,
  "toy-storage": toyStorage,
  "custom-sofas": sofa,
  "made-to-measure-furniture": workshop,
};

/**
 * Which department a sub-category belongs to.
 *
 * This is the safety net for sub-category pages: `resolveIllustration` prefers
 * the parent's own drawing, and this map covers the case where a page is handed
 * a bare sub-category slug with no parent context. It also means a sub-category
 * added tomorrow lands on its department drawing rather than the generic one.
 */
export const SUBCATEGORY_DEPARTMENT: Record<string, string> = {
  // living room
  sofas: "living-room",
  "sectional-l-shaped-couches": "living-room",
  armchairs: "living-room",
  "coffee-tables": "living-room",
  "tv-stands": "living-room",
  "tv-stands-units": "living-room",
  "side-console-tables": "living-room",
  "display-cabinets": "living-room",

  // bedroom
  "beds-bed-frames": "bedroom",
  headboards: "bedroom",
  mirrors: "bedroom",
  wardrobes: "bedroom",
  "bedside-tables": "bedroom",
  "dressing-tables": "bedroom",
  "chest-of-drawers": "bedroom",
  "bedroom-benches": "bedroom",

  // office
  "office-desks": "office",
  "executive-desks": "office",
  "computer-desks": "office",
  "office-chairs": "office",
  "reception-desks": "office",
  "meeting-tables": "office",
  "conference-chairs": "office",
  "filing-cabinets": "office",

  // dining room
  "dining-tables": "dining-room",
  "dining-chairs": "dining-room",
  "dining-sets": "dining-room",
  "sideboards-buffets": "dining-room",
  "bar-tables": "dining-room",
  "bar-stools": "dining-room",

  // kitchen
  "kitchen-cabinets": "kitchen",
  "kitchen-islands": "kitchen",
  "pantry-storage": "kitchen",
  "kitchen-shelves": "kitchen",
  "breakfast-tables": "kitchen",
  "kitchen-stools": "kitchen",

  // outdoor
  "outdoor-tables": "outdoor",
  "outdoor-chairs": "outdoor",
  "outdoor-sofas": "outdoor",
  "wooden-loungers": "outdoor",
  "garden-benches": "outdoor",
  "patio-furniture": "outdoor",
  "picnic-tables": "outdoor",
  "outdoor-storage": "outdoor",

  // chairs & seating
  "reading-chairs": "chairs-seating",
  benches: "chairs-seating",
  "lounge-chairs": "chairs-seating",

  // storage & shelving
  cabinets: "storage-shelving",
  bookshelves: "storage-shelving",
  "shelving-units": "storage-shelving",
  "storage-benches": "storage-shelving",

  // kids & nursery
  "childrens-beds": "kids-nursery",
  crib: "kids-nursery",
  "bunk-beds": "kids-nursery",
  "childrens-chairs": "kids-nursery",
  "study-desks": "kids-nursery",
  "toy-storage": "kids-nursery",

  // custom furniture
  "custom-beds": "custom-furniture",
  "custom-wardrobes": "custom-furniture",
  "custom-tables": "custom-furniture",
  "custom-desks": "custom-furniture",
  "custom-cabinets": "custom-furniture",
  "custom-sofas": "custom-furniture",
  "made-to-measure-furniture": "custom-furniture",
};

/** Department-level drawings, keyed by category slug. */
export const ILLUSTRATIONS: Record<string, ReactNode> = {
  "living-room": livingRoom,
  bedroom,
  office,
  "dining-room": diningRoom,
  kitchen,
  outdoor,
  "chairs-seating": chairsSeating,
  "storage-shelving": storageShelving,
  "kids-nursery": kidsNursery,
  "custom-furniture": customFurniture,
};

/**
 * Resolve the drawing for a hero.
 *
 * Resolution order, first hit wins:
 *
 * 1. the sub-category slug,
 * 2. the parent category's drawing,
 * 3. the sub-category's department, via `SUBCATEGORY_DEPARTMENT`,
 * 4. the generic workshop drawing.
 *
 * Passing the parent first means a slug that appears under two departments gets
 * the drawing for the page it is actually on, while an unknown or newly added
 * category still lands on a drawing rather than an empty card.
 */
export function resolveIllustration(
  slug?: string | null,
  parentSlug?: string | null,
): ReactNode {
  const key = (slug ?? "").trim().toLowerCase();
  const parent = (parentSlug ?? "").trim().toLowerCase();

  if (key && SUB_ART[key]) return SUB_ART[key];
  if (parent && ILLUSTRATIONS[parent]) return ILLUSTRATIONS[parent];
  if (key && ILLUSTRATIONS[key]) return ILLUSTRATIONS[key];

  const department = SUBCATEGORY_DEPARTMENT[key];
  if (department && ILLUSTRATIONS[department]) return ILLUSTRATIONS[department];

  return workshop;
}