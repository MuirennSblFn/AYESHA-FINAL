/* =====================================================================
   Module Règles : le guide de jeu général, lisible par tous
   ---------------------------------------------------------------------
   Le texte est dans contenu/regles.html (modifiable sans toucher au code).
   Sommaire construit à partir des <h2>/<h3> qui ont un id,
   recherche dans le texte, liens directs : #/regles/<id>.
   ===================================================================== */
import { $, $$, esc, copyText } from '../core/ui.js';

let cache = null;
async function contenu() {
  if (cache) return cache;
  const r = await fetch('contenu/regles.html', { cache: 'no-cache' });
  if (!r.ok) throw new Error('contenu/regles.html introuvable (' + r.status + ')');
  return (cache = await r.text());
}

const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default {
  id: 'regles',
  titre: 'Règles',
  acces: 'public',
  nav: { label: 'Règles', ordre: 15 },
  carte: { titre: 'Règles du jeu', texte: 'Le guide de jeu général : système, magie, combat, création de personnage.' },

  async mount(root, { params }) {
    root.innerHTML = '<div class="loading">Ouverture des règles…</div>';
    let html;
    try { html = await contenu(); }
    catch (e) { root.innerHTML = `<div class="panel center"><h2>Règles indisponibles</h2><p class="hint">${esc(e.message)}</p></div>`; return; }

    root.innerHTML = `<div class="rg-grille">
      <aside class="rg-toc" aria-label="Sommaire">
        <input class="search" id="rgq" type="search" placeholder="Chercher dans les règles…" autocomplete="off">
        <p class="rg-res" id="rgres" hidden></p>
        <nav id="rgnav"></nav>
      </aside>
      <article class="rg-texte" id="rgtexte">${html}</article>
    </div>`;
    const texte = $('#rgtexte', root), nav = $('#rgnav', root);

    // Sommaire
    const titres = $$('section > h2, h3[id]', texte).map(h => {
      const id = h.id || h.parentElement.id;
      h.dataset.ancre = id;
      h.insertAdjacentHTML('beforeend', `<button class="rg-lien" data-lien="${id}" title="Copier le lien vers cette partie" aria-label="Copier le lien">¶</button>`);
      return { id, niv: h.tagName === 'H2' ? 2 : 3, txt: h.firstChild.textContent.trim() };
    });
    nav.innerHTML = titres.map(t => `<a href="#/regles/${t.id}" class="n${t.niv}" data-id="${t.id}">${esc(t.txt)}</a>`).join('');
    const cible = id => texte.querySelector(`#${CSS.escape(id)}`);

    function aller(id, doux) {
      const c = id && cible(id);
      if (!c) { window.scrollTo(0, 0); return; }
      c.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' });
    }

    // Partie en cours de lecture surlignée dans le sommaire
    const liens = new Map($$('a', nav).map(a => [a.dataset.id, a]));
    const obs = new IntersectionObserver(entries => {
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!vis) return;
      liens.forEach(a => a.removeAttribute('aria-current'));
      const a = liens.get(vis.target.dataset.ancre); if (a) { a.setAttribute('aria-current', 'true'); }
    }, { rootMargin: '-70px 0px -70% 0px' });
    $$('[data-ancre]', texte).forEach(h => obs.observe(h));

    // Recherche : surligne et masque les sections sans résultat
    const blocs = $$('section', texte);
    function chercher(q) {
      $$('mark.rg-hit', texte).forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
      texte.normalize();
      const res = $('#rgres', root);
      const nq = sansAccent(q.trim());
      if (nq.length < 2) { blocs.forEach(b => b.hidden = false); res.hidden = true; return; }
      let total = 0;
      blocs.forEach(b => {
        const noeuds = []; const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        while (w.nextNode()) noeuds.push(w.currentNode);
        let n = 0;
        noeuds.forEach(t => {
          const s = t.textContent, ns = sansAccent(s);  // NFD + suppression garde la même longueur que NFC pour le français
          if (ns.length !== s.length) return;
          let i = ns.indexOf(nq); if (i < 0) return;
          const frag = document.createDocumentFragment(); let p = 0;
          while (i >= 0) { frag.append(s.slice(p, i)); const m = document.createElement('mark'); m.className = 'rg-hit'; m.textContent = s.slice(i, i + nq.length); frag.append(m); n++; p = i + nq.length; i = ns.indexOf(nq, p); }
          frag.append(s.slice(p)); t.replaceWith(frag);
        });
        b.hidden = !n; total += n;
      });
      res.hidden = false;
      res.textContent = total ? `${total} résultat${total > 1 ? 's' : ''}` : 'Aucun résultat';
      const premier = $('mark.rg-hit', texte); if (premier) premier.scrollIntoView({ block: 'center' });
    }
    let minuterie;
    $('#rgq', root).addEventListener('input', e => { clearTimeout(minuterie); minuterie = setTimeout(() => chercher(e.target.value), 180); });

    root.addEventListener('click', e => {
      const l = e.target.closest('[data-lien]');
      if (l) { const url = location.href.split('#')[0] + '#/regles/' + l.dataset.lien; copyText(url, 'Lien copié', 'Lien vers cette partie'); }
    });

    requestAnimationFrame(() => aller(params[0]));
    return {
      update(p) { aller(p[0], true); },
      unmount() { obs.disconnect(); },
    };
  },
};
