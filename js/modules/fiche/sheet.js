/* =====================================================================
   Fiche de personnage — affichage et saisie
   ---------------------------------------------------------------------
   creerFiche(root, C, { lectureSeule, onChange })
     root : élément où dessiner la fiche
     C    : données du personnage (objet modifié en place)
     lectureSeule : true pour la consultation par le MJ
     onChange(C)  : appelé à chaque modification
   Retourne { render(), setData(C), lecture(bool) }
   Tout ce qui est calculé par les règles peut aussi être saisi à la main
   (caractéristiques, chance, maximums de PV / PM / SM, valeurs actuelles).
   ===================================================================== */
import { $, $$, esc, toast, modal, confirmer, copyText } from '../../core/ui.js';
import { lexique, chercher } from '../../shared/lexique.js';
import { silhouetteSVG, infoZoneDe } from './corps.js';
import { STATS, CLASSES, VOIE, CORPS, SAC, COUT, DIFF, DIFF_TXT, TALENTS, JAUGES, d6, EMPLACEMENTS, EMPL_PAR_TYPE, CASES, TYPES_OBJET, CATEGORIES_MOT, GRAMMAIRE, incantation, ZONES_CORPS, PERTES, COUT_PV_SACRIFICE_TEMP } from '../../shared/regles.js';
import { occupant, sacoche, estEquipable, equiper, ranger, utiliser, reductionPortee, malusPorte, nouvelId, casesBloquees, refusEquiper, rangerBloques } from '../../shared/equipement.js';
import { int, compte, niveau, malusArmure, bonusDegats, maxCalcules, maxEffectifs, actuel, formule, statEff, pertesCorps } from '../../shared/personnage.js';

export function creerFiche(root, C, { lectureSeule = false, onChange = () => {} } = {}) {
  let reading = lectureSeule;
  let seq = [];                 // mots du sort en cours de composition
  let LEX = null, lexQ = '';
  let zoneActive = null, prepa = {};   // Sorcier : zone affichée, sacrifice en préparation { zone: 'temp' | 'def' }     // lexique de l'ancien langage (chargé à la demande)
  const q = s => $(s, root), qq = s => $$(s, root);
  const persist = () => { if (!lectureSeule) onChange(C); };

  root.classList.add('fichewrap');
  root.innerHTML = `<article class="sheet" id="sheet"></article>
    <input type="file" id="file-portrait" accept="image/*" hidden>
    <datalist id="talents-list">${TALENTS.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <datalist id="mots-list"></datalist>`;

  /* ---------- Caractéristiques ---------- */
  function statCard(s) {
    const n = int(C.stats[s.k]); const pct = n == null ? 0 : Math.max(0, Math.min(100, (n - 15) / 75 * 100));
    const r = C.rolls[s.k];
    return `<div class="stat" id="st-${s.k}">
      <div class="ab">${s.k}</div><div class="full">${s.n}</div>
      <input id="f-stat-${s.k}" data-k="stats.${s.k}" inputmode="numeric" value="${esc(C.stats[s.k])}" placeholder="—" aria-label="${s.n}">
      <div class="meter" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <div class="meta" data-meta="${s.k}"></div>
      <div class="dice" data-dice="${s.k}">${r ? r.join(' + ') + ' = ' + r.reduce((a, b) => a + b, 0) + ' × 5' : ''}</div>
      <div class="acts edit-only"><button class="mini" data-roll="${s.k}" title="Lancer 3d6 × 5">Lancer</button><button class="mini" data-joker="${s.k}" title="Relancer cette caractéristique (une seule fois)">Joker</button></div>
    </div>`;
  }
  function statMeta(k) {
    const n = int(C.stats[k]); if (n == null) return '<span>&nbsp;</span>';
    const parts = [`<span>origine <b>${Math.floor(n / 5)}</b></span>`];
    const e = statEff(C, k);
    if (e !== n) parts.push(`<span class="perte" title="Après les pertes définitives du corps">après pertes <b>${e}</b></span>`);
    const b = bonusDegats(e); if (b) parts.push(`<span title="Bonus de dégâts quand cette caractéristique est testée pour attaquer">dégâts <b>+${b}</b></span>`);
    if (k === 'DEX' && malusArmure(C)) parts.push(`<span title="Avec le malus d'armure">armuré <b>${e - malusArmure(C)}</b></span>`);
    return parts.join('');
  }

  /* ---------- Jauges : valeur actuelle et maximum saisissables ---------- */
  function gaugeHTML([k, ab, n]) {
    const calc = maxCalcules(C)[k], M = maxEffectifs(C), max = M[k];
    const manuel = k !== 'ch' && int(C.max[k]) != null;
    const maxVal = k === 'ch' ? C.chance : (manuel ? C.max[k] : (calc ?? ''));
    const cur = max == null ? null : actuel(C, k, max);
    let hint;
    if (k === 'ch') hint = C.chanceRoll ? `lancé : ${C.chanceRoll.join(' + ')}` : (C.chance !== '' ? 'saisie à la main' : '3d6 : saisissez ou lancez les dés');
    else if (manuel) hint = `saisi à la main${calc != null && calc !== max ? ` · calculé : ${calc}` : ''} <button class="linkbtn edit-only" data-maxreset="${k}" title="Revenir à la valeur calculée">↺ calcul</button>`;
    else hint = calc != null ? `calculé : ${esc(formule(C, k))}` : `${esc(formule(C, k))} : renseignez les caractéristiques ou saisissez le maximum`;
    const pipsH = max == null ? '' : `<div class="pips" role="group" aria-label="${n}">${Array.from({ length: max + 1 }, (_, i) => `<button class="${i <= cur ? 'on' : ''} ${i === cur ? 'cur' : ''}" data-gauge="${k}" data-v="${i}" aria-label="${n} : ${i}" ${i === cur ? 'aria-current="true"' : ''}>${i}</button>`).join('')}</div>`;
    return `<div class="gauge ${k}">
      <div class="gl"><b>${ab} · ${n}</b>
        <div class="gnums"><input class="gin" id="g-cur-${k}" data-cur="${k}" inputmode="numeric" value="${cur ?? ''}" placeholder="—" aria-label="${n} actuels" ${max == null ? 'disabled' : ''}><span>/</span><input class="gin max${manuel ? ' manual' : ''}" id="g-max-${k}" ${k === 'ch' ? 'data-k="chance"' : `data-max="${k}"`} inputmode="numeric" value="${esc(maxVal)}" placeholder="max" aria-label="${n} maximum"></div>
        <small>${hint}</small>
      </div>
      ${pipsH || '<div class="empty">Saisissez le maximum pour afficher la jauge.</div>'}
    </div>`;
  }
  function renderGauges() {
    const a = document.activeElement, id = a && root.contains(a) && a.id, s = a && a.selectionStart;
    q('#gauges').innerHTML = JAUGES.map(gaugeHTML).join('');
    if (id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(s, s); } catch (e) {} } }
    verrouiller();
  }

  /* ---------- Talents, entente ---------- */
  const talentsHTML = () => C.talents.map((t, i) => `<div class="line talent"><input class="in t" id="f-tal-${i}" data-k="talents.${i}.t" list="talents-list" value="${esc(t.t)}" placeholder="Talent ${i + 1}" aria-label="Talent ${i + 1}"><input class="in j" id="f-talj-${i}" data-k="talents.${i}.j" value="${esc(t.j)}" placeholder="Justification dans l'histoire du personnage" aria-label="Justification du talent ${i + 1}"></div>`).join('');
  const ententeHTML = () => C.entente.map((e, i) => `<div class="line ent"><input class="in" id="f-entn-${i}" data-k="entente.${i}.nom" value="${esc(e.nom)}" placeholder="Personnage" aria-label="Personnage"><input class="in a" id="f-enta-${i}" data-k="entente.${i}.a" value="${esc(e.a)}" placeholder="Anecdote commune" aria-label="Anecdote"><div class="dots" role="group" aria-label="Entente">${Array.from({ length: 10 }, (_, j) => `<button data-ent="${i}" data-v="${j + 1}" class="${j < (e.note || 0) ? 'on' : ''}" aria-label="${j + 1} sur 10"></button>`).join('')}<span>${e.note || 0}/10</span></div></div>`).join('');
  function ententeAvg() {
    const rows = C.entente.filter(e => String(e.nom || '').trim()); if (!rows.length) return '';
    const a = rows.reduce((s, e) => s + (e.note || 0), 0) / rows.length;
    return `<div class="avg ${a < 4 ? 'low' : ''}"><span>ENTENTE MOYENNE</span><b>${a.toFixed(1).replace('.', ',')} / 10</b></div>${a < 4 ? "<p class=\"warn\">Sous 4/10, le personnage risque de perdre l'accès à ses pouvoirs magiques.</p>" : ''}`;
  }

  /* ---------- Équipement ---------- */
  /* ---------- Équipement porté (emplacements) ---------- */
  const resume = o => {
    const p = [];
    if (o.type === 'arme' || o.deg) { if (o.stat) p.push(esc(o.stat)); if (o.deg) { const b = bonusDegats(statEff(C, o.stat)); p.push(esc(o.deg) + (b ? ` <b>+${b}</b>` : '')); } }
    if (int(o.red)) p.push(`Réd. ${esc(o.red)}`);
    if (int(o.mal)) p.push(`DEX −${Math.abs(int(o.mal))}`);
    return p.join(' · ');
  };
  function equipHTML() {
    const cartes = CASES.map(c => {
      const o = occupant(C, c.k);
      if (c.k === 'main_g' && o && o.porte === 'deux_mains') return '';
      const deux = o && o.porte === 'deux_mains';
      const bloq = casesBloquees(C)[c.k];
      if (bloq && !o) return `<div class="case vide bloquee"><div class="cl">${c.l}</div><div class="cn none">Inutilisable</div><div class="ce">${esc(ZONES_CORPS.find(z => z.k === bloq)?.n || '')} perdu${/s$/.test(ZONES_CORPS.find(z => z.k === bloq)?.n || '') ? 's' : ''}</div></div>`;
      return `<div class="case${o ? '' : ' vide'}${deux ? ' deux' : ''}${c.k.startsWith('main') ? ' arme' : ''}">
        <div class="cl">${deux ? 'Deux mains' : c.l}</div>
        ${o ? `<div class="cn">${esc(o.nom || 'Objet sans nom')}</div>${resume(o) ? `<div class="cs">${resume(o)}</div>` : ''}${o.eff ? `<div class="ce">${esc(o.eff)}</div>` : ''}
          <button class="mini ranger" data-ranger="${esc(o.id)}" title="Remettre dans l'inventaire">Ranger</button>` : '<div class="cn none">—</div>'}
      </div>`;
    }).join('');
    const red = reductionPortee(C), mal = malusPorte(C), dex = statEff(C, 'DEX');
    return `<div class="cases">${cartes}</div>
      <div class="totaux"><span>Réduction totale <b>${red}</b></span><span>Malus DEX <b>${mal ? '−' + mal : '0'}</b></span>${dex != null ? `<span>DEX en armure <b>${dex - mal}</b></span>` : ''}</div>`;
  }

  /* ---------- Inventaire ---------- */
  const qteDe = o => { const n = int(o.qte); return n == null ? 0 : n; };
  function possHTML(o) {
    const id = esc(o.id), pk = f => `data-pk="${id}.${f}"`;
    const empls = EMPL_PAR_TYPE[o.type] || [''];
    const emplOpts = [...new Set([...empls, o.empl || ''])].map(e => `<option value="${e}" ${o.empl === e ? 'selected' : ''}>${e ? EMPLACEMENTS[e]?.l || e : 'Ne s’équipe pas'}</option>`).join('');
    const det = o.type === 'arme'
      ? `<label class="pf">Stat <select class="sel" ${pk('stat')}>${STATS.map(s => `<option ${o.stat === s.k ? 'selected' : ''}>${s.k}</option>`).join('')}</select></label><label class="pf">Dégâts <input class="in" ${pk('deg')} value="${esc(o.deg)}" placeholder="1d6"></label>`
      : o.type === 'armure' ? `<label class="pf">Réd. <input class="in num" ${pk('red')} value="${esc(o.red)}" placeholder="0"></label><label class="pf">Malus DEX <input class="in num" ${pk('mal')} value="${esc(o.mal)}" placeholder="0"></label>` : '';
    return `<div class="poss t-${esc(o.type)}" data-poss="${id}">
      <div class="pl1">
        <input class="in pn" id="f-poss-${id}" ${pk('nom')} value="${esc(o.nom)}" placeholder="Nom de l’objet" aria-label="Objet">
        <span class="pq">×<input class="in num" ${pk('qte')} value="${esc(o.qte)}" inputmode="numeric" aria-label="Quantité"></span>
        <span class="pact">
          ${estEquipable(o) ? `<button class="mini equip" data-equiper="${id}" title="${esc(EMPLACEMENTS[o.empl]?.l || '')}">Équiper</button>` : ''}
          ${o.type === 'consommable' ? `<button class="mini use" data-use="${id}" ${qteDe(o) < 1 ? 'disabled' : ''} title="Retire 1 de la quantité">Utiliser</button>` : ''}
          <button class="x edit-only" data-delposs="${id}" aria-label="Jeter">×</button>
        </span>
      </div>
      <div class="pl2 edit-only">
        <select class="sel" ${pk('type')} data-rerender-inv="1" aria-label="Type">${Object.entries(TYPES_OBJET).map(([k, l]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="sel" ${pk('empl')} data-rerender-inv="1" aria-label="Emplacement">${emplOpts}</select>
        ${det}
        <input class="in eff" ${pk('eff')} value="${esc(o.eff)}" placeholder="Effets" aria-label="Effets">
      </div>
      <div class="psum">${[TYPES_OBJET[o.type], o.empl ? EMPLACEMENTS[o.empl]?.court : '', resume(o), esc(o.eff)].filter(Boolean).join(' · ')}</div>
    </div>`;
  }
  function inventaireHTML() {
    const l = sacoche(C);
    return `<div class="invlist">${l.map(possHTML).join('') || '<p class="none" style="margin:0">L’inventaire est vide. Les achats de l’armurerie arrivent ici.</p>'}</div>
      <button class="add edit-only" data-addposs="arme">＋ Arme</button> <button class="add edit-only" data-addposs="armure">＋ Armure</button> <button class="add edit-only" data-addposs="consommable">＋ Consommable</button> <button class="add edit-only" data-addposs="equipement">＋ Objet</button>`;
  }
  const renderStatsMeta = () => STATS.forEach(s => { const m = q(`[data-meta="${s.k}"]`); if (m) m.innerHTML = statMeta(s.k); });
  const renderEquip = () => { q('#equip').innerHTML = equipHTML(); q('#inv').innerHTML = inventaireHTML(); verrouiller(); renderStatsMeta(); };

  /* ---------- Classe ---------- */
  const classPicker = () => `<div class="classes" role="radiogroup" aria-label="Classe">${Object.entries(CLASSES).map(([k, o]) => `<button class="cls" role="radio" data-classe="${k}" aria-pressed="${C.classe === k}" aria-checked="${C.classe === k}"><b>${o.nom}</b><small>${o.desc}</small></button>`).join('')}</div>`;
  function progressionHTML() {
    if (!C.classe) return '';
    const cl = CLASSES[C.classe];
    const rows = C.progression.map((p, i) => {
      const v = VOIE[p.voie];
      let tgt;
      if (v && v.cible === 'mot') tgt = `<input class="in tgt" id="f-prog-c-${i}" data-k="progression.${i}.cible" list="mots-list" value="${esc(p.cible)}" placeholder="Quel mot ?" aria-label="Mot concerné">`;
      else if (v && v.cible === 'partie') tgt = `<select class="sel tgt" id="f-prog-c-${i}" data-k="progression.${i}.cible" data-rerender="1" aria-label="Partie du corps"><option value="">Partie du corps…</option>${CORPS.map(c => `<option value="${c[0]}" ${p.cible === c[0] ? 'selected' : ''}>${c[0]} · ${c[1]}</option>`).join('')}</select>`;
      else if (v && v.cible === 'texte') tgt = `<input class="in tgt" id="f-prog-c-${i}" data-k="progression.${i}.cible" value="${esc(p.cible)}" placeholder="Objet remplacé → nouvel objet" aria-label="Échange">`;
      else tgt = '<span class="tgt"></span>';
      return `<div class="progrow"><span class="n">Niv. ${i + 2}</span><select class="sel" id="f-prog-v-${i}" data-k="progression.${i}.voie" data-rerender="1" aria-label="Voie de progression"><option value="">Voie choisie…</option>${cl.voies.map(x => `<option value="${x.k}" ${p.voie === x.k ? 'selected' : ''}>${esc(x.l)}</option>`).join('')}</select>${tgt}<button class="x edit-only" data-del="progression.${i}" aria-label="Retirer ce niveau">×</button></div>`;
    }).join('');
    return `<div class="block" style="margin-top:18px"><h2 style="font-size:1.1rem">Progression <span class="sub">une voie par niveau gagné</span><span class="tools edit-only"><button class="btn" data-action="levelup">Passer au niveau ${niveau(C) + 1}</button></span></h2>
      <div class="prog">${rows || "<p class=\"none\" style=\"margin:0\">Niveau 1 : aucune progression pour l'instant.</p>"}</div></div>`;
  }
  const motBonus = m => { if (!m) return 0; const w = m.trim().toLowerCase(); return 3 * C.progression.filter(p => p.voie === 'mot' && String(p.cible || '').trim().toLowerCase() === w).length; };
  function classBody() {
    if (!C.classe) return '<p class="none">Choisissez la voie de pratique de la magie. Beaucoup de points de magie : Magicien. Une santé de fer : Sorcier. De la chance : Devin ou Portesac.</p>';
    const k = C.classe;
    if (k === 'magicien') {
      const natures = (v, i) => `<select class="sel" id="f-motcat-${i}" data-k="mots.${i}.cat" data-spell="1" aria-label="Nature du mot"><option value="">—</option>${['verbe', 'nom', 'adjectif'].map(c => `<option value="${c}" ${v === c ? 'selected' : ''}>${CATEGORIES_MOT[c]}</option>`).join('')}</select>`;
      const rows = C.mots.map((m, i) => `<tr><td><input class="in" id="f-mot-${i}" data-k="mots.${i}.mot" value="${esc(m.mot)}" placeholder="Tilglhar" aria-label="Mot" style="font-family:var(--f-fell);font-size:1.05rem"></td><td><input class="in" id="f-sens-${i}" data-k="mots.${i}.sens" value="${esc(m.sens)}" placeholder="lancer" aria-label="Sens"></td><td style="width:10em">${natures(m.cat || '', i)}</td><td class="num" data-motbonus="${i}" style="width:4em"></td><td class="edit-only" style="width:30px"><button class="x" data-del="mots.${i}" aria-label="Retirer">×</button></td></tr>`).join('');
      return `<div class="chips" id="cls-chips"></div>
        <div class="scroll"><table class="gear mots"><thead><tr><th>Mot de l'ancien langage</th><th>Sens</th><th>Nature</th><th>Bonus</th><th class="edit-only"></th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="lexpick edit-only">
          <span class="lbl">APPRENDRE UN MOT DU LEXIQUE</span>
          <input class="search" id="lexq" type="search" value="${esc(lexQ)}" placeholder="Chercher un sens ou un mot : « flamme », « Lasair »…" autocomplete="off" aria-label="Chercher dans le lexique">
          <div class="lexres" id="lexres"><span class="none">Chargement du lexique…</span></div>
          <button class="add" data-addrow="mots">＋ Mot hors lexique</button>
        </div>
        <p class="hint">Trois mots au départ, dont au moins un verbe ; évitez les adverbes.</p>
        <div class="calc"><span class="lbl">COMPOSER UN SORT</span>
          <p class="hint" style="margin:2px 0 8px">Cliquez sur les mots dans l'ordre de la formule : les liaisons de grammaire s'ajoutent toutes seules.</p>
          <div class="wordpick" id="wordpick"></div>
          <div class="seq" id="spellseq"></div>
          <div class="res" id="spellres"></div>
        </div>
        <details class="ref"><summary>GRAMMAIRE DE L'ANCIEN LANGAGE</summary><table>${GRAMMAIRE.map(g => `<tr><td>${esc(g.r)}</td><td style="font-family:var(--f-fell);font-size:1.05rem">${esc(g.p)}</td></tr>`).join('')}</table>
          <p class="hint">Pour une boule de feu : LANCER + FLAMME. Pour devenir invisible : DEVENIR + son nom + INVISIBLE. Plusieurs formulations sont possibles pour un même sort.</p></details>
        <details class="ref"><summary>BARÈME DES SORTS</summary><table><tr><th>Mots</th><th>Coût</th><th>Difficulté (1d20)</th><th></th></tr>${[1, 2, 3, 4, 5, 6].map(n => `<tr><td>${n}${n === 6 ? '+' : ''}</td><td>${COUT[n]} PM</td><td>${DIFF[n]}${n === 6 ? '+' : ''}</td><td>${DIFF_TXT[n]}</td></tr>`).join('')}</table></details>`;
    }
    if (k === 'devin') return `<div class="chips" id="cls-chips"></div>
        <p class="hint" style="font-style:normal">Déclarer l'action, sacrifier autant de points de magie ou de chance que de cartes à tirer, en garder une ; les autres sont défaussées. Le seuil est fixé par le MJ (20 au plus). Les cartes se renouvellent avec les points de magie.</p>`;
    if (k === 'sorcier') {
      const rows = ZONES_CORPS.map(z => {
        const { tot, bonus, reu, et } = infoZone(z);
        return `<tr class="${et === 'temp' ? 'temp' : et === 'def' ? 'def' : ''}"><td class="rn">${z.r}</td><td>${z.n}${reu ? ' <span class="chip" style="padding:0 7px;font-size:.66rem">réutilisable</span>' : ''}</td><td class="pts">${tot}${bonus ? ` <small style="color:var(--gilt)">(+${bonus})</small>` : ''}</td><td class="num" style="color:var(--ink-soft)">${tot / 2}</td><td class="st"><select class="sel" id="f-corps-${z.k}" data-k="corps.${z.k}.etat" data-rerender="1" data-corps="1" aria-label="État : ${z.n}"><option value="intact" ${et === 'intact' ? 'selected' : ''}>Intact</option><option value="temp" ${et === 'temp' ? 'selected' : ''}>Sacrifié (temporaire)</option><option value="def" ${et === 'def' ? 'selected' : ''}>Sacrifié (définitif)</option></select></td></tr>`;
      }).join('');
      return `<div class="chips" id="cls-chips"></div>
        <div class="sorc">
          <div class="corpsfig">${silhouette()}<div class="leg"><span class="l-intact">intact</span><span class="l-temp">temporaire</span><span class="l-def">perdu</span><span class="l-sel">à sacrifier</span></div></div>
          <div class="sorcpanel"><div id="zonedetail">${detailZone()}</div><div id="prepa">${prepaHTML()}</div></div>
        </div>
        <details class="ref"${C.classe === 'sorcier' && lectureSeule ? ' open' : ''}><summary>TABLEAU DU CORPS</summary>
          <div class="scroll"><table class="body"><thead><tr><th></th><th>Partie du corps</th><th>Points</th><th>Temporaire</th><th>État</th></tr></thead><tbody>${rows}</tbody></table></div></details>
        <p class="hint">Jet de 1d12 + sacrifices pour dépasser le seuil sur 20. Un sacrifice temporaire vaut la moitié des points et coûte ${COUT_PV_SACRIFICE_TEMP} PV ; il se récupère avec les points de magie.</p>`;
    }
    if (k === 'portesac') {
      const slots = SAC.map((opts, i) => {
        const v = C.sac[i] || ''; const isOther = v && !opts.includes(v);
        return `<div class="slot"><span class="n">${i + 1}</span><div><select class="sel" id="f-sac-${i}" data-sac="${i}" aria-label="Objet n° ${i + 1}"><option value="">Choisir un objet…</option>${opts.map(o => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}<option value="__autre" ${isOther ? 'selected' : ''}>Autre (échange)…</option></select>${isOther ? `<input class="in" id="f-sacx-${i}" data-k="sac.${i}" value="${esc(v)}" aria-label="Objet échangé" style="margin-top:2px">` : ''}</div></div>`;
      }).join('');
      return `<div class="chips" id="cls-chips"></div><div class="sac">${slots}</div>
        <p class="hint">Un objet par numéro, parmi les trois proposés. En jeu, le dé désigne le numéro de l'objet qui sort du Sac.</p>`;
    }
    return '';
  }
  function classChips() {
    const k = C.classe; if (!k) return '';
    const chip = (l, v) => `<span class="chip">${l}<b>${v}</b></span>`;
    if (k === 'magicien') return chip('Maîtrise générale', '+' + compte(C, 'maitrise')) + chip('PM gagnés', '+' + 3 * compte(C, 'pm'));
    if (k === 'devin') return chip('Cartes dévoilées', compte(C, 'devoiler')) + chip('Remplacements', compte(C, 'remplacer')) + chip('Récupérations', compte(C, 'recuperer'));
    if (k === 'sorcier') { const v = Object.values(C.corps); return chip('PV gagnés', '+' + 3 * compte(C, 'pv')) + chip('Sacrifices en cours', v.filter(x => x && x.etat === 'temp').length) + chip('Pertes définitives', v.filter(x => x && x.etat === 'def').length); }
    if (k === 'portesac') return chip('Duplication', compte(C, 'dupliquer') ? 'oui' : 'non') + chip('Tirages multiples', compte(C, 'tirages') ? 'oui' : 'non') + chip('Échanges', compte(C, 'echange')) + chip('Objets choisis', C.sac.filter(Boolean).length + ' / 12');
    return '';
  }
  /* Lexique : recherche et apprentissage d'un mot en un clic */
  function renderLex() {
    const el = q('#lexres'); if (!el) return;
    if (LEX === null) {
      LEX = 'chargement';
      lexique.lister().then(l => { LEX = l; renderLex(); }).catch(() => { LEX = false; renderLex(); });
      return;
    }
    if (LEX === 'chargement') return;
    if (LEX === false) { el.innerHTML = '<span class="none">Lexique indisponible pour le moment. Vous pouvez saisir un mot à la main.</span>'; return; }
    const connus = new Set(C.mots.map(m => String(m.mot || '').trim().toLowerCase()).filter(Boolean));
    const res = chercher(LEX, lexQ);
    if (!res.length) { el.innerHTML = `<span class="none">${LEX.length ? 'Aucun mot ne correspond.' : 'Le lexique est vide : le MJ peut le remplir depuis la page Lexique.'}</span>`; return; }
    el.innerHTML = ['verbe', 'nom', 'adjectif'].map(c => {
      const l = res.filter(m => m.categorie === c); if (!l.length) return '';
      return `<div class="lexgrp"><div class="lexh">${esc(CATEGORIES_MOT[c])}s <small>${l.length}</small></div><div class="lexchips">${l.map(m => {
        const su = connus.has(m.ancien.trim().toLowerCase());
        return `<button class="lexw${su ? ' su' : ''}" data-learn="${esc(m.id)}" ${su ? 'disabled title="Déjà connu"' : `title="Apprendre ${esc(m.ancien)} (${esc(m.fr)})"`}><b>${esc(m.ancien)}</b><span>${esc(m.fr)}</span></button>`;
      }).join('')}</div></div>`;
    }).join('');
  }
  function apprendre(id) {
    const m = (Array.isArray(LEX) ? LEX : []).find(x => x.id === id); if (!m) return;
    const mot = { mot: m.ancien, sens: m.fr, cat: m.categorie, lex: m.id };
    const vide = C.mots.findIndex(x => !String(x.mot || '').trim() && !String(x.sens || '').trim());
    if (vide >= 0) C.mots[vide] = mot; else C.mots.push(mot);
    persist(); renderClass(); toast(`${m.ancien} (${m.fr}) appris`);
    const qi = q('#lexq'); if (qi && lexQ) { qi.focus(); qi.setSelectionRange(lexQ.length, lexQ.length); }
  }

  /* Composition d'un sort : suite de mots dans l'ordre, incantation avec liaisons, coût */
  function renderSpell() {
    const wp = q('#wordpick'); if (!wp) return;
    const mots = C.mots.map((m, i) => ({ ...m, i })).filter(m => String(m.mot || '').trim());
    wp.innerHTML = (mots.length ? mots.map(m => `<button class="wchip c-${esc(m.cat || 'x')}" data-compose="${m.i}" title="${esc(m.sens || '')}${m.cat ? ' · ' + esc(CATEGORIES_MOT[m.cat]) : ''}"><b>${esc(m.mot)}</b>${m.sens ? `<span>${esc(m.sens)}</span>` : ''}</button>`).join('') : '<span class="none">Apprenez des mots pour composer un sort.</span>')
      + `<span class="propre"><input class="in" id="propre" placeholder="Nom propre (cible)" aria-label="Nom propre"><button class="mini" data-propre="1">＋</button></span>`;
    const sq = q('#spellseq'), res = q('#spellres');
    if (!seq.length) { sq.innerHTML = ''; res.innerHTML = '<span>Cliquez sur les mots du sort, dans l’ordre.</span>'; return; }
    const formule = incantation(seq.map(x => ({ ancien: x.mot, categorie: x.cat })));
    sq.innerHTML = `<div class="seqchips">${seq.map((x, k) => `<span class="sq c-${esc(x.cat || 'x')}">${esc(x.mot)}<button data-unseq="${k}" aria-label="Retirer ${esc(x.mot)}">×</button></span>`).join('<span class="plus">+</span>')}<button class="linkbtn" data-clearseq="1">tout effacer</button></div>
      <div class="incant"><span class="formule">« ${esc(formule)} »</span><button class="mini" data-copyincant="1">Copier</button></div>
      <div class="sens">${seq.map(x => esc(x.cat === 'propre' ? x.mot : (x.sens || x.mot))).join(' + ')}</div>`;
    sq.dataset.formule = formule;
    const n = seq.filter(x => x.cat !== 'propre').length;
    if (!n) { res.innerHTML = '<span>Ajoutez au moins un mot de l’ancien langage.</span>'; return; }
    const m = Math.min(n, 6), maitrise = compte(C, 'maitrise'), spec = Math.max(0, ...seq.map(x => motBonus(x.mot)));
    const bonus = maitrise + spec, diff = DIFF[m], need = Math.max(1, diff - bonus + 1);
    const sansVerbe = seq.filter(x => x.cat !== 'propre').every(x => x.cat && x.cat !== 'verbe');
    res.innerHTML = `<span>Coût <b>${COUT[m]}${n > 6 ? '+' : ''} PM</b></span><span>Seuil <b>${diff}${n > 6 ? '+' : ''}</b></span><span>Bonus <b>+${bonus}</b></span><span>Dé à obtenir <b>${need > 20 ? 'impossible' : need + ' ou plus'}</b></span><span style="flex-basis:100%;font-family:var(--f-body);letter-spacing:0;font-style:italic">${DIFF_TXT[m]}</span>${sansVerbe ? '<span class="warn" style="flex-basis:100%">Ce sort ne contient aucun verbe : il faut connaître le mot de l’action.</span>' : ''}`;
  }
  /* ---------- Sorcier : silhouette, détail d'une zone, préparation d'un sacrifice ---------- */
  const infoZone = z => infoZoneDe(C, z);
  const silhouette = () => silhouetteSVG(C, { prepa, actif: zoneActive });
  function detailZone() {
    const z = ZONES_CORPS.find(x => x.k === zoneActive);
    if (!z) return '<p class="none" style="margin:0">Touchez une partie du corps pour voir sa valeur et la préparer pour un sacrifice.</p>';
    const { tot, bonus, reu, et } = infoZone(z);
    const peutT = et === 'intact' || (et === 'temp' && reu), peutD = et !== 'def';
    const etat = et === 'intact' ? 'Intact' : et === 'temp' ? 'Sacrifié temporairement' : 'Perdu définitivement';
    return `<div class="zd"><div class="zt"><span class="rn">${z.r}</span><b>${esc(z.n)}</b><span class="etat e-${et}">${etat}</span></div>
      <div class="zv"><span>Valeur <b>${tot}</b>${bonus ? ` <small>(dont +${bonus} de progression)</small>` : ''}</span><span>En temporaire <b>${tot / 2}</b></span>${reu ? '<span class="chip">réutilisable</span>' : ''}</div>
      <div class="zc"><span class="lbl">SI PERDU DÉFINITIVEMENT</span>${esc(PERTES[z.k]?.t || '—')}</div>
      <div class="za">${prepa[z.k] ? `<button class="mini" data-prepa="${z.k}" data-mode="">Retirer du sacrifice</button>` : `${peutT ? `<button class="mini" data-prepa="${z.k}" data-mode="temp">Sacrifier (temporaire)</button>` : ''}${peutD ? `<button class="mini danger" data-prepa="${z.k}" data-mode="def">Sacrifier (définitif)</button>` : ''}`}
        ${et === 'temp' ? `<button class="mini" data-recup="${z.k}">Récupérer</button>` : ''}</div></div>`;
  }
  function prepaHTML() {
    const l = Object.entries(prepa).map(([k, m]) => { const z = ZONES_CORPS.find(x => x.k === k); const { tot } = infoZone(z); return { z, m, v: m === 'temp' ? tot / 2 : tot }; });
    const hist = (C.sacrifices || []).slice(0, 4).map(h => `<li>${esc(new Date(h.d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))} · ${esc(h.t)}</li>`).join('');
    const nbTemp = Object.values(C.corps).filter(x => x && x.etat === 'temp').length;
    const pied = `<div class="minuit"><button class="btn" data-minuit="1" ${nbTemp ? '' : 'disabled'} title="Les points de magie reviennent à minuit, et avec eux les parties sacrifiées temporairement">🌑 Minuit : récupérer ${nbTemp ? `(${nbTemp})` : ''}</button></div>${hist ? `<ul class="hist">${hist}</ul>` : ''}`;
    if (!l.length) return `<div class="prep vide"><span class="lbl">PRÉPARER UN SACRIFICE</span><p class="none" style="margin:4px 0 0">Choisissez les parties à offrir, puis lancez le d12 à la table.</p></div>${pied}`;
    const S = l.reduce((a, x) => a + x.v, 0), seuil = int(C.seuilSorcier);
    const coutPV = l.filter(x => x.m === 'temp').length * COUT_PV_SACRIFICE_TEMP;
    let chance = '';
    if (seuil != null) {
      const need = seuil - S + 1, faces = need <= 1 ? 12 : need > 12 ? 0 : 13 - need;
      chance = need <= 1 ? '<b class="ok">Réussite assurée</b>' : need > 12 ? '<b class="ko">Impossible : il faut sacrifier davantage</b>' : `Il faut <b>${need} ou plus</b> au d12 · <b>${Math.round(faces / 12 * 100)} %</b> de chances`;
    }
    return `<div class="prep"><span class="lbl">PRÉPARER UN SACRIFICE</span>
      <ul>${l.map(x => `<li><span>${esc(x.z.n)}</span><span class="m m-${x.m}">${x.m === 'temp' ? 'temporaire' : 'définitif'}</span><b>${x.v}</b><button class="x" data-prepa="${x.z.k}" data-mode="" aria-label="Retirer">×</button></li>`).join('')}</ul>
      <div class="tot">Sacrifices <b>${S}</b> <label>Seuil <input class="in num" id="f-seuil" data-k="seuilSorcier" inputmode="numeric" value="${esc(C.seuilSorcier ?? '')}" placeholder="/20"></label></div>
      <div class="chance">${seuil == null ? 'Indiquez le seuil fixé par le MJ.' : chance}</div>
      ${coutPV ? `<div class="cout">Coût : <b>${coutPV} PV</b>${l.some(x => x.m === 'def') ? ' · pertes définitives appliquées' : ''}</div>` : l.some(x => x.m === 'def') ? '<div class="cout">Les pertes définitives seront appliquées à la fiche.</div>' : ''}
      <div class="row"><button class="btn primary" data-sacrifier="1">Sacrifier</button><button class="btn ghost" data-annulerprepa="1">Annuler</button></div></div>${pied}`;
  }
  const renderSorc = () => {
    const f = q('.corpsfig .silhouette'); if (f) f.outerHTML = silhouette();
    const d = q('#zonedetail'); if (d) d.innerHTML = detailZone();
    const p = q('#prepa'); if (p) { const a = document.activeElement; const foc = a && a.id === 'f-seuil' ? a.selectionStart : null; p.innerHTML = prepaHTML(); if (foc != null) { const i = q('#f-seuil'); i.focus(); try { i.setSelectionRange(foc, foc); } catch (e) {} } }
    verrouiller();
  };
  function journal(t) { C.sacrifices = [{ d: new Date().toISOString(), t }, ...(C.sacrifices || [])].slice(0, 20); }
  function sacrifier() {
    const l = Object.entries(prepa); if (!l.length) return;
    const M = maxEffectifs(C), nbT = l.filter(([, m]) => m === 'temp').length;
    l.forEach(([k, m]) => { C.corps[k] = { ...(C.corps[k] || {}), etat: m }; });
    if (nbT && M.pv != null) C.cur.pv = Math.max(0, actuel(C, 'pv', M.pv) - nbT * COUT_PV_SACRIFICE_TEMP);
    journal(l.map(([k, m]) => `${ZONES_CORPS.find(z => z.k === k).n} (${m === 'temp' ? 'temp.' : 'définitif'})`).join(', '));
    const ranges = rangerBloques(C);
    prepa = {}; persist(); renderClass(); renderDerived(); renderEquip();
    toast(`Sacrifice accompli${nbT ? ` · −${nbT * COUT_PV_SACRIFICE_TEMP} PV` : ''}${ranges.length ? ` · ${ranges.join(', ')} rangé${ranges.length > 1 ? 's' : ''}` : ''}`);
  }
  function minuit() {
    const rec = ZONES_CORPS.filter(z => C.corps[z.k]?.etat === 'temp');
    rec.forEach(z => { C.corps[z.k].etat = 'intact'; });
    C.cur.pm = null;
    if (rec.length) journal(`Minuit : ${rec.map(z => z.n).join(', ')} récupéré${rec.length > 1 ? 's' : ''}`);
    persist(); renderClass(); renderDerived(); toast(`Minuit : ${rec.length} partie${rec.length > 1 ? 's' : ''} récupérée${rec.length > 1 ? 's' : ''}, points de magie restaurés`);
  }

  function renderClass() {
    q('#class-picker').innerHTML = classPicker();
    q('#class-body').innerHTML = classBody();
    q('#class-prog').innerHTML = progressionHTML();
    renderClassComputed(); verrouiller();
  }
  function renderClassComputed() {
    const ch = q('#cls-chips'); if (ch) ch.innerHTML = classChips();
    qq('[data-motbonus]').forEach(td => { const b = motBonus((C.mots[+td.dataset.motbonus] || {}).mot); td.textContent = b ? '+' + b : ''; });
    renderSpell(); renderLex();
    q('#lvl').textContent = niveau(C);
  }
  function renderDerived() {
    STATS.forEach(s => { const m = q(`[data-meta="${s.k}"]`); if (m) m.innerHTML = statMeta(s.k); const n = int(C.stats[s.k]); const bar = q(`#st-${s.k} .meter i`); if (bar) bar.style.width = (n == null ? 0 : Math.max(0, Math.min(100, (n - 15) / 75 * 100))) + '%'; });
    qq('[data-joker]').forEach(b => b.disabled = C.joker || !C.rolls[b.dataset.joker]);
    q('#jokerstate').textContent = C.joker ? 'Joker utilisé' : 'Joker disponible : une relance';
    renderGauges();
    const eq = q('#equip'); if (eq) eq.innerHTML = equipHTML();
    q('#ent-avg').innerHTML = ententeAvg();
    renderClassComputed();
  }
  function renderPortrait() {
    q('#portrait').innerHTML = C.portrait ? `<img src="${esc(C.portrait)}" alt="Portrait de ${esc(C.nom || 'personnage')}">` : `<span>${lectureSeule ? 'PAS DE PORTRAIT' : 'AJOUTER UN PORTRAIT'}</span>`;
    q('#rmportrait').hidden = !C.portrait;
  }
  const syncClassName = () => { q('#clsname').textContent = C.classe ? CLASSES[C.classe].nom : '—'; };

  /* Lecture seule : rien n'est modifiable */
  function verrouiller() {
    if (!lectureSeule) return;
    qq('input, textarea').forEach(i => { if (i.type === 'checkbox') return; i.readOnly = true; });
    qq('select').forEach(s => s.disabled = true);
  }

  function render() {
    q('#sheet').innerHTML = `
    <div class="head">
      <div><button class="portrait" id="portrait" type="button" aria-label="Choisir un portrait"></button><button class="mini edit-only" id="rmportrait" style="margin-top:6px;width:100%" hidden>Retirer</button></div>
      <div class="ident">
        <div class="eyebrow">AYESHA · FICHE DE PERSONNAGE</div>
        <input class="in name" id="f-nom" data-k="nom" value="${esc(C.nom)}" placeholder="Nom du personnage" aria-label="Nom du personnage">
        <div class="row">
          <label><span class="lbl">JOUEUR</span><input class="in" id="f-joueur" data-k="joueur" value="${esc(C.joueur)}" placeholder="Nom du joueur"></label>
          <label><span class="lbl">CLASSE</span><span class="in" style="display:block;border-bottom-color:transparent;font-family:var(--f-fell);font-size:1.1rem" id="clsname"></span></label>
          <div class="lvl"><b id="lvl">1</b><small>NIVEAU</small></div>
        </div>
      </div>
    </div>

    <section class="block">
      <h2>Caractéristiques <span class="sub">sur 1d100 · réussite si le dé fait moins que la statistique</span><span class="tools edit-only"><span class="lbl" id="jokerstate" style="align-self:center"></span><button class="btn" data-action="rollall">Lancer les cinq</button><button class="btn" data-action="rollchance">Lancer la chance</button></span></h2>
      <p class="hint edit-only" style="margin:-4px 0 12px">Dés physiques ou fiche papier : tapez directement les valeurs dans les cases, y compris les maximums des jauges.</p>
      <div class="stats">${STATS.map(statCard).join('')}</div>
      <div class="gauges" id="gauges"></div>
      <div class="edit-only" style="display:flex;justify-content:flex-end;margin-top:6px"><button class="mini" data-action="restore" title="Remettre PV, PM, SM et chance au maximum">Tout remettre au maximum</button></div>
      <p class="hint">Réussite critique à 5 ou moins, échec critique à 95 ou plus. Les points de magie reviennent à minuit.</p>
    </section>

    <div class="cols">
      <section class="block"><h2>Talents <span class="sub">trois, sans jet de dé</span></h2><div class="lines">${talentsHTML()}</div></section>
      <section class="block"><h2>Entente <span class="sub">au moins 6/10 au départ</span></h2><div class="lines" id="entente">${ententeHTML()}</div><div id="ent-avg"></div></section>
    </div>

    <section class="block"><h2>Spécificités de classe</h2>
      <div id="class-picker"></div><div class="frame"><div id="class-body"></div><div id="class-prog"></div></div>
    </section>

    <section class="block"><h2>Équipement porté <span class="sub">un objet par emplacement · les armes à feu ne blessent pas les créatures de la Brume</span></h2><div id="equip">${equipHTML()}</div></section>

    <section class="block"><h2>Inventaire <span class="sub">ce que le personnage possède sans le porter</span></h2><div id="inv">${inventaireHTML()}</div></section>

    <div class="cols">
      <section class="block"><h2>Autres affaires <span class="sub">notes libres</span></h2><textarea class="ta" id="f-inv" data-k="inventaire" rows="6" placeholder="Voiture, planque, argent liquide, objets sans importance…">${esc(C.inventaire)}</textarea></section>
      <section class="block"><h2>Apparence <span class="sub">quelques mots suffisent</span></h2><textarea class="ta" id="f-app" data-k="apparence" rows="6" placeholder="Nuage de mots ou quelques phrases.">${esc(C.apparence)}</textarea></section>
    </div>
    <section class="block"><h2>Histoire <span class="sub">origines, parents, goûts, études, découverte de la magie</span></h2><textarea class="ta" id="f-hist" data-k="histoire" rows="8" placeholder="D'où vient le personnage, comment il est arrivé dans les études supérieures ou la vie active, et comment il a découvert la magie.">${esc(C.histoire)}</textarea></section>`;
    root.classList.toggle('reading', reading);
    root.classList.toggle('readonly', lectureSeule);
    renderPortrait(); renderClass(); renderDerived(); syncClassName(); verrouiller();
  }

  /* ---------- Actions ---------- */
  const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
  function rollStat(k) {
    const r = [d6(), d6(), d6()]; C.rolls[k] = r; C.stats[k] = String(r.reduce((a, b) => a + b, 0) * 5);
    q('#f-stat-' + k).value = C.stats[k];
    q('[data-dice="' + k + '"]').textContent = r.join(' + ') + ' = ' + r.reduce((a, b) => a + b, 0) + ' × 5';
    const card = q('#st-' + k); card.classList.remove('rolled'); void card.offsetWidth; card.classList.add('rolled');
  }
  function setPortrait(file) {
    const r = new FileReader(); r.onload = () => {
      const img = new Image(); img.onload = () => {
        const W = 360, H = 450, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
        const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s; g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        C.portrait = cv.toDataURL('image/jpeg', 0.82); persist(); renderPortrait();
      }; img.src = r.result;
    }; r.readAsDataURL(file);
  }

  root.addEventListener('input', e => {
    if (lectureSeule) return;
    const t = e.target;
    if (t.dataset.k) {
      setPath(C, t.dataset.k, t.value);
      if (/^stats\./.test(t.dataset.k)) { const k = t.dataset.k.slice(6); delete C.rolls[k]; const d = q('[data-dice="' + k + '"]'); if (d) d.textContent = ''; }
      if (t.dataset.k === 'chance') { C.chanceRoll = null; }
      persist();
      if (t.dataset.k === 'seuilSorcier') { renderSorc(); return; }
      if (/^mots\./.test(t.dataset.k)) { seq = seq.filter(x => x.cat === 'propre' || C.mots[x.i]); seq.forEach(x => { if (x.cat !== 'propre' && C.mots[x.i]) Object.assign(x, { mot: C.mots[x.i].mot, sens: C.mots[x.i].sens, cat: C.mots[x.i].cat || '' }); }); renderSpell(); }
      renderDerived();
    }
    if (t.dataset.pk) {
      const [id, f] = t.dataset.pk.split('.'); const o = C.possessions.find(x => x.id === id); if (!o) return;
      o[f] = t.value; persist();
      if (f === 'qte') { const b = t.closest('.poss')?.querySelector('[data-use]'); if (b) b.disabled = (int(t.value) || 0) < 1; }
    }
    if (t.dataset.max) {
      const k = t.dataset.max, v = t.value.trim();
      C.max[k] = v === '' ? '' : (int(v) == null ? C.max[k] : String(int(v)));
      persist(); renderGauges();
    }
    if (t.dataset.cur) {
      const k = t.dataset.cur, v = int(t.value);
      if (t.value.trim() === '' || v != null) { C.cur[k] = v == null ? null : Math.max(0, v); persist(); renderGauges(); }
    }
    if (t.id === 'lexq') { lexQ = t.value; renderLex(); }
  });
  root.addEventListener('change', e => {
    if (lectureSeule) return;
    const t = e.target;
    if (t.dataset.max) { // revenir au calcul si la valeur saisie est identique au calcul
      const k = t.dataset.max; if (int(C.max[k]) != null && int(C.max[k]) === maxCalcules(C)[k]) { C.max[k] = ''; persist(); }
      renderGauges();
    }
    if (t.dataset.rerenderInv) {
      const [id] = t.dataset.pk.split('.'); const o = C.possessions.find(x => x.id === id);
      if (o && t.dataset.pk.endsWith('.type') && !(EMPL_PAR_TYPE[o.type] || ['']).includes(o.empl)) { o.empl = (EMPL_PAR_TYPE[o.type] || [''])[0]; persist(); }
      renderEquip(); return;
    }
    if (t.dataset.spell) { seq.forEach(x => { if (x.cat !== 'propre' && C.mots[x.i]) x.cat = C.mots[x.i].cat || ''; }); renderSpell(); }
    if (t.dataset.corps) { const r = rangerBloques(C); if (r.length) toast(`${r.join(', ')} rangé${r.length > 1 ? 's' : ''} dans l’inventaire`); persist(); renderEquip(); }
    if (t.dataset.rerender) { renderClass(); renderDerived(); }
    if (t.dataset.sac !== undefined) { const i = +t.dataset.sac; C.sac[i] = t.value === '__autre' ? (C.sac[i] && !SAC[i].includes(C.sac[i]) ? C.sac[i] : 'Objet échangé') : t.value; persist(); renderClass(); if (t.value === '__autre') { const x = q('#f-sacx-' + i); x && x.select(); } }
    if (t.id === 'file-portrait' && t.files[0]) { setPortrait(t.files[0]); t.value = ''; }
  });
  root.addEventListener('keydown', e => {
    if (e.target.id === 'propre' && e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v) { seq.push({ mot: v, cat: 'propre' }); renderSpell(); } }
  });
  root.addEventListener('focusin', e => {
    if (e.target.getAttribute('list') === 'mots-list') q('#mots-list').innerHTML = C.mots.filter(m => String(m.mot || '').trim()).map(m => `<option value="${esc(m.mot.trim())}">`).join('');
  });
  root.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('[data-zone]'); if (!g || !root.contains(g)) return;
    zoneActive = zoneActive === g.dataset.zone ? null : g.dataset.zone; renderSorc();
  });
  root.addEventListener('keydown', e => {
    const g = e.target.closest && e.target.closest('[data-zone]'); if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); zoneActive = g.dataset.zone; renderSorc(); const n = q(`[data-zone="${zoneActive}"]`); n && n.focus();
  });
  root.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t || lectureSeule || !root.contains(t)) return;
    if (t.dataset.learn) { apprendre(t.dataset.learn); return; }
    if (t.dataset.prepa) { if (t.dataset.mode) prepa[t.dataset.prepa] = t.dataset.mode; else delete prepa[t.dataset.prepa]; renderSorc(); return; }
    if (t.dataset.annulerprepa) { prepa = {}; renderSorc(); return; }
    if (t.dataset.sacrifier) {
      if (Object.values(prepa).includes('def') && !await confirmer({ titre: 'Sacrifice définitif ?', texte: Object.entries(prepa).filter(([, m]) => m === 'def').map(([k]) => `<b>${esc(ZONES_CORPS.find(z => z.k === k).n)}</b> : ${esc(PERTES[k]?.t || '')}`).join('<br>') + '<br><br>Ces parties seront perdues pour toujours.', oui: 'Sacrifier', danger: true })) return;
      sacrifier(); return;
    }
    if (t.dataset.recup) { C.corps[t.dataset.recup].etat = 'intact'; journal(`${ZONES_CORPS.find(z => z.k === t.dataset.recup).n} récupéré`); persist(); renderClass(); renderDerived(); return; }
    if (t.dataset.minuit) { minuit(); return; }
    if (t.dataset.compose !== undefined) { const m = C.mots[+t.dataset.compose]; if (m) { seq.push({ i: +t.dataset.compose, mot: m.mot, sens: m.sens, cat: m.cat || '' }); renderSpell(); } return; }
    if (t.dataset.propre) { const inp = q('#propre'); const v = inp && inp.value.trim(); if (v) { seq.push({ mot: v, cat: 'propre' }); renderSpell(); } else if (inp) inp.focus(); return; }
    if (t.dataset.unseq !== undefined) { seq.splice(+t.dataset.unseq, 1); renderSpell(); return; }
    if (t.dataset.clearseq) { seq = []; renderSpell(); return; }
    if (t.dataset.copyincant) { const f = q('#spellseq')?.dataset.formule; if (f) copyText(f, 'Incantation copiée', 'Incantation'); return; }
    if (t.dataset.gauge) { C.cur[t.dataset.gauge] = +t.dataset.v; persist(); renderGauges(); return; }
    if (t.dataset.maxreset) { C.max[t.dataset.maxreset] = ''; persist(); renderGauges(); return; }
    if (t.dataset.ent !== undefined) { if (reading) return; C.entente[+t.dataset.ent].note = +t.dataset.v; persist(); q('#entente').innerHTML = ententeHTML(); q('#ent-avg').innerHTML = ententeAvg(); return; }
    if (t.dataset.roll) { rollStat(t.dataset.roll); persist(); renderDerived(); return; }
    if (t.dataset.joker) { if (C.joker) return; rollStat(t.dataset.joker); C.joker = true; persist(); renderDerived(); toast('Joker utilisé'); return; }
    if (t.dataset.classe) {
      if (reading) return;
      const k = t.dataset.classe; if (k === C.classe) return;
      if (C.progression.length && !await confirmer({ titre: 'Changer de classe ?', texte: `Les ${C.progression.length} niveaux de progression déjà choisis seront effacés.`, oui: `Changer pour ${CLASSES[k].nom}` })) return;
      C.classe = k; C.progression = []; persist(); renderClass(); renderDerived(); syncClassName(); return;
    }
    if (t.dataset.use) {   // ces actions marchent aussi en mode lecture, pendant la partie
      const o = C.possessions.find(x => x.id === t.dataset.use); if (!o) return;
      const reste = utiliser(C, o.id);
      toast(reste ? `${o.nom || 'Objet'} utilisé · reste ${reste}` : `${o.nom || 'Objet'} : épuisé, retiré de l’inventaire`);
      persist(); renderEquip(); return;
    }
    if (t.dataset.equiper) {
      const o = C.possessions.find(x => x.id === t.dataset.equiper);
      const refus = o && refusEquiper(C, o); if (refus) { toast(refus); return; }
      const renvoyes = equiper(C, t.dataset.equiper);
      persist(); renderEquip();
      toast(`${o?.nom || 'Objet'} équipé${renvoyes.length ? ' · ' + renvoyes.join(', ') + ' rangé' + (renvoyes.length > 1 ? 's' : '') + ' dans l’inventaire' : ''}`);
      return;
    }
    if (t.dataset.ranger) { ranger(C, t.dataset.ranger); persist(); renderEquip(); return; }
    if (t.dataset.addposs) {
      const type = t.dataset.addposs;
      const o = { id: nouvelId(), nom: '', type, empl: (EMPL_PAR_TYPE[type] || [''])[0], qte: 1, stat: type === 'arme' ? 'FOR' : '', deg: '', red: '', mal: '', eff: '', porte: '' };
      C.possessions.push(o); persist(); renderEquip(); const n = q(`#f-poss-${o.id}`); n && n.focus(); return;
    }
    if (t.dataset.delposs) {
      const o = C.possessions.find(x => x.id === t.dataset.delposs); if (!o) return;
      if (o.src === 'armurerie' && !await confirmer({ titre: `Jeter « ${esc(o.nom)} » ?`, texte: 'Cet objet a été acheté à l’armurerie. Il ne sera pas remboursé.', oui: 'Jeter', danger: true })) return;
      C.possessions.splice(C.possessions.indexOf(o), 1); persist(); renderEquip(); return;
    }
    if (t.dataset.addrow) {
      const k = t.dataset.addrow;
      const row = { mots: { mot: '', sens: '' } }[k]; if (!row) return;
      C[k].push(row); persist(); renderClass(); renderDerived(); return;
    }
    if (t.dataset.del) {
      const [k, i] = t.dataset.del.split('.'); C[k].splice(+i, 1); if (k === 'mots') seq = []; persist();
      renderClass(); renderDerived(); return;
    }
    if (t.id === 'portrait') { if (!reading) q('#file-portrait').click(); return; }
    if (t.id === 'rmportrait') { C.portrait = ''; persist(); renderPortrait(); return; }
    switch (t.dataset.action) {
      case 'rollall': {
        if (STATS.some(s => C.stats[s.k] !== '') && !await confirmer({ titre: 'Relancer les cinq caractéristiques ?', texte: 'Les valeurs actuelles seront remplacées, et le joker redevient disponible.', oui: 'Lancer les dés' })) return;
        STATS.forEach(s => rollStat(s.k)); C.joker = false; persist(); renderDerived(); break;
      }
      case 'rollchance': {
        if (C.chance !== '' && !await confirmer({ titre: 'Relancer la chance ?', texte: `La chance actuelle (${esc(C.chance)}) sera remplacée.`, oui: 'Lancer 3d6' })) return;
        const r = [d6(), d6(), d6()]; C.chance = String(r.reduce((a, b) => a + b, 0)); C.chanceRoll = r; C.cur.ch = null; persist(); renderGauges(); toast(`Chance : ${r.join(' + ')} = ${C.chance}`); break;
      }
      case 'levelup': C.progression.push({ voie: '', cible: '' }); persist(); renderClass(); renderDerived(); break;
      case 'restore': ['pv', 'pm', 'sm', 'ch'].forEach(k => C.cur[k] = null); persist(); renderGauges(); toast('Jauges remises au maximum'); break;
    }
  });

  render();
  return {
    render,
    setData(nv) { C = nv; seq = []; prepa = {}; zoneActive = null; render(); },
    lecture(on) { reading = lectureSeule || on; root.classList.toggle('reading', reading); },
    get data() { return C; },
  };
}
