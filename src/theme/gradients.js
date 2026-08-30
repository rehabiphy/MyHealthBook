/* One gradient, used on every primary action and active state.
   135deg in CSS ≈ start top-left, end bottom-right in RN terms. */
export const GRAD = {
  colors: ['#A78BFA', '#EC7FD0'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const GRAD_SOFT = {
  colors: ['rgba(167,139,250,0.30)', 'rgba(236,127,208,0.22)'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const GRAD_MINT = {
  colors: ['#4ADE80', '#22B8A6'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/* 170deg — the near-vertical backdrop used behind full-screen sheets
   (Report, Family). */
export const GRAD_SHEET = {
  colors: ['#3B1E8F', '#2B1B63', '#1E1B4B'],
  locations: [0, 0.55, 1],
  start: { x: 0.15, y: 0 },
  end: { x: 0.85, y: 1 },
};
