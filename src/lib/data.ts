/**
 * Editorial content for the marketing pages. Kept out of components so copy
 * changes never require touching layout or animation code.
 */

/* ------------------------------------------------------------- hardwoods */
export type Timber = { name: string; species: string; hardness: number; tone: string; use: string };

export const TIMBERS: Timber[] = [
  { name: "White Oak", species: "Quercus alba", hardness: 7, tone: "Warm honey", use: "Tables, floors, casework" },
  { name: "Walnut", species: "Juglans nigra", hardness: 6, tone: "Deep umber", use: "Cabinets, seating, veneer" },
  { name: "Cherry", species: "Prunus serotina", hardness: 6, tone: "Red-amber", use: "Dining, built-ins" },
  { name: "Ash", species: "Fraxinus americana", hardness: 7, tone: "Pale blond", use: "Bentwood, handles" },
  { name: "Teak", species: "Tectona grandis", hardness: 6, tone: "Golden brown", use: "Outdoor, wet rooms" },
  { name: "Blackened Oak", species: "Quercus, fumed", hardness: 7, tone: "Charcoal", use: "Statement, cladding" },
];

/* -------------------------------------------------------------- services */
export type Service = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  points: string[];
};

export const SERVICES: Service[] = [
  {
    id: "custom-builds",
    title: "Custom Furniture",
    summary: "One-offs built to your room, not to a catalogue page.",
    detail:
      "Send us a sketch, a photo of an awkward corner, or the chair your grandmother had. We draw it in 3D, agree the timber and the price, then build one. Nothing is moulded twice.",
    points: ["3D drawings before we cut", "Solid hardwood, no veneer faces", "Hand-cut joinery, no flat-pack", "Ten-year frame guarantee"],
  },
  {
    id: "millwork",
    title: "Millwork & Built-ins",
    summary: "Wall units, libraries and kitchens that fit the wall they live on.",
    detail:
      "We site-measure, then build to the millimetre. Alcove shelving, full-wall libraries, wardrobe runs and kitchen joinery - all scribed in on the day so nothing is a generic box.",
    points: ["On-site measure and template", "Scribed to uneven walls", "Solid or veneered face", "Coordinated with your flooring"],
  },
  {
    id: "timber",
    title: "Timber Supply",
    summary: "Kiln-dried hardwood, graded and cut to your list.",
    detail:
      "We buy standing and fallen timber from managed woodland within 300km, kiln-dry it ourselves, and sell it board by board. Full grading reports, moisture readings and end-sealed bundles.",
    points: ["Kiln-dried to 8-12%", "FSC and PEFC paperwork", "Cut to your dimensions", "Small trade quantities welcome"],
  },
  {
    id: "restoration",
    title: "Restoration & Repair",
    summary: "Bring back the piece you already own.",
    detail:
      "Broken joints, sagged seats, stripped varnish. We re-cut the failed tenon, re-can the springs, and re-finish in hardwax oil - usually for less than a new piece of the same thing.",
    points: ["Structural repairs first", "Spring and webbing replacement", "Varnish stripped, oil reapplied", "Honest assessment, free of charge"],
  },
  {
    id: "finishing",
    title: "Finishing & Installation",
    summary: "The last ten percent, done properly on your floor.",
    detail:
      "Hardwax oil, hand-rubbed and cut back between coats. We deliver, carry in, assemble, and take the packaging away - including levelling on uneven floors.",
    points: ["Hardwax oil, three coats", "Hand-rubbed and cut back", "Room-of-choice delivery", "Packaging taken away"],
  },
  {
    id: "trade",
    title: "Trade & Contract",
    summary: "For architects, interior designers and hospitality groups.",
    detail:
      "We work to drawings, to schedules and to a deadline. Prototype pieces, batch production, and site marking so installation on a live project stays on programme.",
    points: ["Working to your drawings", "Prototype before production", "Batch and repeat orders", "Site marking and install support"],
  },
];

/* -------------------------------------------------------------- projects */
export type Project = {
  title: string;
  client: string;
  year: string;
  scope: string;
  timber: string;
  blurb: string;
};

export const PROJECTS: Project[] = [
  {
    title: "Ashfield House Library",
    client: "Private residence",
    year: "2025",
    scope: "Full-wall library, reading chair, desk",
    timber: "White Oak + Walnut",
    blurb:
      "A 1930s manor with plaster that curved in places. We templated every shelf upright off the wall itself and scribed the carcase so the joinery disappeared into the room.",
  },
  {
    title: "Kastrup Coffee Bar",
    client: "Hospitality, Musanze",
    year: "2025",
    scope: "Counter, banquette, 14 tables",
    timber: "Blackened Oak",
    blurb:
      "Fumed oak left deliberately dark so the room reads as one surface. The banquette runs the full 22 metres without a single support column interrupting a seat.",
  },
  {
    title: "Ridgeway Cabin",
    client: "Retreat, Vermont",
    year: "2024",
    scope: "Beds, wardrobe, window seats",
    timber: "Cherry + Ash",
    blurb:
      "A four-season off-grid build. Every frame is knock-down so it could pass through a standard doorway, and every fixing is a single brass screw you own.",
  },
  {
    title: "Marlow & Sons Workshop",
    client: "Commercial fit-out",
    year: "2024",
    scope: "Workbenches, tool wall, mezzanine",
    timber: "Ash",
    blurb:
      "Bent ash carries the mezzanine load while still reading as light. The tool wall is 4mm ply over a solid frame - indestructible, and it takes a new layout every year.",
  },
  {
    title: "The Alcove Apartments",
    client: "Developer, 9 units",
    year: "2023",
    scope: "Kitchens and wardrobes ×9",
    timber: "Walnut veneer on Ash",
    blurb:
      "Nine identical kitchens with nine different problems. We built a jig, not a kitchen - the budget went into the tooling so the nine units came in under a third of custom pricing.",
  },
  {
    title: "Beekeeper's Bench",
    client: "Private commission",
    year: "2023",
    scope: "Single bench, lifetime guarantee",
    timber: "Salvaged Elm",
    blurb:
      "Windthrown elm from a felled hedgerow. We kept the knots, the saw marks and one split, filled with black epoxy. It is the only piece we have never wanted to replace.",
  },
];

/* -------------------------------------------------------- process + values */
export const PROCESS = [
  { step: "01", title: "Conversation", body: "A call or a visit. We measure the room, talk about how you'll actually use it, and tell you honestly if your idea will not work in the timber." },
  { step: "02", title: "Drawing", body: "Sketches, then 3D drawings with real dimensions and a fixed price. You sign off before a single board is cut." },
  { step: "03", title: "Timber selection", body: "We lay out every board and show you the grain, the figure and the colour it will age to. You choose." },
  { step: "04", title: "Build", body: "Cut, joined, carved and fitted by hand in the workshop. We send progress photographs at each stage." },
  { step: "05", title: "Finishing", body: "Hardwax oil rubbed in by hand, cut back between coats, then a final wax. It can be spot-repaired for life." },
  { step: "06", title: "Installation", body: "Delivered to the room, assembled, levelled, packaging taken away. Nothing left but the furniture." },
];

export const VALUES = [
  { title: "One tree, one piece", body: "We buy standing timber from managed woodland within 300km and air-dry it on our own racks. Every board is traceable to the tree it came from." },
  { title: "Joinery, not hardware", body: "Draw-bored mortise and tenon, wedged through-tenons, hand-cut dovetails. Glue does the rest. A joint we could make can be a joint we can fix." },
  { title: "Repairable finishes", body: "Hardwax oil, never lacquer or film. Scratches sand back and re-oil in an afternoon, in your kitchen, without us." },
  { title: "Made to be moved", body: "Knock-down where the size demands it, so a house move is a two-person job rather than a removal quote." },
];

export const STATS = [
  { k: "2019", v: "Workshop opened" },
  { k: "11", v: "Makers on the floor" },
  { k: "300km", v: "Timber radius" },
  { k: "0", v: "Milled offcuts to landfill" },
];
