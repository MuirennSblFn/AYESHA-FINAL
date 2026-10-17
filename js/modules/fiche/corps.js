/* =====================================================================
   Sorcier : dessin du corps (pantin gothique en SVG)
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

/* ---------------------------------------------------------------------
   Le pantin : une marionnette articulée, bras en croix comme l'homme de
   Vitruve, inscrite dans un cercle sous une arche gothique, suspendue à
   ses fils. viewBox 0 0 300 460. Seules les zones (SIL) sont cliquables ;
   le décor et les articulations sont purement visuels.
   --------------------------------------------------------------------- */
const r1 = n => Math.round(n * 10) / 10;
/* Segment de membre effilé aux bouts arrondis, de (x1,y1) rayon a à (x2,y2) rayon b */
function seg(x1, y1, x2, y2, a, b) {
  const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
  const P = (x, y, r, s) => `${r1(x + s * nx * r)} ${r1(y + s * ny * r)}`;
  return `<path d="M${P(x1, y1, a, 1)} L${P(x2, y2, b, 1)} A${b} ${b} 0 0 0 ${P(x2, y2, b, -1)} L${P(x1, y1, a, -1)} A${a} ${a} 0 0 0 ${P(x1, y1, a, 1)} Z"/>`;
}
const miroir = (f, ...a) => f(...a) + f(...a.map((v, i) => (i % 2 === 0 && i < 4 ? 300 - v : v)));

const SIL = {
  XII: '<circle class="hit" cx="150" cy="84" r="31"/><circle class="ring" cx="150" cy="84" r="31"/>',
  VI: '<path d="M138.5 82 L143 79 L147.5 82 L143 85 Z"/>', VIb: '<path d="M152.5 82 L157 79 L161.5 82 L157 85 Z"/>',
  VII: '<ellipse cx="131.5" cy="86" rx="3.6" ry="7"/><ellipse cx="168.5" cy="86" rx="3.6" ry="7"/>',
  VIII: '<path d="M144 96.5 Q150 94 156 96.5 Q150 101 144 96.5 Z"/>',
  III: miroir(seg, 117, 122, 80, 122, 6.5, 5.5) + miroir(seg, 72, 122, 45, 122, 5, 4),
  II: '<path d="M38 115 Q26 113 21 118 L21 126 Q26 131 38 129 Z"/><path d="M262 115 Q274 113 279 118 L279 126 Q274 131 262 129 Z"/>',
  I: '<path class="lines" d="M21 117 L11 111 M20 122 L8 122 M21 127 L11 133 M279 117 L289 111 M280 122 L292 122 M279 127 L289 133"/>',
  XI: '<path d="M161 160 C153 154 151 147 155 144.5 C157.5 143.2 160.4 144.6 161 147.2 C161.6 144.6 164.5 143.2 167 144.5 C171 147 169 154 161 160 Z"/>',
  XIII: '<path class="ame" d="M150 158 L154 167 L163 171 L154 175 L150 184 L146 175 L137 171 L146 167 Z"/>',
  X: '<ellipse cx="141" cy="190" rx="4.6" ry="7.5"/><ellipse cx="159" cy="190" rx="4.6" ry="7.5"/>',
  IX: '<path d="M144 213 L156 213 L150 224 Z"/>',
  V: miroir(seg, 138, 238, 128, 316, 8, 6.5) + miroir(seg, 126, 326, 117, 398, 6, 4.5),
  IV: '<path d="M118 404 Q118 412 112 414 L96 416 Q92 410 99 407 Z"/><path d="M182 404 Q182 412 188 414 L204 416 Q208 410 201 407 Z"/>',
};
/* Position de la valeur affichée près de chaque zone */
const ETIQ = { XII: [104, 62], VI: [116, 76], VIb: [184, 76], VII: [118, 104], VIII: [184, 102], III: [98, 107], II: [30, 144], I: [12, 101], XI: [184, 152], XIII: [150, 171], X: [121, 191], IX: [170, 220], V: [106, 292], IV: [86, 432] };

/* Décor : arche ogivale, cercle de Vitruve, croix de marionnettiste et fils */
const DECOR = `<g class="decor" aria-hidden="true">
  <path class="arche" d="M14 452 L14 140 A182 182 0 0 1 150 12 A182 182 0 0 1 286 140 L286 452"/>
  <path class="arche fine" d="M22 452 L22 143 A172 172 0 0 1 150 24 A172 172 0 0 1 278 143 L278 452"/>
  <circle class="vitruve" cx="150" cy="240" r="126"/>
  <circle class="vitruve tic" cx="150" cy="240" r="121"/>
  <path class="sol" d="M14 440 L286 440 M14 446 L286 446"/>
  <g class="fils"><path d="M108 40 L40 122 M192 40 L260 122 M150 48 L150 63 M124 40 L127 321 M176 40 L173 321"/></g>
  <g class="croix"><path d="M104 40 L196 40 M150 30 L150 48 M124 36 L124 44 M176 36 L176 44"/><circle cx="150" cy="40" r="3"/></g>
</g>`;
/* Squelette du pantin (non cliquable) : tête, cou, torse, bassin, articulations */
const PANTIN = `<g class="base" aria-hidden="true">
  <path d="M150 62 C162 62 168 72 168 84 C168 98 160 106 150 106 C140 106 132 98 132 84 C132 72 138 62 150 62 Z"/>
  <path d="M146 105 L154 105 L155 116 L145 116 Z"/>
  <path d="M120 116 Q150 110 180 116 L172 166 Q170 186 166 200 L134 200 Q130 186 128 166 Z"/>
  <path class="cote" d="M150 122 L150 196 M136 134 Q150 140 164 134 M135 146 Q150 152 165 146 M137 158 Q150 163 163 158"/>
  <path d="M133 204 L167 204 L172 226 Q150 240 128 226 Z"/>
</g>`;
const ARTIC = `<g class="artic" aria-hidden="true">${[[150, 110, 3.4], [120, 122, 5], [180, 122, 5], [76, 122, 4.4], [224, 122, 4.4], [41, 122, 3.2], [259, 122, 3.2], [150, 202, 3.6], [138, 234, 5], [162, 234, 5], [127, 321, 4.6], [173, 321, 4.6], [116, 402, 3.4], [184, 402, 3.4]]
  .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/><circle class="rivet" cx="${x}" cy="${y}" r="1"/>`).join('')}</g>`;

export function silhouetteSVG(C, { prepa = {}, actif = null, impression = false } = {}) {
  const zones = ZONES_CORPS.map(z => {
    const { tot, et } = infoZoneDe(C, z);
    const cl = `z z-${et}${prepa[z.k] ? ' sel' : ''}${actif === z.k ? ' act' : ''}`;
    const inter = impression ? '' : ` tabindex="0" role="button" aria-label="${esc(z.n)} : ${tot} points, ${et === 'intact' ? 'intact' : et === 'temp' ? 'sacrifié temporairement' : 'perdu'}"`;
    return `<g class="${cl}" data-zone="${z.k}"${inter}><title>${esc(z.r)} · ${esc(z.n)} — ${tot} pts</title>${SIL[z.k]}</g>`;
  }).join('');
  const labels = ZONES_CORPS.map(z => { const { tot, et } = infoZoneDe(C, z); const [x, y] = ETIQ[z.k]; return `<text class="v v-${et}${z.k === 'XIII' ? ' v-ame' : ''}" x="${x}" y="${y}">${et === 'def' ? '✕' : et === 'temp' ? tot / 2 : tot}</text>`; }).join('');
  return `<svg class="silhouette${impression ? ' ps-sil' : ''}" viewBox="0 0 300 460" role="group" aria-label="Corps du sorcier">${DECOR}${PANTIN}${zones}${ARTIC}<g class="labels" aria-hidden="true">${labels}</g></svg>`;
}
