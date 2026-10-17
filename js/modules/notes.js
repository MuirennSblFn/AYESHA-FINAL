/* =====================================================================
   Module Notes : le carnet de session de chaque joueur
   ---------------------------------------------------------------------
   Une note par session (titre, date, texte libre). Enregistrement
   automatique ; tant qu'un envoi n'a pas abouti, une copie reste sur
   l'appareil et l'envoi reprend. Personne d'autre, MJ compris, ne lit
   ces notes. Adresse directe : #/notes/<id>.
   ===================================================================== */
import { $, $$, esc, toast, confirmer, downloadFile } from '../core/ui.js';
import { notes, trier, aujourdhui, dateLongue } from '../shared/notes.js';
import { message } from '../shared/banque.js';
import { sansAccent } from '../shared/lexique.js';

const CLE = 'ayesha.notes.attente';       // modifications pas encore envoyées { id: {champs…} }
const lireAttente = () => { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch (e) { return {}; } };
const ecrireAttente = a => { try { Object.keys(a).length ? localStorage.setItem(CLE, JSON.stringify(a)) : localStorage.removeItem(CLE); } catch (e) {} };

const extrait = t => (t || '').replace(/\s+/g, ' ').trim().slice(0, 90);

export default {
  id: 'notes',
  titre: 'Notes',
  acces: 'joueur',
  nav: { label: 'Notes', ordre: 22 },
  carte: { titre: 'Carnet de notes', texte: 'Noter ce qui se passe en session : indices, noms, promesses, dettes…' },

  async mount(root, { params, naviguer }) {
    const st = { liste: [], sel: params[0] || null, q: '', etat: 'ok', minut: null, envoi: null };
    root.innerHTML = '<div class="loading">Ouverture du carnet…</div>';
    try { st.liste = await notes.lister(); }
    catch (e) { root.innerHTML = `<div class="panel center"><h2>Carnet indisponible</h2><p class="hint">${esc(message(e))}</p><p class="hint">Si le site vient d’être mis à jour, le MJ doit relancer <code>supabase/schema.sql</code> dans Supabase.</p></div>`; return; }

    // Modifications restées sur l'appareil (coupure, fermeture pendant l'envoi)
    const attente = lireAttente();
    Object.entries(attente).forEach(([id, ch]) => { const n = st.liste.find(x => x.id === id); if (n) Object.assign(n, ch); else delete attente[id]; });
    ecrireAttente(attente);

    root.innerHTML = `<div class="nt-grille">
      <aside class="nt-side">
        <div class="nt-actions"><button class="btn primary" data-n="new">＋ Nouvelle note</button><button class="btn ghost" data-n="export" title="Télécharger toutes les notes dans un fichier texte">Exporter</button></div>
        <input class="search" id="ntq" type="search" placeholder="Chercher dans mes notes…" autocomplete="off">
        <div class="nt-liste" id="ntliste"></div>
      </aside>
      <section class="nt-page" id="ntpage"></section>
    </div>`;
    const liste = $('#ntliste', root), page = $('#ntpage', root);
    const courante = () => st.liste.find(n => n.id === st.sel);

    function renderListe() {
      const t = sansAccent(st.q).trim();
      const l = st.liste.filter(n => !t || sansAccent(n.titre + ' ' + n.contenu).includes(t));
      liste.innerHTML = l.map(n => `<a href="#/notes/${n.id}" class="nt-item" ${n.id === st.sel ? 'aria-current="true"' : ''}>
          <span class="d">${esc(n.date_session ? dateLongue(n.date_session) : 'Sans date')}</span>
          <b>${esc(n.titre || 'Sans titre')}</b>
          <span class="x">${esc(extrait(n.contenu)) || '<i>Page blanche</i>'}</span></a>`).join('')
        || `<p class="none">${st.liste.length ? 'Aucune note ne correspond.' : 'Votre carnet est vide.'}</p>`;
    }

    function statut() {
      const s = $('#ntstat', page); if (!s) return;
      s.dataset.etat = st.etat;
      s.textContent = { ok: 'Enregistré', attente: 'Modifications…', envoi: 'Enregistrement…', erreur: 'Hors ligne : copie gardée sur l’appareil, nouvel essai bientôt' }[st.etat];
    }

    function renderPage() {
      const n = courante();
      if (!n) {
        page.innerHTML = `<div class="nt-vide"><h2>Carnet de session</h2>
          <p>Indices, noms, lieux, promesses faites à une fée ou dette envers un vampire : notez ici ce qui se passe en partie. Vos notes ne sont visibles que par vous.</p>
          <button class="btn primary" data-n="new">Commencer une note pour aujourd’hui</button></div>`;
        return;
      }
      page.innerHTML = `<div class="nt-tete">
          <input class="nt-titre" id="nttitre" value="${esc(n.titre)}" placeholder="Titre de la session" aria-label="Titre">
          <div class="nt-meta">
            <label><span class="lbl">DATE DE LA SESSION</span><input class="in" type="date" id="ntdate" value="${esc(n.date_session || '')}"></label>
            <span class="nt-stat" id="ntstat" role="status"></span>
            <button class="linkbtn danger" data-n="del">Supprimer</button>
          </div>
        </div>
        <textarea class="nt-texte" id="nttexte" placeholder="Ce qui s’est passé…" aria-label="Notes">${esc(n.contenu)}</textarea>`;
      statut(); ajuster();
      if (st.focusTexte) { st.focusTexte = false; const ta = $('#nttexte', page); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }

    function ajuster() { const ta = $('#nttexte', page); if (ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 4, 360) + 'px'; } }

    // ----- Enregistrement automatique -----
    function modifie(champs) {
      const n = courante(); if (!n) return;
      Object.assign(n, champs);
      const a = lireAttente(); a[n.id] = Object.assign(a[n.id] || {}, champs); ecrireAttente(a);
      st.etat = 'attente'; statut();
      clearTimeout(st.minut); st.minut = setTimeout(envoyer, 900);
      renderListe();
    }
    async function envoyer() {
      clearTimeout(st.minut);
      if (st.envoi) { st.minut = setTimeout(envoyer, 400); return; }
      const a = lireAttente(); const ids = Object.keys(a); if (!ids.length) { st.etat = 'ok'; statut(); return; }
      st.etat = 'envoi'; statut();
      st.envoi = (async () => {
        for (const id of ids) {
          const champs = a[id];
          const r = await notes.enregistrer(id, champs);
          const b = lireAttente();   // retirer seulement si rien n'a changé pendant l'envoi
          if (JSON.stringify(b[id]) === JSON.stringify(champs)) { delete b[id]; ecrireAttente(b); }
          const n = st.liste.find(x => x.id === id); if (n) n.updated_at = r.updated_at;
        }
      })();
      try {
        await st.envoi; st.envoi = null;
        if (Object.keys(lireAttente()).length) { st.minut = setTimeout(envoyer, 300); st.etat = 'attente'; }
        else st.etat = 'ok';
      } catch (e) {
        st.envoi = null;
        if (/introuvable/.test(message(e))) { const b = lireAttente(); ids.forEach(i => delete b[i]); ecrireAttente(b); toast(message(e)); st.etat = 'ok'; }
        else { st.etat = 'erreur'; st.minut = setTimeout(envoyer, 8000); }
      }
      statut();
    }
    if (Object.keys(lireAttente()).length) envoyer();

    async function nouvelle() {
      if (st.creation) return; st.creation = true;
      try { await creerNote(); } finally { st.creation = false; }
    }
    async function creerNote() {
      await envoyer();
      try {
        const d = aujourdhui();
        const n = await notes.creer({ titre: 'Session du ' + dateLongue(d).replace(/^\w+ /, ''), date_session: d, contenu: '' });
        st.liste.push(n); st.liste.sort(trier); st.q = ''; $('#ntq', root).value = '';
        st.focusTexte = true; naviguer('#/notes/' + n.id);
      } catch (e) { toast('Création impossible : ' + message(e)); }
    }

    root.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'ntq') { st.q = t.value; renderListe(); }
      else if (t.id === 'nttitre') modifie({ titre: t.value });
      else if (t.id === 'nttexte') { modifie({ contenu: t.value }); ajuster(); }
      else if (t.id === 'ntdate') { modifie({ date_session: t.value || null }); st.liste.sort(trier); renderListe(); }
    });
    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-n]'); if (!b) return;
      const a = b.dataset.n;
      if (a === 'new') nouvelle();
      if (a === 'export') {
        await envoyer();
        const txt = st.liste.map(n => `${n.titre || 'Sans titre'}\n${dateLongue(n.date_session)}\n${'—'.repeat(20)}\n${n.contenu}\n`).join('\n\n');
        downloadFile('notes-ayesha-' + aujourdhui() + '.txt', txt || 'Carnet vide.\n', 'text/plain;charset=utf-8');
      }
      if (a === 'del') {
        const n = courante(); if (!n) return;
        if (!await confirmer({ titre: 'Supprimer cette note ?', texte: `« ${esc(n.titre || 'Sans titre')} » sera effacée définitivement.`, oui: 'Supprimer', danger: true })) return;
        try {
          clearTimeout(st.minut); const at = lireAttente(); delete at[n.id]; ecrireAttente(at);
          await notes.supprimer(n.id);
          st.liste = st.liste.filter(x => x.id !== n.id); st.etat = 'ok';
          toast('Note supprimée'); naviguer('#/notes');
        } catch (x) { toast('Suppression impossible : ' + message(x)); }
      }
    });

    const avantDepart = e => { if (Object.keys(lireAttente()).length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', avantDepart);

    function afficher() {
      if (st.sel && !courante()) st.sel = null;
      renderListe(); renderPage();
    }
    afficher();

    return {
      update(p) { const id = p[0] || null; if (id === st.sel) return; envoyer(); st.sel = id; afficher(); window.scrollTo(0, 0); },
      unmount() { window.removeEventListener('beforeunload', avantDepart); envoyer(); },
    };
  },
};
