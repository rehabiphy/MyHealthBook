/* One gradient, used on every primary action and active state.
   135deg in CSS ≈ start top-left, end bottom-right in RN terms. */
export const GRAD = {
  colors: ['#4ADE80', '#16A34A'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const GRAD_SOFT = {
  colors: ['rgba(74,222,128,0.30)', 'rgba(22,163,74,0.22)'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const GRAD_MINT = {
  colors: ['#4ADE80', '#22B8A6'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/* 170deg — the near-vertical backdrop used behind full-screen sheets
   (Report, Family). Same soft mint-to-cream family as AmbientBackground. */
export const GRAD_SHEET = {
  colors: ['#CDEFDD', '#DCEEE3', '#F3F1E7'],
  locations: [0, 0.55, 1],
  start: { x: 0.15, y: 0 },
  end: { x: 0.85, y: 1 },
};
