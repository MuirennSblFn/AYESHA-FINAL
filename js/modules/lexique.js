/* =====================================================================
   Module Lexique de l'ancien langage
   Joueurs : consultation des mots (sauf ceux que le MJ a masqués).
   MJ : ajout, modification, masquage, suppression.
   ===================================================================== */
import { $, $$, esc, toast, modal, confirmer } from '../core/ui.js';
import { CATEGORIES_MOT, GRAMMAIRE } from '../shared/regles.js';
import { lexique, chercher } from '../shared/lexique.js';
import { message } from '../shared/banque.js';

export default {
  id: 'lexique',
  titre: 'Lexique',
  acces: 'joueur',
  nav: { label: 'Lexique', ordre: 25 },
  carte: { titre: 'Lexique de l’ancien langage', texte: 'Les mots des magiciens, leur sens et la grammaire des incantations.' },

  async mount(root, { auth }) {
    const mj = auth.isMJ;
    const st = { q: '', cat: '', mots: [] };
    root.innerHTML = '<div class="loading">Ouverture du lexique…</div>';

    async function charger() { st.mots = await lexique.lister({ forcer: true }); }

    function render() {
      const liste = chercher(st.mots, st.q).filter(m => !st.cat || m.categorie === st.cat);
      const groupes = ['verbe', 'nom', 'adjectif'].filter(c => !st.cat || st.cat === c).map(c => {
        const l = liste.filter(m => m.categorie === c); if (!l.length) return '';
        return `<section class="lexsec"><h3>${esc(CATEGORIES_MOT[c])}s <small>${l.length}</small></h3>
          <div class="lexgrid">${l.map(m => `<div class="lexcard${m.visible ? '' : ' masque'}">
            <div class="an">${esc(m.ancien)}</div><div class="fr">${esc(m.fr)}</div>
            ${m.notes ? `<div class="nt">${esc(m.notes)}</div>` : ''}
            ${mj ? `<div class="mjact"><button class="chip" data-l="vis" data-id="${m.id}" aria-pressed="${m.visible}">${m.visible ? 'Visible' : 'Masqué'}</button><button class="linkbtn" data-l="edit" data-id="${m.id}">Modifier</button><button class="x" data-l="del" data-id="${m.id}" aria-label="Supprimer">×</button></div>` : ''}
          </div>`).join('')}</div></section>`;
      }).join('');
      const masques = st.mots.filter(m => !m.visible).length;
      root.innerHTML = `<div class="lexhead"><div><h2>Lexique de l’ancien langage</h2>
          <p>${st.mots.length} mot${st.mots.length > 1 ? 's' : ''}${mj && masques ? ` · ${masques} masqué${masques > 1 ? 's' : ''} (invisibles des joueurs)` : ''}. ${mj ? 'Un mot masqué reste secret jusqu’à ce que vous le rendiez visible.' : 'Les magiciens apprennent ces mots depuis leur fiche.'}</p></div>
          ${mj ? '<button class="btn primary" data-l="new">＋ Nouveau mot</button>' : ''}</div>
        <div class="lexbar">
          <input class="search" id="lq" type="search" placeholder="Chercher un sens ou un mot…" value="${esc(st.q)}" autocomplete="off">
          <div class="chips">${[['', 'Tout'], ['verbe', 'Verbes'], ['nom', 'Noms'], ['adjectif', 'Adjectifs & adverbes']].map(([k, l]) => `<button class="chip" data-cat="${k}" aria-pressed="${st.cat === k}">${l}</button>`).join('')}</div>
        </div>
        <div class="lexbody">${groupes || `<p class="none">${st.mots.length ? 'Aucun mot ne correspond.' : (mj ? 'Le lexique est vide. Lancez supabase/lexique.sql dans Supabase, ou ajoutez des mots un par un.' : 'Le lexique est encore vide.')}</p>`}</div>
        <aside class="gram"><h3>Grammaire</h3><table>${GRAMMAIRE.map(g => `<tr><td>${esc(g.r)}</td><td class="p">${esc(g.p)}</td></tr>`).join('')}</table>
          <p>Il faut connaître le mot de l’action, le sujet concerné et l’adverbe ou l’adjectif correspondant, visualiser l’effet et ne pas quitter la cible des yeux.</p>
          <p><b>Exemples :</b> une boule de feu, LANCER + FLAMME ; devenir invisible, DEVENIR + son nom + INVISIBLE. Plusieurs formulations sont possibles pour un même sort, et l’on peut combiner des verbes : EMPÊCHER + ARRÊTER empêche l’adversaire de cesser ce qu’il fait.</p></aside>`;
    }
    function majListe() { // sans perdre la saisie dans la recherche
      const a = document.activeElement, id = a && a.id, s = a && a.selectionStart;
      render(); if (id) { const e = document.getElementById(id); if (e) { e.focus(); try { e.setSelectionRange(s, s); } catch (x) {} } }
    }

    function formulaire(m = { categorie: 'verbe', visible: true }) {
      const f = modal(`<h3>${m.id ? 'Modifier le mot' : 'Nouveau mot'}</h3>
        <form class="itemform" id="lexform">
          <label><span class="lbl">MOT DE L’ANCIEN LANGAGE</span><input class="in" name="ancien" required value="${esc(m.ancien || '')}" autofocus></label>
          <label><span class="lbl">SENS (FRANÇAIS)</span><input class="in" name="fr" required value="${esc(m.fr || '')}"></label>
          <label><span class="lbl">NATURE</span><select class="in" name="categorie">${['verbe', 'nom', 'adjectif'].map(c => `<option value="${c}" ${m.categorie === c ? 'selected' : ''}>${CATEGORIES_MOT[c]}</option>`).join('')}</select></label>
          <label class="check" style="align-self:end"><input type="checkbox" name="visible" ${m.visible ? 'checked' : ''}> Visible des joueurs</label>
          <label class="w2"><span class="lbl">NOTES <small>(facultatif, visibles des joueurs)</small></span><input class="in" name="notes" value="${esc(m.notes || '')}" placeholder="Usage, nuance, exemple…"></label>
          <div class="w2 err" id="lxerr" hidden></div>
          <div class="row w2"><button class="btn primary" type="submit">Enregistrer</button><button class="btn" type="button" data-close>Annuler</button></div>
        </form>`);
      $('#lexform', f).addEventListener('submit', async e => {
        e.preventDefault(); const F = e.target, err = $('#lxerr', f);
        const d = { ancien: F.ancien.value.trim(), fr: F.fr.value.trim(), categorie: F.categorie.value, notes: F.notes.value.trim(), visible: F.visible.checked };
        if (!d.ancien || !d.fr) { err.textContent = 'Indiquez le mot et son sens.'; err.hidden = false; return; }
        const doublon = st.mots.find(x => x.id !== m.id && x.fr.toLowerCase() === d.fr.toLowerCase() && x.categorie === d.categorie);
        if (doublon && !await confirmer({ titre: 'Sens déjà présent', texte: `« ${esc(d.fr)} » existe déjà (${esc(doublon.ancien)}). L’ajouter quand même ?`, oui: 'Ajouter' })) return;
        if (m.id) d.id = m.id;
        try { await lexique.enregistrer(d); f.close(); toast(m.id ? 'Mot modifié' : 'Mot ajouté'); await charger(); majListe(); }
        catch (x) { err.textContent = 'Enregistrement impossible : ' + message(x); err.hidden = false; }
      });
    }

    root.addEventListener('input', e => { if (e.target.id === 'lq') { st.q = e.target.value; majListe(); } });
    root.addEventListener('click', async e => {
      const t = e.target.closest('[data-l],[data-cat]'); if (!t) return;
      if (t.dataset.cat !== undefined) { st.cat = t.dataset.cat; render(); return; }
      if (!mj) return;
      const m = st.mots.find(x => x.id === t.dataset.id);
      try {
        if (t.dataset.l === 'new') formulaire();
        if (t.dataset.l === 'edit' && m) formulaire(m);
        if (t.dataset.l === 'vis' && m) { await lexique.enregistrer({ ...m, visible: !m.visible }); await charger(); majListe(); }
        if (t.dataset.l === 'del' && m) {
          if (!await confirmer({ titre: `Supprimer « ${esc(m.ancien)} » ?`, texte: 'Le mot disparaît du lexique. Les fiches des magiciens qui le connaissent ne changent pas. Pour le cacher temporairement, masquez-le plutôt.', oui: 'Supprimer', danger: true })) return;
          await lexique.supprimer(m.id); await charger(); majListe(); toast('Mot supprimé');
        }
      } catch (x) { toast('Opération impossible : ' + message(x)); }
    });

    try { await charger(); } catch (e) { root.innerHTML = `<div class="panel center"><h2>Lexique indisponible</h2><p>${esc(message(e))}</p><p class="hint">Avez-vous relancé schema.sql dans Supabase ?</p></div>`; return; }
    render();
  },
};
