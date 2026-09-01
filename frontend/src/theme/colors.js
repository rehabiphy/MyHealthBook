/* ══════════════════════════════════════════════════════════════════
   MyHealthBook — a home vitals record.
   Light theme: soft mint-to-cream ground, white cards, one green
   voice carrying every primary action. Mono set for every unit and
   timestamp the way it's printed on a monitor. Colour never
   decorates; it only ever states a range.
══════════════════════════════════════════════════════════════════ */

export const C = {
  paper: '#F4F8F6', // near-neutral ground (AmbientBackground layers soft green glows on top)
  card: 'rgba(255,255,255,0.2)', // neutral frosted glass — real blur (see Card.jsx) does the "glass" work, this is just a light wash, not a tint
  cardSolid: '#FFFFFF', // where glass must not stack
  panel: 'rgba(255,255,255,0.92)', // raised glass, near-opaque
  panelSoft: 'rgba(34,197,94,0.14)', // accent-tinted glass, for small highlight banners only — never the main card surface
  ink: '#16241C', // near-black warm charcoal — primary text
  ink2: 'rgba(22,36,28,0.78)', // body copy
  ink3: 'rgba(22,36,28,0.62)', // captions/labels/timestamps
  hair: 'rgba(22,36,28,0.12)',
  onPanel: '#16241C',
  onPanel2: 'rgba(22,36,28,0.75)',
  brand: '#22C55E', // green — the app's voice
  brand2: '#16A34A', // deeper green, the far end of every gradient
  mint: '#4ADE80',
  // Status colours read as text/dots on white cards, so they're
  // deepened from the original dark-theme pastels (which were tuned
  // to pop against a dark violet ground and would read as too faint
  // — an emergency-red at low contrast is a real legibility problem).
  low: '#3B82F6',
  normal: '#16A34A',
  elevated: '#D97706',
  stage1: '#EA580C',
  stage2: '#E11D48',
  crisis: '#BE123C',
};
