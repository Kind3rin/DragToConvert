// Icona dell'app: una ruota a 6 spicchi colorati con il hub bianco al centro.
function iconSvg(size = 64) {
  const cx = 32, cy = 32, r0 = 11, r1 = 29;
  const n = 6, gap = 0.1;
  const hues = ['#8b5cf6', '#c026d3', '#ec4899', '#f97316', '#f59e0b', '#14b8a6'];
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 + gap;
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2 - gap;
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    d += `<path d="M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z" fill="${hues[i]}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${d}<circle cx="32" cy="32" r="6" fill="#fff"/></svg>`;
}

module.exports = { iconSvg };
