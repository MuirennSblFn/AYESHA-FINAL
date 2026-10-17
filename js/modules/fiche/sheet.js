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
import { $, $$, esc, toast, modal, confirmer } from '../../core/ui.js';
import { STATS, CLASSES, VOIE, CORPS, SAC, COUT, DIFF, DIFF_TXT, TALENTS, JAUGES, d6 } from '../../shared/regles.js';
import { int, compte, niveau, malusArmure, bonusDegats, maxCalcules, maxEffectifs, actuel, formule } from '../../shared/personnage.js';

export function creerFiche(root, C, { lectureSeule = false, onChange = () => {} } = {}) {
  let reading = lectureSeule;
  let spellPick = new Set();
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
    const b = bonusDegats(n); if (b) parts.push(`<span title="Bonus de dégâts quand cette caractéristique est testée pour attaquer">dégâts <b>+${b}</b></span>`);
    if (k === 'DEX' && malusArmure(C)) parts.push(`<span title="Avec le malus d'armure">armuré <b>${n - malusArmure(C)}</b></span>`);
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
  function gearHTML() {
    const statSel = (i, v) => `<select class="sel" id="f-arm-stat-${i}" data-k="armes.${i}.stat" aria-label="Statistique testée">${STATS.map(s => `<option ${v === s.k ? 'selected' : ''}>${s.k}</option>`).join('')}</select>`;
    const arm = C.armes.map((a, i) => `<tr><td><input class="in" id="f-arm-n-${i}" data-k="armes.${i}.nom" value="${esc(a.nom)}" placeholder="Dague de Sombris" aria-label="Arme"></td><td style="width:6em">${statSel(i, a.stat)}</td><td style="width:6.5em"><input class="in" id="f-arm-d-${i}" data-k="armes.${i}.deg" value="${esc(a.deg)}" placeholder="1d6" aria-label="Dégâts"></td><td style="width:4em" class="num" data-armbonus="${i}"></td><td><input class="in" id="f-arm-e-${i}" data-k="armes.${i}.eff" value="${esc(a.eff)}" placeholder="—" aria-label="Effets"></td><td class="edit-only"><button class="x" data-del="armes.${i}" aria-label="Retirer">×</button></td></tr>`).join('');
    const amr = C.armures.map((a, i) => `<tr><td><input class="in" id="f-amr-n-${i}" data-k="armures.${i}.nom" value="${esc(a.nom)}" placeholder="Blouson renforcé" aria-label="Armure"></td><td style="width:6em"><input class="in num" id="f-amr-r-${i}" data-k="armures.${i}.red" value="${esc(a.red)}" placeholder="2" aria-label="Réduction"></td><td style="width:6.5em"><input class="in num" id="f-amr-m-${i}" data-k="armures.${i}.mal" value="${esc(a.mal)}" placeholder="-5" aria-label="Malus DEX"></td><td><input class="in" id="f-amr-e-${i}" data-k="armures.${i}.eff" value="${esc(a.eff)}" placeholder="—" aria-label="Effets"></td><td class="edit-only"><button class="x" data-del="armures.${i}" aria-label="Retirer">×</button></td></tr>`).join('');
    return `<div class="scroll"><table class="gear"><thead><tr><th>Arme</th><th>Stat</th><th>Dégâts</th><th>Bonus</th><th>Effets</th><th class="edit-only"></th></tr></thead><tbody>${arm || '<tr><td colspan="5" class="none">Aucune arme.</td></tr>'}</tbody></table></div>
      <button class="add edit-only" data-addrow="armes">＋ Ajouter une arme</button>
      <div class="scroll" style="margin-top:16px"><table class="gear"><thead><tr><th>Armure</th><th>Réduction</th><th>Malus DEX</th><th>Effets</th><th class="edit-only"></th></tr></thead><tbody>${amr || '<tr><td colspan="4" class="none">Aucune armure.</td></tr>'}</tbody></table></div>
      <button class="add edit-only" data-addrow="armures">＋ Ajouter une armure</button>`;
  }
  /* ---------- Objets & consommables ---------- */
  const qteDe = o => { const n = int(o.qte); return n == null ? 0 : n; };
  function objetsHTML() {
    const rows = C.objets.map((o, i) => `<tr class="${o.conso ? 'conso' : ''}">
      <td><input class="in" id="f-obj-n-${i}" data-k="objets.${i}.nom" value="${esc(o.nom)}" placeholder="${o.conso ? 'Trousse de soin' : 'Lampe UV'}" aria-label="Objet">${o.conso ? '<span class="otag">consommable</span>' : ''}</td>
      <td style="width:4.5em"><input class="in num oq" id="f-obj-q-${i}" data-k="objets.${i}.qte" inputmode="numeric" value="${esc(o.qte ?? '')}" placeholder="1" aria-label="Quantité"></td>
      <td><input class="in" id="f-obj-e-${i}" data-k="objets.${i}.eff" value="${esc(o.eff)}" placeholder="—" aria-label="Effets"></td>
      <td class="ouse">${o.conso ? `<button class="mini use" data-use="${i}" ${qteDe(o) < 1 ? 'disabled' : ''} title="Retire 1 de la quantité">Utiliser</button>` : ''}</td>
      <td class="edit-only"><button class="x" data-del="objets.${i}" aria-label="Retirer">×</button></td></tr>`).join('');
    return `<div class="scroll"><table class="gear objets"><thead><tr><th>Objet</th><th>Qté</th><th>Effets</th><th></th><th class="edit-only"></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="none">Aucun objet. Les achats de l’armurerie arrivent ici.</td></tr>'}</tbody></table></div>
      <button class="add edit-only" data-addrow="conso">＋ Ajouter un consommable</button> <button class="add edit-only" data-addrow="objet">＋ Ajouter un objet</button>`;
  }
  const renderObjets = () => { q('#objets').innerHTML = objetsHTML(); verrouiller(); };

  function armBonus(i) { const a = C.armes[i]; if (!a) return ''; const b = bonusDegats(int(C.stats[a.stat])); return b ? `+${b}` : ''; }

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
      const rows = C.mots.map((m, i) => `<tr><td><input class="in" id="f-mot-${i}" data-k="mots.${i}.mot" value="${esc(m.mot)}" placeholder="Tilhgar" aria-label="Mot" style="font-family:var(--f-fell);font-size:1.05rem"></td><td><input class="in" id="f-sens-${i}" data-k="mots.${i}.sens" value="${esc(m.sens)}" placeholder="lancer" aria-label="Sens"></td><td class="num" data-motbonus="${i}" style="width:4.5em"></td><td class="edit-only" style="width:30px"><button class="x" data-del="mots.${i}" aria-label="Retirer">×</button></td></tr>`).join('');
      return `<div class="chips" id="cls-chips"></div>
        <div class="scroll"><table class="gear"><thead><tr><th>Mot de l'ancien langage</th><th>Sens</th><th>Bonus</th><th class="edit-only"></th></tr></thead><tbody>${rows}</tbody></table></div>
        <button class="add edit-only" data-addrow="mots">＋ Ajouter un mot</button>
        <p class="hint">Trois mots au départ, dont au moins un verbe ; évitez les adverbes.</p>
        <div class="calc"><span class="lbl">COMPOSER UN SORT</span><div class="wordpick" id="wordpick"></div><div class="res" id="spellres"></div></div>
        <details class="ref"><summary>BARÈME DES SORTS</summary><table><tr><th>Mots</th><th>Coût</th><th>Difficulté (1d20)</th><th></th></tr>${[1, 2, 3, 4, 5, 6].map(n => `<tr><td>${n}${n === 6 ? '+' : ''}</td><td>${COUT[n]} PM</td><td>${DIFF[n]}${n === 6 ? '+' : ''}</td><td>${DIFF_TXT[n]}</td></tr>`).join('')}</table></details>`;
    }
    if (k === 'devin') return `<div class="chips" id="cls-chips"></div>
        <p class="hint" style="font-style:normal">Déclarer l'action, sacrifier autant de points de magie ou de chance que de cartes à tirer, en garder une ; les autres sont défaussées. Le seuil est fixé par le MJ (20 au plus). Les cartes se renouvellent avec les points de magie.</p>`;
    if (k === 'sorcier') {
      const rows = CORPS.map(([r, n, pts]) => {
        const bonus = 2 * C.progression.filter(p => p.voie === 'partie' && p.cible === r).length;
        const reu = C.progression.some(p => p.voie === 'reutil' && p.cible === r);
        const et = (C.corps[r] && C.corps[r].etat) || 'intact';
        const tot = pts + bonus;
        return `<tr class="${et === 'temp' ? 'temp' : et === 'def' ? 'def' : ''}"><td class="rn">${r}</td><td>${n}${reu ? ' <span class="chip" style="padding:0 7px;font-size:.66rem">réutilisable</span>' : ''}</td><td class="pts">${tot}${bonus ? ` <small style="color:var(--gilt)">(+${bonus})</small>` : ''}</td><td class="num" style="color:var(--ink-soft)">${tot / 2}</td><td class="st"><select class="sel" id="f-corps-${r}" data-k="corps.${r}.etat" data-rerender="1" aria-label="État : ${n}"><option value="intact" ${et === 'intact' ? 'selected' : ''}>Intact</option><option value="temp" ${et === 'temp' ? 'selected' : ''}>Sacrifié (temporaire)</option><option value="def" ${et === 'def' ? 'selected' : ''}>Sacrifié (définitif)</option></select></td></tr>`;
      }).join('');
      return `<div class="chips" id="cls-chips"></div>
        <div class="scroll"><table class="body"><thead><tr><th></th><th>Partie du corps</th><th>Points</th><th>Temporaire</th><th>État</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="hint">Jet de 1d12 + sacrifices pour dépasser le seuil sur 20. Un sacrifice temporaire vaut la moitié des points et coûte 2 PV ; il se récupère avec les points de magie.</p>`;
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
  function renderSpell() {
    const wp = q('#wordpick'); if (!wp) return;
    const words = C.mots.map(m => String(m.mot || '').trim()).filter(Boolean);
    spellPick = new Set([...spellPick].filter(w => words.includes(w)));
    wp.innerHTML = words.length ? words.map((w, i) => `<label><input type="checkbox" id="f-pick-${i}" data-pick="${esc(w)}" ${spellPick.has(w) ? 'checked' : ''}>${esc(w)}</label>`).join('') : '<span class="none">Ajoutez des mots pour composer un sort.</span>';
    const n = spellPick.size;
    if (!n) { q('#spellres').innerHTML = '<span>Cochez les mots du sort.</span>'; return; }
    const m = Math.min(n, 6), maitrise = compte(C, 'maitrise'), spec = Math.max(0, ...[...spellPick].map(motBonus));
    const bonus = maitrise + spec, diff = DIFF[m], need = Math.max(1, diff - bonus + 1);
    q('#spellres').innerHTML = `<span>Coût <b>${COUT[m]}${n > 6 ? '+' : ''} PM</b></span><span>Seuil <b>${diff}${n > 6 ? '+' : ''}</b></span><span>Bonus <b>+${bonus}</b></span><span>Dé à obtenir <b>${need > 20 ? 'impossible' : need + ' ou plus'}</b></span><span style="flex-basis:100%;font-family:var(--f-body);letter-spacing:0;font-style:italic">${DIFF_TXT[m]}</span>`;
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
    renderSpell();
    q('#lvl').textContent = niveau(C);
  }
  function renderDerived() {
    STATS.forEach(s => { const m = q(`[data-meta="${s.k}"]`); if (m) m.innerHTML = statMeta(s.k); const n = int(C.stats[s.k]); const bar = q(`#st-${s.k} .meter i`); if (bar) bar.style.width = (n == null ? 0 : Math.max(0, Math.min(100, (n - 15) / 75 * 100))) + '%'; });
    qq('[data-joker]').forEach(b => b.disabled = C.joker || !C.rolls[b.dataset.joker]);
    q('#jokerstate').textContent = C.joker ? 'Joker utilisé' : 'Joker disponible : une relance';
    renderGauges();
    qq('[data-armbonus]').forEach(td => td.textContent = armBonus(+td.dataset.armbonus));
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

    <section class="block"><h2>Armes &amp; armures <span class="sub">les armes à feu ne blessent pas les créatures de la Brume</span></h2><div id="gear">${gearHTML()}</div></section>

    <section class="block"><h2>Objets &amp; consommables <span class="sub">achetés à l'armurerie ou ajoutés à la main</span></h2><div id="objets">${objetsHTML()}</div></section>

    <div class="cols">
      <section class="block"><h2>Inventaire</h2><textarea class="ta" id="f-inv" data-k="inventaire" rows="6" placeholder="Sac à dos, poches, voiture… et les artefacts de l'armurerie.">${esc(C.inventaire)}</textarea></section>
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
      if (/^objets\.\d+\.qte$/.test(t.dataset.k)) { const b = t.closest('tr')?.querySelector('[data-use]'); if (b) b.disabled = (int(t.value) || 0) < 1; }
      persist();
      if (/^mots\./.test(t.dataset.k)) renderSpell();
      renderDerived();
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
    if (t.dataset.pick !== undefined) { t.checked ? spellPick.add(t.dataset.pick) : spellPick.delete(t.dataset.pick); renderSpell(); }
  });
  root.addEventListener('change', e => {
    if (lectureSeule) return;
    const t = e.target;
    if (t.dataset.max) { // revenir au calcul si la valeur saisie est identique au calcul
      const k = t.dataset.max; if (int(C.max[k]) != null && int(C.max[k]) === maxCalcules(C)[k]) { C.max[k] = ''; persist(); }
      renderGauges();
    }
    if (t.dataset.rerender) { renderClass(); renderDerived(); }
    if (t.dataset.sac !== undefined) { const i = +t.dataset.sac; C.sac[i] = t.value === '__autre' ? (C.sac[i] && !SAC[i].includes(C.sac[i]) ? C.sac[i] : 'Objet échangé') : t.value; persist(); renderClass(); if (t.value === '__autre') { const x = q('#f-sacx-' + i); x && x.select(); } }
    if (t.id === 'file-portrait' && t.files[0]) { setPortrait(t.files[0]); t.value = ''; }
  });
  root.addEventListener('focusin', e => {
    if (e.target.getAttribute('list') === 'mots-list') q('#mots-list').innerHTML = C.mots.filter(m => String(m.mot || '').trim()).map(m => `<option value="${esc(m.mot.trim())}">`).join('');
  });
  root.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t || lectureSeule || !root.contains(t)) return;
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
    if (t.dataset.use !== undefined) {   // fonctionne aussi en mode lecture, pendant la partie
      const o = C.objets[+t.dataset.use]; if (!o) return;
      const n = qteDe(o) - 1;
      if (n <= 0) { C.objets.splice(+t.dataset.use, 1); toast(`${o.nom || 'Objet'} : épuisé, retiré de la fiche`); }
      else { o.qte = n; toast(`${o.nom || 'Objet'} utilisé · reste ${n}`); }
      persist(); renderObjets(); return;
    }
    if (t.dataset.addrow) {
      const k = t.dataset.addrow;
      if (k === 'conso' || k === 'objet') { C.objets.push({ nom: '', qte: 1, eff: '', conso: k === 'conso' }); persist(); renderObjets(); const n = q(`#f-obj-n-${C.objets.length - 1}`); n && n.focus(); return; }
      const row = { armes: { nom: '', stat: 'FOR', deg: '', eff: '' }, armures: { nom: '', red: '', mal: '', eff: '' }, mots: { mot: '', sens: '' } }[k];
      C[k].push(row); persist(); if (k === 'mots') renderClass(); else q('#gear').innerHTML = gearHTML(); renderDerived(); return;
    }
    if (t.dataset.del) {
      const [k, i] = t.dataset.del.split('.'); C[k].splice(+i, 1); persist();
      if (k === 'objets') { renderObjets(); return; }
      if (k === 'armes' || k === 'armures') q('#gear').innerHTML = gearHTML(); else renderClass(); renderDerived(); return;
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
    setData(nv) { C = nv; spellPick = new Set(); render(); },
    lecture(on) { reading = lectureSeule || on; root.classList.toggle('reading', reading); },
    get data() { return C; },
  };
}
