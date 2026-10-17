/* =====================================================================
   Sorcier : dessin du corps (silhouette épurée en SVG)
   Utilisé par la fiche (interactive) et par la fiche imprimable.
   ===================================================================== */
import { esc } from '../../core/ui.js';
import { ZONES_CORPS } from '../../shared/regles.js';

/* Valeur, bonus de progression, réutilisable, état d'une zone */
export function infoZoneDe(C, z) {
  const bonus = 2 * C.progression.filter(p => p.voie === 'partie' && p.cible === z.base).length;
  const reu = C.progression.some(p => p.voie === 'reutil' && p.cible === z.base);
  const et = (C.corps[z.k] && C.corps[z.k].etat) || 'intact';
  return { tot: z.pts + bonus, bonus, reu, et };
}

/* Formes de chaque zone (viewBox 0 0 240 440) */
const SIL = {
  XII: '<circle class="hit" cx="120" cy="52" r="40"/><circle class="ring" cx="120" cy="52" r="40"/>',
  VI: '<circle cx="110" cy="48" r="5.5"/>', VIb: '<circle cx="130" cy="48" r="5.5"/>',
  VII: '<ellipse cx="93" cy="54" rx="4.5" ry="8.5"/><ellipse cx="147" cy="54" rx="4.5" ry="8.5"/>',
  VIII: '<ellipse cx="120" cy="66" rx="8" ry="3.4"/>',
  III: '<path d="M79 96 C66 100 58 150 50 198 L63 202 C71 156 79 122 88 105 Z"/><path d="M161 96 C174 100 182 150 190 198 L177 202 C169 156 161 122 152 105 Z"/>',
  II: '<circle cx="55" cy="212" r="9.5"/><circle cx="185" cy="212" r="9.5"/>',
  I: '<path class="lines" d="M48 220 L45 233 M55 222 L55 236 M62 220 L65 233 M192 220 L195 233 M185 222 L185 236 M178 220 L175 233"/>',
  XI: '<path d="M134 128 C125 120 122 111 128 108 C131 107 134 109 134 112 C134 109 137 107 140 108 C146 111 143 120 134 128 Z"/>',
  XIII: '<circle class="ame" cx="120" cy="150" r="10"/>',
  X: '<ellipse cx="102" cy="182" rx="6" ry="9.5"/><ellipse cx="138" cy="182" rx="6" ry="9.5"/>',
  IX: '<path d="M112 213 L128 213 L120 225 Z"/>',
  V: '<path d="M92 226 L116 230 L113 390 L99 390 Z"/><path d="M148 226 L124 230 L127 390 L141 390 Z"/>',
  IV: '<ellipse cx="104" cy="401" rx="14" ry="6.5"/><ellipse cx="136" cy="401" rx="14" ry="6.5"/>',
};
/* Position de la valeur affichée près de chaque zone */
const ETIQ = { XII: [168, 22], VI: [99, 36], VIb: [141, 36], VII: [78, 58], VIII: [138, 72], III: [40, 146], II: [33, 214], I: [40, 250], XI: [152, 116], XIII: [120, 151], X: [120, 186], IX: [140, 224], V: [84, 312], IV: [84, 420] };

export function silhouetteSVG(C, { prepa = {}, actif = null, impression = false } = {}) {
  const base = '<g class="base"><circle cx="120" cy="52" r="26"/><rect x="112" y="76" width="16" height="13" rx="3"/><path d="M80 92 Q120 82 160 92 L156 200 Q120 212 84 200 Z"/><path d="M86 200 Q120 214 154 200 L150 224 Q120 234 90 224 Z"/></g>';
  const zones = ZONES_CORPS.map(z => {
    const { tot, et } = infoZoneDe(C, z);
    const cl = `z z-${et}${prepa[z.k] ? ' sel' : ''}${actif === z.k ? ' act' : ''}`;
    const inter = impression ? '' : ` tabindex="0" role="button" aria-label="${esc(z.n)} : ${tot} points, ${et === 'intact' ? 'intact' : et === 'temp' ? 'sacrifié temporairement' : 'perdu'}"`;
    return `<g class="${cl}" data-zone="${z.k}"${inter}><title>${esc(z.r)} · ${esc(z.n)} — ${tot} pts</title>${SIL[z.k]}</g>`;
  }).join('');
  const labels = ZONES_CORPS.map(z => { const { tot, et } = infoZoneDe(C, z); const [x, y] = ETIQ[z.k]; return `<text class="v v-${et}" x="${x}" y="${y}">${et === 'def' ? '✕' : et === 'temp' ? tot / 2 : tot}</text>`; }).join('');
  return `<svg class="silhouette${impression ? ' ps-sil' : ''}" viewBox="0 0 240 440" role="group" aria-label="Corps du sorcier">${base}${zones}<g class="labels" aria-hidden="true">${labels}</g></svg>`;
}
