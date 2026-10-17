/* =====================================================================
   Module Armurerie
   #/armurerie            boutique + compte en banque du joueur
   #/armurerie/comptes    (MJ) créditer / retirer, relevés des joueurs
   #/armurerie/catalogue  (MJ) gérer les objets en vente
   ===================================================================== */
import { $, $$, esc, toast, modal, confirmer, fmtDateHeure } from '../core/ui.js';
import { STATS } from '../shared/regles.js';
import { personnage } from '../shared/personnage.js';
import { banque, catalogue, euros, lireEuros, CATEGORIES, message } from '../shared/banque.js';

const avecQuantite = cat => cat === 'consommable' || cat === 'equipement' || cat === 'artefact';

function caracteristiques(it) {
  const p = [];
  if (it.categorie === 'arme') { p.push(`Teste <b>${esc(it.stat || 'FOR')}</b>`); if (it.degats) p.push(`Dégâts <b>${esc(it.degats)}</b>`); }
  if (it.categorie === 'armure') { if (it.reduction) p.push(`Réduction <b>${esc(it.reduction)}</b>`); if (it.malus) p.push(`Malus DEX <b>${esc(it.malus)}</b>`); }
  if (it.effets) p.push(`<span class="eff">${esc(it.effets)}</span>`);
  return p.join('');
}

/* ---------- Solde affiché dans la barre du haut ---------- */
let badgeEl = null, badgeEcoute = false;
async function majBadge() {
  if (!badgeEl || !badgeEl.isConnected) return;
  try { const s = await banque.solde(); badgeEl.innerHTML = `<a class="solde-chip${s < 0 ? ' neg' : ''}" href="#/armurerie" title="Votre compte en banque">${euros(s)}</a>`; }
  catch (e) { badgeEl.innerHTML = ''; }
}

export default {
  id: 'armurerie',
  titre: 'Armurerie',
  acces: 'joueur',
  nav: { label: 'Armurerie', ordre: 30 },
  carte: { titre: 'Armurerie', texte: "Équiper son personnage d'armes, d'armures, d'objets et de consommables." },

  enTete(el, { auth }) {
    if (!auth.user || auth.isMJ) return;
    badgeEl = el; majBadge();
    if (!badgeEcoute) { badgeEcoute = true; banque.ecouter(t => { if (t === 'transaction') majBadge(); }); }
  },

  async mount(root, { auth, params }) {
    let vue = null, stop = null;
    const off = banque.ecouter((type) => { if (vue && vue.surChangement) vue.surChangement(type); });

    async function afficher(p) {
      const onglet = auth.isMJ && ['comptes', 'catalogue'].includes(p[0]) ? p[0] : 'boutique';
      const tabs = auth.isMJ ? `<nav class="tabs" aria-label="Armurerie">
          <a href="#/armurerie" ${onglet === 'boutique' ? 'aria-current="page"' : ''}>Boutique</a>
          <a href="#/armurerie/comptes" ${onglet === 'comptes' ? 'aria-current="page"' : ''}>Comptes des joueurs</a>
          <a href="#/armurerie/catalogue" ${onglet === 'catalogue' ? 'aria-current="page"' : ''}>Catalogue</a></nav>` : '';
      root.innerHTML = `<div class="armhead"><div><h2>Armurerie</h2><p>${auth.isMJ ? 'Gérez le catalogue et les comptes des joueurs.' : 'Les achats sont débités de votre compte et ajoutés directement à votre fiche.'}</p></div></div>${tabs}<div id="armview"><div class="loading">Chargement…</div></div>`;
      const el = $('#armview', root);
      vue = onglet === 'comptes' ? await vueComptes(el) : onglet === 'catalogue' ? await vueCatalogue(el) : await vueBoutique(el, auth);
    }

    await afficher(params);
    return {
      update: p => afficher(p),
      unmount() { off(); },
    };
  },
};

/* =====================================================================
   Boutique (joueur ; le MJ la voit aussi)
   ===================================================================== */
async function vueBoutique(el, auth) {
  const st = { cat: '', q: '', tout: false, items: [], releve: [], solde: 0, fiche: null, qte: {},
    releveOuvert: !window.matchMedia('(max-width: 860px)').matches };   // replié sur téléphone
  el.addEventListener('toggle', e => { if (e.target.classList?.contains('reldet')) st.releveOuvert = e.target.open; }, true);

  async function charger() {
    const [items, releve, fiche] = await Promise.all([
      catalogue.lister(),
      banque.releve(),
      personnage.charger({ forcer: true }).catch(() => null),
    ]);
    st.items = items.filter(i => i.visible); st.releve = releve; st.fiche = fiche;
    st.solde = releve.reduce((s, t) => s + Number(t.montant), 0);
  }

  function compteHTML() {
    const lignes = (st.tout ? st.releve : st.releve.slice(0, 6)).map(t => `<li><span class="d">${esc(fmtDateHeure(t.created_at))}</span><span class="m">${esc(t.motif)}</span><b class="${t.montant < 0 ? 'neg' : 'pos'}">${t.montant > 0 ? '+' : ''}${euros(t.montant)}</b></li>`).join('');
    return `<section class="compte">
      <div class="lbl">COMPTE EN BANQUE</div>
      <div class="solde${st.solde < 0 ? ' neg' : ''}" id="solde">${euros(st.solde)}</div>
      <details class="reldet" ${st.releveOuvert ? 'open' : ''}><summary class="lbl">RELEVÉ${st.releve.length ? ` · ${st.releve.length} opération${st.releve.length > 1 ? 's' : ''}` : ''}</summary>
      ${st.releve.length ? `<ul class="releve">${lignes}</ul>${st.releve.length > 6 ? `<button class="linkbtn" data-b="tout">${st.tout ? 'Réduire' : `Voir les ${st.releve.length} opérations`}</button>` : ''}` : '<p class="none">Aucune opération pour l’instant. Le MJ crédite les comptes au fil des enquêtes.</p>'}
      </details>
    </section>`;
  }

  function carte(it) {
    const q = avecQuantite(it.categorie) ? (st.qte[it.id] || 1) : 1;
    const total = it.prix * q, manque = total - st.solde;
    return `<article class="item cat-${it.categorie}">
      <div class="ic">${esc(CATEGORIES[it.categorie]?.s || '')}</div>
      <h3>${esc(it.nom)}</h3>
      <div class="carac">${caracteristiques(it)}</div>
      ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
      <div class="buy">
        <span class="prix">${euros(it.prix)}</span>
        ${avecQuantite(it.categorie) ? `<span class="qte"><button class="mini" data-b="moins" data-id="${it.id}" aria-label="Moins">−</button><input class="qin" data-qte="${it.id}" inputmode="numeric" value="${q}" aria-label="Quantité"><button class="mini" data-b="plus" data-id="${it.id}" aria-label="Plus">+</button></span>` : ''}
        <button class="btn primary" data-b="acheter" data-id="${it.id}" ${manque > 0 || !st.fiche ? 'disabled' : ''}>Acheter${q > 1 ? ' · ' + euros(total) : ''}</button>
      </div>
      ${manque > 0 ? `<div class="manque">Il manque ${euros(manque)}</div>` : ''}
    </article>`;
  }

  function render() {
    const cats = Object.keys(CATEGORIES).filter(c => st.items.some(i => i.categorie === c));
    const q = st.q.trim().toLowerCase();
    const items = st.items.filter(i => (!st.cat || i.categorie === st.cat) && (!q || (i.nom + ' ' + i.description + ' ' + i.effets).toLowerCase().includes(q)));
    el.innerHTML = `<div class="armlayout">
      ${compteHTML()}
      <section class="shop">
        ${!st.fiche ? `<div class="banner">Créez d’abord votre fiche de personnage pour pouvoir acheter : les objets y sont ajoutés automatiquement. <a href="#/fiche">Ma fiche →</a></div>` : ''}
        <div class="shopbar">
          <div class="chips">${cats.length > 1 ? [`<button class="chip" data-cat="" aria-pressed="${!st.cat}">Tout</button>`, ...cats.map(c => `<button class="chip" data-cat="${c}" aria-pressed="${st.cat === c}">${CATEGORIES[c].l}</button>`)].join('') : ''}</div>
          <input class="search" id="armq" type="search" placeholder="Chercher…" value="${esc(st.q)}" autocomplete="off">
        </div>
        <div class="items">${items.map(carte).join('') || `<p class="none">${st.items.length ? 'Aucun objet ne correspond.' : 'L’armurerie est encore vide. Le MJ y ajoutera de l’équipement.'}</p>`}</div>
      </section>
    </div>`;
  }
  function majCartes() { // sans toucher au champ de recherche
    const a = document.activeElement, id = a && a.id, s = a && a.selectionStart;
    render();
    if (id) { const e = document.getElementById(id); if (e) { e.focus(); try { e.setSelectionRange(s, s); } catch (x) {} } }
  }

  async function acheter(id) {
    const it = st.items.find(i => i.id === id); if (!it) return;
    const q = avecQuantite(it.categorie) ? (st.qte[id] || 1) : 1, total = it.prix * q;
    const ou = it.categorie === 'arme' ? 'vos armes' : it.categorie === 'armure' ? 'vos armures' : 'vos objets & consommables';
    if (!await confirmer({ titre: `Acheter ${esc(it.nom)}${q > 1 ? ' ×' + q : ''} ?`, texte: `<b>${euros(total)}</b> seront débités. Solde après l’achat : <b>${euros(st.solde - total)}</b>.<br>L’objet sera ajouté à ${ou} sur votre fiche.`, oui: 'Acheter' })) return;
    try {
      if (personnage.statut === 'attente' || personnage.statut === 'envoi') await personnage.envoyer();
      await banque.acheter(id, q);
      st.qte[id] = 1;
      await charger(); render();
      toast(`${it.nom}${q > 1 ? ' ×' + q : ''} ajouté à votre fiche`);
    } catch (e) { toast('Achat impossible : ' + message(e)); await charger(); render(); }
  }

  el.addEventListener('click', e => {
    const t = e.target.closest('[data-b],[data-cat]'); if (!t) return;
    if (t.dataset.cat !== undefined) { st.cat = t.dataset.cat; render(); return; }
    const id = t.dataset.id;
    if (t.dataset.b === 'tout') { st.tout = !st.tout; render(); }
    if (t.dataset.b === 'plus') { st.qte[id] = Math.min(99, (st.qte[id] || 1) + 1); majCartes(); }
    if (t.dataset.b === 'moins') { st.qte[id] = Math.max(1, (st.qte[id] || 1) - 1); majCartes(); }
    if (t.dataset.b === 'acheter') { t.disabled = true; acheter(id); }
  });
  el.addEventListener('input', e => {
    if (e.target.id === 'armq') { st.q = e.target.value; majCartes(); }
    if (e.target.dataset.qte) { const v = parseInt(e.target.value, 10); if (v >= 1) { st.qte[e.target.dataset.qte] = Math.min(99, v); majCartes(); } }
  });

  await charger(); render();
  return {
    async surChangement() { try { const avant = st.solde; await charger(); majCartes(); if (st.solde > avant) toast(`Compte crédité : ${euros(st.solde - avant)}`); } catch (e) {} },
  };
}

/* =====================================================================
   Comptes des joueurs (MJ)
   ===================================================================== */
async function vueComptes(el) {
  let joueurs = [], soldes = {}, ouvert = null, releve = [];
  async function charger() {
    const [j, s] = await Promise.all([personnage.tousLesJoueurs(), banque.tousLesSoldes()]);
    joueurs = j.filter(x => x.role !== 'mj' || x.perso); soldes = s;
    if (ouvert) releve = await banque.releve(ouvert);
  }
  const formMvt = id => `<span class="mvt"><input class="in eur" data-montant="${id}" inputmode="decimal" placeholder="0,00 €" aria-label="Montant"><input class="in" data-motif="${id}" placeholder="Motif (prime, amende…)" aria-label="Motif"><button class="btn" data-c="credit" data-id="${id}">Créditer</button><button class="btn danger" data-c="debit" data-id="${id}">Retirer</button></span>`;
  function render() {
    const total = joueurs.reduce((s, j) => s + (soldes[j.id] || 0), 0);
    el.innerHTML = `<section class="tous">
        <h3>Tous les joueurs</h3><p class="hint" style="margin:0 0 8px">Créditer ou retirer le même montant à chacun (prime de fin d’enquête, frais…).</p>
        ${formMvt('*')}
      </section>
      <div class="scroll"><table class="comptes">
        <thead><tr><th>Joueur</th><th>Personnage</th><th class="r">Solde</th><th>Mouvement</th><th></th></tr></thead>
        <tbody>${joueurs.map(j => `<tr class="${ouvert === j.id ? 'open' : ''}">
          <td><b>${esc(j.nom || 'Joueur')}</b></td><td>${esc(j.perso?.nom || '—')}</td>
          <td class="r solde${(soldes[j.id] || 0) < 0 ? ' neg' : ''}">${euros(soldes[j.id] || 0)}</td>
          <td>${formMvt(j.id)}</td>
          <td><button class="linkbtn" data-c="releve" data-id="${j.id}">${ouvert === j.id ? 'Masquer' : 'Relevé'}</button></td></tr>
          ${ouvert === j.id ? `<tr class="relrow"><td colspan="5">${releve.length ? `<ul class="releve">${releve.map(t => `<li><span class="d">${esc(fmtDateHeure(t.created_at))}</span><span class="m">${esc(t.motif)}</span><b class="${t.montant < 0 ? 'neg' : 'pos'}">${t.montant > 0 ? '+' : ''}${euros(t.montant)}</b></li>`).join('')}</ul>` : '<p class="none">Aucune opération.</p>'}</td></tr>` : ''}`).join('') || '<tr><td colspan="5" class="none">Aucun joueur inscrit.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="2">Total en circulation</td><td class="r">${euros(total)}</td><td colspan="2"></td></tr></tfoot>
      </table></div>`;
  }
  async function mouvement(id, signe) {
    const inp = el.querySelector(`[data-montant="${CSS.escape(id)}"]`), mot = el.querySelector(`[data-motif="${CSS.escape(id)}"]`);
    const c = lireEuros(inp.value);
    if (!c || c <= 0) { toast('Indiquez un montant positif, par exemple 150 ou 12,50.'); inp.focus(); return; }
    const montant = signe * c, motif = mot.value.trim();
    const cibles = id === '*' ? joueurs.filter(j => j.role !== 'mj') : joueurs.filter(j => j.id === id);
    if (!cibles.length) return;
    const qui = id === '*' ? `aux ${cibles.length} joueurs` : `à ${esc(cibles[0].nom)}`;
    if (id === '*' && !await confirmer({ titre: signe > 0 ? 'Créditer tous les joueurs ?' : 'Retirer à tous les joueurs ?', texte: `${euros(c)} ${signe > 0 ? 'seront crédités' : 'seront retirés'} ${qui}${motif ? ` (« ${esc(motif)} »)` : ''}.`, oui: 'Confirmer' })) return;
    try {
      for (const j of cibles) await banque.mouvement(j.id, montant, motif);
      toast(`${signe > 0 ? 'Crédité' : 'Retiré'} : ${euros(c)} ${id === '*' ? 'à chaque joueur' : '— ' + cibles[0].nom}`);
      await charger(); render();
    } catch (e) { toast('Opération impossible : ' + message(e)); }
  }
  el.addEventListener('click', async e => {
    const t = e.target.closest('[data-c]'); if (!t) return;
    if (t.dataset.c === 'releve') { ouvert = ouvert === t.dataset.id ? null : t.dataset.id; await charger(); render(); }
    if (t.dataset.c === 'credit') mouvement(t.dataset.id, 1);
    if (t.dataset.c === 'debit') mouvement(t.dataset.id, -1);
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.dataset.montant || e.target.dataset.motif)) { const id = e.target.dataset.montant || e.target.dataset.motif; mouvement(id, 1); } });
  await charger(); render();
  return { async surChangement(type) { if (type !== 'transaction') return; const a = document.activeElement; if (a && el.contains(a) && a.tagName === 'INPUT' && a.value) return; await charger(); render(); } };
}

/* =====================================================================
   Catalogue (MJ)
   ===================================================================== */
async function vueCatalogue(el) {
  let items = [];
  async function charger() { items = await catalogue.lister(); }
  function render() {
    const parCat = Object.keys(CATEGORIES).map(c => {
      const l = items.filter(i => i.categorie === c); if (!l.length) return '';
      return `<tbody><tr class="cathead"><th colspan="5">${CATEGORIES[c].l} <small>${l.length}</small></th></tr>${l.map(it => `<tr class="${it.visible ? '' : 'masque'}">
        <td><b>${esc(it.nom)}</b><div class="carac">${caracteristiques(it)}</div></td>
        <td class="r">${euros(it.prix)}</td>
        <td><button class="chip" data-k="vis" data-id="${it.id}" aria-pressed="${it.visible}" title="Visible des joueurs ?">${it.visible ? 'En vente' : 'Masqué'}</button></td>
        <td><button class="btn ghost" data-k="edit" data-id="${it.id}">Modifier</button></td>
        <td><button class="x" data-k="del" data-id="${it.id}" aria-label="Supprimer">×</button></td></tr>`).join('')}</tbody>`;
    }).join('');
    el.innerHTML = `<div class="catbar"><p class="hint" style="margin:0">Un objet masqué n’apparaît pas en boutique : pratique pour préparer un artefact avant qu’il soit découvert.</p><button class="btn primary" data-k="new">＋ Nouvel objet</button></div>
      <div class="scroll"><table class="cat">${parCat || '<tbody><tr><td class="none">Le catalogue est vide. Ajoutez un premier objet.</td></tr></tbody>'}</table></div>`;
  }
  function formulaire(it = { categorie: 'consommable', prix: 0, stat: 'FOR', visible: true }) {
    const m = modal(`<h3>${it.id ? 'Modifier' : 'Nouvel'} objet</h3>
      <form class="itemform" id="itemform">
        <label class="w2"><span class="lbl">NOM</span><input class="in" name="nom" required value="${esc(it.nom || '')}" autofocus></label>
        <label><span class="lbl">CATÉGORIE</span><select class="in" name="categorie">${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${it.categorie === k ? 'selected' : ''}>${c.s}</option>`).join('')}</select></label>
        <label><span class="lbl">PRIX (€)</span><input class="in" name="prix" inputmode="decimal" value="${esc(((it.prix || 0) / 100).toFixed(2).replace('.', ','))}"></label>
        <label class="f-arme"><span class="lbl">STAT TESTÉE</span><select class="in" name="stat">${STATS.map(s => `<option ${it.stat === s.k ? 'selected' : ''}>${s.k}</option>`).join('')}</select></label>
        <label class="f-arme"><span class="lbl">DÉGÂTS</span><input class="in" name="degats" value="${esc(it.degats || '')}" placeholder="1d6"></label>
        <label class="f-armure"><span class="lbl">RÉDUCTION</span><input class="in" name="reduction" value="${esc(it.reduction || '')}" placeholder="2"></label>
        <label class="f-armure"><span class="lbl">MALUS DEX</span><input class="in" name="malus" value="${esc(it.malus || '')}" placeholder="-5"></label>
        <label class="w2"><span class="lbl">EFFETS <small>(copiés sur la fiche)</small></span><input class="in" name="effets" value="${esc(it.effets || '')}" placeholder="Soigne 1d6 PV, brûle les esprits…"></label>
        <label class="w2"><span class="lbl">DESCRIPTION <small>(visible en boutique)</small></span><textarea class="in" name="description" rows="3">${esc(it.description || '')}</textarea></label>
        <label class="w2 check"><input type="checkbox" name="visible" ${it.visible ? 'checked' : ''}> En vente (visible des joueurs)</label>
        <div class="w2 err" id="iferr" hidden></div>
        <div class="row w2"><button class="btn primary" type="submit">Enregistrer</button><button class="btn" type="button" data-close>Annuler</button></div>
      </form>`);
    const f = $('#itemform', m);
    const sync = () => { const c = f.categorie.value; $$('.f-arme', f).forEach(x => x.hidden = c !== 'arme'); $$('.f-armure', f).forEach(x => x.hidden = c !== 'armure'); };
    f.categorie.addEventListener('change', sync); sync();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const prix = lireEuros(f.prix.value), err = $('#iferr', m);
      if (prix == null || prix < 0) { err.textContent = 'Prix illisible : écrivez par exemple 12 ou 12,50.'; err.hidden = false; return; }
      const data = { nom: f.nom.value.trim(), categorie: f.categorie.value, prix, stat: f.stat.value, degats: f.degats.value.trim(), reduction: f.reduction.value.trim(), malus: f.malus.value.trim(), effets: f.effets.value.trim(), description: f.description.value.trim(), visible: f.visible.checked };
      if (!data.nom) { err.textContent = 'Donnez un nom à l’objet.'; err.hidden = false; return; }
      if (it.id) data.id = it.id;
      try { await catalogue.enregistrer(data); m.close(); toast(it.id ? 'Objet modifié' : 'Objet ajouté au catalogue'); await charger(); render(); }
      catch (x) { err.textContent = 'Enregistrement impossible : ' + message(x); err.hidden = false; }
    });
  }
  el.addEventListener('click', async e => {
    const t = e.target.closest('[data-k]'); if (!t) return;
    const it = items.find(i => i.id === t.dataset.id);
    try {
      if (t.dataset.k === 'new') formulaire();
      if (t.dataset.k === 'edit' && it) formulaire(it);
      if (t.dataset.k === 'vis' && it) { await catalogue.enregistrer({ ...it, visible: !it.visible }); await charger(); render(); }
      if (t.dataset.k === 'del' && it) {
        if (!await confirmer({ titre: `Supprimer « ${esc(it.nom)} » ?`, texte: 'L’objet disparaît du catalogue. Les fiches et les relevés des joueurs qui l’ont acheté ne changent pas. Pour le retirer temporairement de la vente, masquez-le plutôt.', oui: 'Supprimer', danger: true })) return;
        await catalogue.supprimer(it.id); await charger(); render(); toast('Objet supprimé');
      }
    } catch (x) { toast('Opération impossible : ' + message(x)); }
  });
  await charger(); render();
  return { async surChangement(type) { if (type === 'item') { await charger(); render(); } } };
}
