/* Fiche imprimable (2 pages A4) générée à partir des données du personnage. */
import { esc } from '../../core/ui.js';
import { STATS, CLASSES, VOIE, CORPS, COUT, DIFF } from '../../shared/regles.js';
import { int, compte, niveau, malusArmure, bonusDegats, maxEffectifs } from '../../shared/personnage.js';

const SIG = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="14" stroke-dasharray="1.5 2.5"/><path d="M20 5 L33 28 H7 Z"/><path d="M11 20 Q20 12 29 20 Q20 28 11 20 Z"/><circle cx="20" cy="20" r="2.6" fill="currentColor"/></svg>';

export function ficheImprimable(C) {
  const count = v => compte(C, v);
  const motBonus = m => { if (!m) return 0; const w = m.trim().toLowerCase(); return 3 * C.progression.filter(p => p.voie === 'mot' && String(p.cible || '').trim().toLowerCase() === w).length; };
  const psText = s => s && String(s).trim() ? `<div class="ps-text">${esc(s)}</div>` : '<div class="ps-text lines"></div>';

  function psClass() {
    const k = C.classe;
    if (!k) return `<div class="ps-cls"><div class="chips"><span>Classe : <b>à choisir</b></span></div>${Array.from({ length: 4 }, () => '<div class="blankline"></div>').join('')}</div>`;
    if (k === 'magicien') {
      const words = C.mots.filter(m => String(m.mot || '').trim() || String(m.sens || '').trim());
      const rows = words.map(m => { const b = motBonus(m.mot); return `<tr><td style="font-family:var(--f-fell);font-size:10.5pt">${esc(m.mot)}</td><td>${esc(m.sens)}</td><td class="tn">${b ? '+' + b : ''}</td></tr>`; }).join('');
      const blanks = Array.from({ length: Math.max(3, 8 - words.length) }, () => '<tr><td></td><td></td><td></td></tr>').join('');
      return `<div class="ps-cls"><div class="chips"><span>Maîtrise générale <b>+${count('maitrise')}</b></span><span>PM gagnés <b>+${3 * count('pm')}</b></span></div>
        <div class="two"><table><thead><tr><th>Mot de l'ancien langage</th><th>Sens</th><th style="width:10mm">Bonus</th></tr></thead><tbody>${rows}${blanks}</tbody></table>
        <table class="ps-mini"><thead><tr><th>Mots</th><th>Coût</th><th>Seuil 1d20</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(n => `<tr><td>${n}${n === 6 ? '+' : ''}</td><td class="tn">${COUT[n]} PM</td><td class="tn">${DIFF[n]}${n === 6 ? '+' : ''}</td></tr>`).join('')}</tbody></table></div>
        <p class="rule">Le jet de 1d20 + maîtrise + bonus du meilleur mot doit dépasser le seuil. Tout échec coûte de la Santé mentale.</p></div>`;
    }
    if (k === 'devin') return `<div class="ps-cls"><div class="chips"><span>Cartes dévoilées <b>${count('devoiler')}</b></span><span>Remplacements <b>${count('remplacer')}</b></span><span>Récupérations <b>${count('recuperer')}</b></span></div>
        <p class="rule" style="font-style:normal">Déclarer l'action, sacrifier autant de points de magie ou de chance que de cartes à tirer, en garder une. Seuil fixé par le MJ, 20 au plus. Les cartes se renouvellent avec les points de magie.</p>
        <div class="lb" style="margin-top:2mm">CARTES PIOCHÉES</div>${Array.from({ length: 3 }, () => '<div class="blankline"></div>').join('')}</div>`;
    if (k === 'sorcier') {
      const rows = CORPS.map(([r, n, pts]) => {
        const bonus = 2 * C.progression.filter(p => p.voie === 'partie' && p.cible === r).length; const tot = pts + bonus;
        const et = (C.corps[r] && C.corps[r].etat) || 'intact'; const reu = C.progression.some(p => p.voie === 'reutil' && p.cible === r);
        return `<tr><td class="rn">${r}</td><td>${n}${reu ? ' <small>(réutilisable)</small>' : ''}</td><td class="tn">${tot}${bonus ? ` <small>(+${bonus})</small>` : ''}</td><td class="tn">${tot / 2}</td><td><span class="ps-box ${et === 'temp' ? 'on' : ''}"></span>temp. <span class="ps-box ${et === 'def' ? 'on' : ''}" style="margin-left:3mm"></span>déf.</td></tr>`;
      }).join('');
      return `<div class="ps-cls"><div class="chips"><span>PV gagnés <b>+${3 * count('pv')}</b></span></div>
        <table class="ps-body"><thead><tr><th></th><th>Partie du corps</th><th>Points</th><th>Temp.</th><th>Sacrifice</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="rule">1d12 + sacrifices pour dépasser le seuil sur 20. Un sacrifice temporaire vaut la moitié des points et coûte 2 PV.</p></div>`;
    }
    if (k === 'portesac') return `<div class="ps-cls"><div class="chips"><span>Duplication <b>${count('dupliquer') ? 'oui' : 'non'}</b></span><span>Tirages multiples <b>${count('tirages') ? 'oui' : 'non'}</b></span><span>Échanges <b>${count('echange')}</b></span></div>
        <div class="ps-sac">${C.sac.map((v, i) => `<div><b>${i + 1}</b><span>${esc(v)}</span></div>`).join('')}</div>
        <p class="rule">Le dé désigne le numéro de l'objet qui sort du Sac.</p></div>`;
    return '';
  }

  const M = maxEffectifs(C); const cl = C.classe ? CLASSES[C.classe].nom : '';
  const stats = STATS.map(s => { const n = int(C.stats[s.k]); const b = bonusDegats(n); return `<div class="ps-stat"><div class="ab">${s.k}</div><div class="v">${n == null ? '' : n}</div><div class="m">${n == null ? s.n : `origine ${Math.floor(n / 5)}${b ? ` · dégâts +${b}` : ''}${s.k === 'DEX' && malusArmure(C) ? ` · armuré ${n - malusArmure(C)}` : ''}`}</div></div>`; }).join('');
  const G = [['pv', 'PV · Points de vie', 36], ['pm', 'PM · Points de magie', 36], ['sm', 'SM · Santé mentale', 19], ['ch', 'Ch · Chance', 19]];
  const gauges = G.map(([k, l, def]) => { const max = M[k]; const top = max == null ? def - 1 : max; return `<div class="ps-g ${k}"><div class="gl">${l}<small>${max == null ? 'maximum : ____' : 'maximum : ' + max}</small></div><div class="nums">${Array.from({ length: top + 1 }, (_, i) => `<span class="${i === max ? 'max' : ''}">${i}</span>`).join('')}</div></div>`; }).join('');
  const tal = C.talents.map(t => `<div class="t">${esc(t.t)}</div><div class="j">${esc(t.j)}</div>`).join('');
  const ent = C.entente.map(e => `<tr><td class="n">${esc(e.nom)}</td><td>${esc(e.a)}</td><td class="note">${String(e.nom || '').trim() ? (e.note || 0) : '___'} / 10</td></tr>`).join('');
  const prog = C.progression.map((p, i) => { const v = VOIE[p.voie]; let c = p.cible || ''; if (v && v.cible === 'partie') { const b = CORPS.find(x => x[0] === c); if (b) c = b[0] + ' · ' + b[1]; } return `<tr><td class="tn" style="width:14mm;color:var(--pg);font-family:var(--f-fell)">Niv. ${i + 2}</td><td>${v ? esc(v.l) : ''}</td><td>${esc(c)}</td></tr>`; }).join('');
  const progBlank = Array.from({ length: Math.max(2, 5 - C.progression.length) }, (_, i) => `<tr><td class="tn" style="width:14mm;color:var(--pg);font-family:var(--f-fell)">Niv. ${C.progression.length + i + 2}</td><td></td><td></td></tr>`).join('');
  const armes = C.armes.filter(a => String(a.nom || '').trim());
  const armures = C.armures.filter(a => String(a.nom || '').trim());
  const arm = armes.map(a => { const b = bonusDegats(int(C.stats[a.stat])); return `<tr><td>${esc(a.nom)}</td><td>${esc(a.stat)}</td><td>${esc(a.deg)}${b ? ` +${b}` : ''}</td><td>${esc(a.eff)}</td></tr>`; }).join('');
  const amr = armures.map(a => `<tr><td>${esc(a.nom)}</td><td class="tn">${esc(a.red)}</td><td class="tn">${esc(a.mal)}</td><td>${esc(a.eff)}</td></tr>`).join('');
  const blankRows = (n, c) => Array.from({ length: n }, () => `<tr>${'<td></td>'.repeat(c)}</tr>`).join('');
  const foot = p => `<div class="ps-foot"><span>AYESHA · FICHE DE PERSONNAGE</span><span>${esc((C.nom || '').toUpperCase())}${C.nom ? ' · ' : ''}${p} / 2</span></div>`;

  return `
  <section class="ps" aria-label="Fiche imprimable, page 1">
    <div class="ps-head">
      <div class="ps-portrait">${C.portrait ? `<img src="${esc(C.portrait)}" alt="">` : SIG}</div>
      <div><div class="ps-title">AYESHA · FICHE DE PERSONNAGE</div><div class="ps-name">${esc(C.nom)}</div>
        <div class="ps-id"><div><span class="lb">JOUEUR</span><b>${esc(C.joueur)}</b></div><div><span class="lb">CLASSE</span><b>${esc(cl)}</b></div></div></div>
      <div class="ps-lvl"><b>${niveau(C)}</b><span class="lb">NIVEAU</span></div>
    </div>
    <div class="ps-stats">${stats}</div>
    <div class="ps-gauges">${gauges}</div>
    <div class="two">
      <div class="sec ps-tal"><h3>Talents<small>SANS JET DE DÉ</small></h3>${tal}</div>
      <div class="sec ps-ent"><h3>Entente<small>SUR 10</small></h3><table><tbody>${ent}</tbody></table></div>
    </div>
    <div class="sec"><h3>Spécificités de classe${cl ? `<small>${esc(cl.toUpperCase())}</small>` : ''}</h3>${psClass()}</div>
    ${foot(1)}
  </section>
  <section class="ps" aria-label="Fiche imprimable, page 2">
    <div class="sec" style="margin-top:0"><h3>Progression<small>UNE VOIE PAR NIVEAU</small></h3><table><tbody>${prog}${progBlank}</tbody></table></div>
    <div class="sec"><h3>Armes<small>NOM / STAT / DÉGÂTS / EFFETS</small></h3><table><thead><tr><th>Arme</th><th style="width:12mm">Stat</th><th style="width:22mm">Dégâts</th><th>Effets</th></tr></thead><tbody>${arm}${blankRows(Math.max(2, 4 - armes.length), 4)}</tbody></table></div>
    <div class="sec"><h3>Armures<small>RÉDUCTION / MALUS DEX / EFFETS</small></h3><table><thead><tr><th>Armure</th><th style="width:18mm">Réduction</th><th style="width:18mm">Malus DEX</th><th>Effets</th></tr></thead><tbody>${amr}${blankRows(Math.max(1, 2 - armures.length), 4)}</tbody></table></div>
    <div class="two">
      <div class="sec"><h3>Inventaire</h3>${psText(C.inventaire)}</div>
      <div class="sec"><h3>Apparence</h3>${psText(C.apparence)}</div>
    </div>
    <div class="sec"><h3>Histoire</h3>${psText(C.histoire)}</div>
    <div class="sec"><h3>Notes de partie<small>MOTS APPRIS, ARTEFACTS, BESTIAIRE</small></h3><div class="ps-text lines" style="min-height:34mm"></div></div>
    ${foot(2)}
  </section>`;
}
