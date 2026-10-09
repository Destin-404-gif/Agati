/**
 * The decorative panel behind the sign-in form.
 *
 * Generated rather than photographed so it scales cleanly, costs no bytes on
 * disk and needs no admin slot. It is drawn from the same palette as the rest
 * of the brand, and it is `aria-hidden` - it carries no information the heading
 * does not already carry.
 *
 * The shapes are a woodwork motif: stacked boards, a saw-blade arc, and a
 * growth-ring pattern.
 */
export function AuthArtwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id="auth-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a2f24" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#241c14" stopOpacity="0" />
        </linearGradient>

        <radialGradient id="auth-ring" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#241c14" stopOpacity="0" />
          <stop offset="70%" stopColor="#c77b5d" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#241c14" stopOpacity="0" />
        </radialGradient>

        <pattern
          id="auth-grain"
          width="8"
          height="120"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M4 0 C 7 30, 1 90, 4 120"
            fill="none"
            stroke="#f1ece1"
            strokeOpacity="0.05"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect width="800" height="1000" fill="#241c14" />
      <rect width="800" height="1000" fill="url(#auth-glow)" />
      <rect width="800" height="1000" fill="url(#auth-grain)" />

      {/* Growth rings, bottom left. */}
      <g>
        {[120, 180, 244, 312, 386].map((r) => (
          <circle
            key={r}
            cx="120"
            cy="880"
            r={r}
            fill="none"
            stroke="#c77b5d"
            strokeOpacity="0.12"
            strokeWidth="1.5"
          />
        ))}
        <circle cx="120" cy="880" r="330" fill="url(#auth-ring)" />
      </g>

      {/* Stacked boards, upper right - the plank ends of a drying rack. */}
      <g transform="translate(430 90) rotate(-8)">
        {[0, 34, 68, 102, 136, 170].map((y, i) => (
          <rect
            key={y}
            x={i % 2 === 0 ? 0 : 14}
            y={y}
            width="330"
            height="24"
            rx="6"
            fill="#3a2f24"
            stroke="#f1ece1"
            strokeOpacity="0.07"
          />
        ))}
      </g>

      {/* Saw-blade arc, threading the two motifs together. */}
      <g transform="translate(500 640)">
        <circle
          r="150"
          fill="none"
          stroke="#f1ece1"
          strokeOpacity="0.1"
          strokeWidth="1"
          strokeDasharray="3 9"
        />
        <path
          d="M -150 0 A 150 150 0 0 1 150 0"
          fill="none"
          stroke="#c77b5d"
          strokeOpacity="0.3"
          strokeWidth="2"
        />
        {/* Teeth. */}
        {Array.from({ length: 24 }, (_, i) => {
          const angle = (i / 24) * Math.PI;
          const x = -150 * Math.cos(angle);
          const y = -150 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x * 0.94}
              y2={y * 0.94}
              stroke="#c77b5d"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
          );
        })}
      </g>
    </svg>
  );
}