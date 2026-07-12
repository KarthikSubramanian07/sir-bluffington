interface MascotProps {
  size?: number;
  /** Simplified line weight for small seat avatars. */
  compact?: boolean;
  title?: string;
}

/**
 * Sir Bluffington — a monocled gentleman card-sharp rendered as gold line-art on dark.
 * The brand's signature element (spec Section 07): the felt and the monocle carry the
 * personality; everything else stays quiet.
 */
export function Mascot({ size = 120, compact = false, title = "Sir Bluffington" }: MascotProps) {
  const sw = compact ? 3 : 2.4;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 128"
      role="img"
      aria-label={title}
      style={{ display: "block" }}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id="mascot-face" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#1f2a22" />
          <stop offset="100%" stopColor="#121a14" />
        </radialGradient>
      </defs>

      {/* head */}
      <circle
        cx="60"
        cy="66"
        r="34"
        fill="url(#mascot-face)"
        stroke="var(--gold)"
        strokeWidth={sw}
      />

      {/* top hat */}
      <g fill="none" stroke="var(--gold)" strokeWidth={sw} strokeLinejoin="round">
        <path d="M30 40 Q60 30 90 40" strokeLinecap="round" />
        <path d="M39 40 L41 16 Q60 10 79 16 L81 40" fill="#0f1712" />
        {/* hatband + tiny spade pip */}
        <path d="M40 30 Q60 25 80 30" stroke="var(--gold-dim)" />
      </g>
      <path
        d="M60 20c0 0-4 4-4 6a4 4 0 0 0 3 2c-.2 1-.6 2-1 2.4h4c-.4-.4-.8-1.4-1-2.4a4 4 0 0 0 3-2c0-2-4-6-4-6z"
        fill="var(--gold)"
        opacity="0.9"
      />

      {/* left eye */}
      <circle cx="48" cy="62" r="2.4" fill="var(--gold-bright)" />

      {/* monocle over right eye + chain */}
      <circle cx="73" cy="62" r="9" fill="none" stroke="var(--gold)" strokeWidth={sw} />
      <circle cx="73" cy="62" r="2.4" fill="var(--gold-bright)" />
      <path
        d="M79 68 q5 4 3 12"
        fill="none"
        stroke="var(--gold)"
        strokeWidth={sw * 0.8}
        strokeLinecap="round"
      />

      {/* mustache */}
      <path
        d="M60 80 q-8 6 -16 2 q6 6 16 3 q10 3 16 -3 q-8 4 -16 -2z"
        fill="var(--gold)"
        opacity="0.92"
      />

      {/* bow tie */}
      <path
        d="M60 100 l-11 -5 v10 z M60 100 l11 -5 v10 z"
        fill="var(--gold-dim)"
        stroke="var(--gold)"
        strokeWidth={sw * 0.7}
        strokeLinejoin="round"
      />
      <circle cx="60" cy="100" r="2.4" fill="var(--gold)" />
    </svg>
  );
}
