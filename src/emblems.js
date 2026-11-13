const marks = {
  flower: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="6" fill="#f4efe4"/><g fill="#c23b4a"><ellipse cx="32" cy="14" rx="7" ry="12"/><ellipse cx="32" cy="50" rx="7" ry="12"/><ellipse cx="14" cy="32" rx="12" ry="7"/><ellipse cx="50" cy="32" rx="12" ry="7"/></g></svg>`,
  baseball: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="18" fill="#f4efe4"/><path d="M18 22c6 4 6 16 0 20M46 22c-6 4-6 16 0 20" fill="none" stroke="#b22234" stroke-width="2"/><path d="M16 26h4M15 32h5M16 38h4M44 26h4M44 32h5M44 38h4" stroke="#b22234" stroke-width="1.4"/></svg>`,
  football: `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="32" rx="20" ry="12" fill="#8a5a32" transform="rotate(-28 32 32)"/><path d="M26 30h12M32 24v12" stroke="#f4efe4" stroke-width="1.6"/></svg>`,
  basketball: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="18" fill="#d06a2b"/><path d="M14 32h36M32 14v36M18 18c8 6 20 6 28 0M18 46c8-6 20-6 28 0" fill="none" stroke="#3a2012" stroke-width="1.4"/></svg>`,
  mountain: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 52 L24 18 L34 36 L44 22 L58 52 Z" fill="#d9d3c6"/><path d="M24 18 L29 30 L20 30 Z" fill="#f4efe4"/></svg>`,
  rushmore: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 54 L8 28 H56 L60 54 Z" fill="#b7aa96"/><circle cx="16" cy="34" r="4" fill="#8d8272"/><circle cx="28" cy="32" r="4.5" fill="#8d8272"/><circle cx="40" cy="33" r="4" fill="#8d8272"/><circle cx="50" cy="35" r="3.5" fill="#8d8272"/></svg>`,
  arch: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 54 V28 a14 14 0 0 1 28 0 V54" fill="none" stroke="#f4efe4" stroke-width="6"/></svg>`,
  star: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 L38 24 H56 L42 34 L47 52 L32 42 L17 52 L22 34 L8 24 H26 Z" fill="#f4efe4"/></svg>`,
  lighthouse: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M26 54 L28 24 H36 L38 54 Z" fill="#f4efe4"/><rect x="24" y="16" width="16" height="8" fill="#c23b4a"/><path d="M18 20 H46" stroke="#f4efe4" stroke-width="2"/></svg>`,
  bridge: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 40 H58" stroke="#f4efe4" stroke-width="3"/><path d="M10 40 V28 M32 40 V18 M54 40 V28" stroke="#c23b4a" stroke-width="3"/><path d="M10 28 Q32 8 54 28" fill="none" stroke="#f4efe4" stroke-width="2"/></svg>`,
  cactus: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="28" y="16" width="8" height="36" rx="4" fill="#2f6b45"/><rect x="16" y="26" width="8" height="16" rx="4" fill="#2f6b45"/><rect x="40" y="22" width="8" height="14" rx="4" fill="#2f6b45"/></svg>`,
  wave: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 36 Q16 24 26 36 T46 36 T62 30" fill="none" stroke="#8eb4d4" stroke-width="3"/><path d="M6 46 Q16 34 26 46 T46 46 T62 40" fill="none" stroke="#f4efe4" stroke-width="3"/></svg>`,
  bell: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 26 a12 12 0 0 1 24 0 V40 H20 Z" fill="#d6c7a1"/><rect x="18" y="40" width="28" height="4" fill="#f4efe4"/><circle cx="32" cy="48" r="3" fill="#c23b4a"/></svg>`,
  pine: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 L46 28 H38 L50 44 H14 L26 28 H18 Z" fill="#1f4d34"/><rect x="29" y="44" width="6" height="10" fill="#8a5a32"/></svg>`,
  canyon: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 18 H24 L32 54 L40 18 H60 V54 H4 Z" fill="#a24b3a"/><path d="M24 18 L32 54 L40 18" fill="#e7c07a"/></svg>`,
};

const places = {
  AL: ["flower", "Camellia", "Gulf Coast"],
  AK: ["mountain", "Forget-me-not", "Denali"],
  AZ: ["canyon", "Saguaro blossom", "Grand Canyon"],
  AR: ["mountain", "Apple blossom", "Ozarks"],
  CA: ["bridge", "Poppy", "Golden Gate"],
  CO: ["mountain", "Columbine", "Rockies"],
  CT: ["wave", "Mountain laurel", "Long Island Sound"],
  DE: ["wave", "Peach blossom", "The shore"],
  DC: ["star", "American Beauty rose", "The capital"],
  FL: ["wave", "Orange blossom", "The Keys"],
  GA: ["flower", "Cherokee rose", "Peach country"],
  HI: ["flower", "Hibiscus", "The islands"],
  ID: ["mountain", "Syringa", "Sawtooths"],
  IL: ["basketball", "Violet", "Bulls"],
  IN: ["star", "Peony", "Indianapolis"],
  IA: ["flower", "Wild rose", "Prairie"],
  KS: ["flower", "Sunflower", "The plains"],
  KY: ["flower", "Goldenrod", "Bluegrass"],
  LA: ["wave", "Magnolia", "The Mississippi"],
  ME: ["lighthouse", "White pine", "The coast"],
  MD: ["wave", "Black-eyed Susan", "The bay"],
  MA: ["baseball", "Mayflower", "Red Sox"],
  MI: ["wave", "Apple blossom", "Great Lakes"],
  MN: ["pine", "Lady's slipper", "Ten thousand lakes"],
  MS: ["wave", "Magnolia", "The river"],
  MO: ["arch", "Hawthorn", "The Arch"],
  MT: ["mountain", "Bitterroot", "Big Sky"],
  NE: ["flower", "Goldenrod", "The plains"],
  NV: ["cactus", "Sagebrush", "The desert"],
  NH: ["mountain", "Purple lilac", "White Mountains"],
  NJ: ["wave", "Violet", "The shore"],
  NM: ["cactus", "Yucca", "High desert"],
  NY: ["baseball", "Rose", "Yankees"],
  NC: ["pine", "Dogwood", "The Blue Ridge"],
  ND: ["rushmore", "Wild prairie rose", "Badlands"],
  OH: ["football", "Scarlet carnation", "Browns"],
  OK: ["star", "Oklahoma rose", "The plains"],
  OR: ["pine", "Oregon grape", "The Cascades"],
  PA: ["bell", "Mountain laurel", "Liberty Bell"],
  RI: ["wave", "Violet", "The bay"],
  SC: ["flower", "Yellow jessamine", "Palmetto coast"],
  SD: ["rushmore", "Pasque flower", "Mount Rushmore"],
  TN: ["star", "Iris", "Music City"],
  TX: ["football", "Bluebonnet", "Cowboys"],
  UT: ["canyon", "Sego lily", "Red rock"],
  VT: ["pine", "Red clover", "Green Mountains"],
  VA: ["flower", "Dogwood", "The Blue Ridge"],
  WA: ["mountain", "Rhododendron", "Rainier"],
  WV: ["mountain", "Rhododendron", "The hills"],
  WI: ["football", "Wood violet", "Packers"],
  WY: ["mountain", "Indian paintbrush", "Yellowstone"],
};

export function arrivalHtml(state) {
  const [mark, flower, note] = places[state.abbr] || ["star", "State flower", state.region];
  return `
    <div class="arrival-art">${marks[mark] || marks.star}</div>
    <div>
      <p>Entering</p>
      <strong>${state.name}</strong>
      <em>${flower} · ${note}</em>
    </div>
  `;
}

export function showArrival(root, state) {
  if (!root || !state) return;
  root.hidden = false;
  root.innerHTML = arrivalHtml(state);
  root.classList.remove("is-in");
  void root.offsetWidth;
  root.classList.add("is-in");
}

export function hideArrival(root) {
  if (!root) return;
  root.classList.remove("is-in");
  root.hidden = true;
  root.innerHTML = "";
}
