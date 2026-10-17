/* =====================================================================
   Routeur et coquille de la plateforme
   ---------------------------------------------------------------------
   Les pages sont des « modules » déclarés dans js/modules/index.js.
   Adresse : #/<id-du-module>/<paramètres…>   ex. #/grimoire/abc123

   Contrat d'un module :
   {
     id: 'armurerie',                // utilisé dans l'adresse
     titre: 'Armurerie',             // titre de l'onglet du navigateur
     nav: { label: 'Armurerie', ordre: 30 },   // facultatif : lien dans le menu
     acces: 'public' | 'joueur' | 'mj',        // qui peut l'ouvrir
     carte: { titre, texte }         // facultatif : carte sur la page d'accueil
     bientot: true                   // facultatif : affiché « bientôt » à l'accueil, non navigable
     async mount(el, ctx) {          // dessine le module dans el
       return { update(params){…}, unmount(){…} }   // tout est facultatif
     }
   }
   ctx = { auth, params, naviguer(hash), modules }
   ===================================================================== */
import { auth } from './auth.js';
import { $, esc, toast, SIGIL_SMALL, DISCORD } from './ui.js';
import { CONFIG } from '../config.js';

let MODULES = [];
let courant = null;   // { id, el, api }

export function naviguer(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

function parse() {
  const h = location.hash.replace(/^#\/?/, '');
  const [id, ...rest] = h.split('/').filter(Boolean);
  return { id: id || 'accueil', params: rest.map(decodeURIComponent) };
}

export function peutVoir(m) {
  if (m.acces === 'mj') return auth.isMJ;
  if (m.acces === 'joueur') return !!auth.user;
  return true;
}

function renderHeader(actif) {
  const nav = MODULES.filter(m => m.nav && !m.bientot && (m.acces !== 'mj' || auth.isMJ))
    .sort((a, b) => (a.nav.ordre || 0) - (b.nav.ordre || 0))
    .map(m => `<a href="#/${m.id}" class="navlink${m.acces === 'mj' ? ' mj' : ''}" ${actif === m.id ? 'aria-current="page"' : ''}>${esc(m.nav.label)}</a>`).join('');
  const user = auth.user
    ? `<div class="who">${auth.profile?.avatar_url ? `<img src="${esc(auth.profile.avatar_url)}" alt="" referrerpolicy="no-referrer">` : ''}<span><b>${esc(auth.nom)}</b>${auth.isMJ ? '<small>MAÎTRE DU JEU</small>' : ''}</span><button class="btn ghost" data-shell="logout">Déconnexion</button></div>`
    : `<button class="btn discord" data-shell="login">${DISCORD}Se connecter</button>`;
  $('#top').innerHTML = `
    <a class="brand" href="#/">${SIGIL_SMALL}<div><h1>${esc(CONFIG.nom)}</h1><small>${esc(CONFIG.sousTitre)}</small></div></a>
    <nav class="mainnav" aria-label="Sections">${nav}</nav>
    ${user}`;
}

export async function render() {
  const { id, params } = parse();
  let mod = MODULES.find(m => m.id === id && !m.bientot);
  if (!mod) mod = MODULES.find(m => m.id === 'accueil');
  renderHeader(mod.id);
  const ctx = { auth, params, naviguer, modules: MODULES };

  // Même module déjà affiché : simple mise à jour des paramètres si le module le permet
  if (courant && courant.id === mod.id && courant.api?.update && courant.user === (auth.user?.id || null)) {
    courant.api.update(params); return;
  }
  if (courant) { try { courant.api?.unmount?.(); } catch (e) { console.error(e); } }

  const main = $('#view');
  const el = document.createElement('div');
  el.className = `module m-${mod.id}`;
  main.replaceChildren(el);
  document.title = `${mod.titre || mod.nav?.label || ''} · ${CONFIG.nom}`.replace(/^ · /, '');
  courant = { id: mod.id, el, api: null, user: auth.user?.id || null };

  if (!peutVoir(mod)) {
    el.innerHTML = mod.acces === 'mj'
      ? `<div class="panel center"><h2>Réservé au MJ</h2><p>Cette page n'est accessible qu'au Maître du jeu.</p><a class="btn" href="#/">Retour à l'accueil</a></div>`
      : `<div class="panel center"><h2>Connexion requise</h2><p>Connectez-vous avec votre compte Discord pour accéder à ${esc(mod.titre ? 'la page « ' + mod.titre + ' »' : 'cette page')}.</p><button class="btn discord big" data-shell="login">${DISCORD}Se connecter avec Discord</button></div>`;
    return;
  }
  try {
    const api = await mod.mount(el, ctx);
    if (courant && courant.el === el) courant.api = api || null;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="panel center"><h2>Une erreur est survenue</h2><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Recharger la page</button></div>`;
  }
}

export async function demarrer(modules) {
  MODULES = modules;
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-shell]'); if (!t) return;
    if (t.dataset.shell === 'login') {
      t.disabled = true;
      try { await auth.signIn(); } catch (err) { t.disabled = false; toast('Connexion impossible : ' + (err.message || err)); }
    }
    if (t.dataset.shell === 'logout') { await auth.signOut(); }
  });
  $('#view').innerHTML = '<div class="loading">Ouverture…</div>';
  let res = {};
  try { res = await auth.init(); }
  catch (e) { console.error(e); toast('Connexion au serveur impossible pour le moment.'); }
  if (res.erreur) toast('Connexion refusée : ' + res.erreur);
  window.addEventListener('hashchange', render);
  auth.onChange(render);
  render();
}
