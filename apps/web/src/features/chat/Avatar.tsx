const PALETTE = [
  '#0e7490',
  '#7c3aed',
  '#c2410c',
  '#15803d',
  '#be185d',
  '#1d4ed8',
  '#a16207',
  '#4338ca',
];

/** Iniciales de nombre y primer apellido: "Ana Martínez" → "AM". */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Mismo color para la misma persona en cualquier pantalla, sin guardarlo en ningún lado. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({
  id,
  fullName,
  size = 36,
}: {
  id: string;
  fullName: string;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        background: avatarColor(id),
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
    >
      {initials(fullName)}
    </span>
  );
}
