// The paper-cut palette. design/source/build_requests.py quotes the same
// values in every image request; keep the two in step.
export const PALETTE = {
  paper: '#F2E8D5', // rice paper / Tyvek, lit from behind
  paperShade: '#D9C9A8',
  ink: '#16151A', // cut silhouettes
  indigo: '#1E2A44', // night, far hills
  indigoMid: '#3A4C6E',
  dusk: '#6E5A78',
  bronze: '#B07A3A',
  bronzeLight: '#D9A55B',
  verdigris: '#4F8A7B',
  lacquer: '#A8322D', // Lạc Việt red
  moon: '#F6F0DC',
  iron: '#5E6470', // Han faction
  ironDark: '#33373F',
  straw: '#C9A866',
};

export const SKIES = {
  dawn: { top: '#2B3556', mid: '#8A5E73', low: '#E3B27A', glow: '#F6D9A0', far0: '#7A6A88', far: '#4B4F72', mid2: '#2E3350', ground: '#1F2236' },
  day: { top: '#9DB7AE', mid: '#D6D6B8', low: '#F2E8D5', glow: '#FFF6DE', far0: '#B4C6BC', far: '#7E9C95', mid2: '#46655F', ground: '#25302E' },
  // Dusk: The Oath and Mã Viện Returns — rose and violet, the light going.
  dusk: { top: '#2A2340', mid: '#6B3F57', low: '#C27A5E', glow: '#F2C48C', far0: '#6E5470', far: '#4A3A55', mid2: '#2C2236', ground: '#1A1522' },
  // The foundry: night lit orange from the furnaces.
  foundry: { top: '#170F12', mid: '#3D1E17', low: '#8A3A1A', glow: '#FFB65C', far0: '#4A2A22', far: '#331C18', mid2: '#1F1210', ground: '#120B0A' },
  // Ash dawn: the epilogue — grey and cream, one warm light.
  ash: { top: '#4C4E55', mid: '#8A8580', low: '#D8CDB8', glow: '#F2E2C2', far0: '#8F8C88', far: '#6D6B69', mid2: '#46474A', ground: '#2A2A2C' },
  night: { top: '#0E1426', mid: '#1E2A44', low: '#3A4C6E', glow: '#F6F0DC', far0: '#3E5078', far: '#2A3858', mid2: '#18203A', ground: '#0D111E' },
};
