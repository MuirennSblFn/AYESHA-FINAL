/* Page d'accueil : présente les sections disponibles. */
import { esc, SIGIL, DISCORD } from '../core/ui.js';
import { peutVoir } from '../core/router.js';

export default {
  id: 'accueil',
  titre: 'Accueil',
  acces: 'public',
  async mount(el, { auth, modules }) {
    const cartes = modules.filter(m => m.carte && (m.acces !== 'mj' || auth.isMJ)).map(m => {
      if (m.bientot) return `<div class="card soon"><span class="tag">BIENTÔT</span><h3>${esc(m.carte.titre)}</h3><p>${esc(m.carte.texte)}</p></div>`;
      const lock = !peutVoir(m);
      return `<a class="card${m.acces === 'mj' ? ' mj' : ''}" href="#/${m.id}">${lock ? '<span class="tag">CONNEXION</span>' : m.acces === 'mj' ? '<span class="tag">MJ</span>' : ''}<h3>${esc(m.carte.titre)}</h3><p>${esc(m.carte.texte)}</p></a>`;
    }).join('');
    el.innerHTML = `
      <section class="hero">
        ${SIGIL}
        <h2>${auth.user ? `Bienvenue, ${esc(auth.nom)}` : 'Bienvenue chez les Gris'}</h2>
        <p>${auth.user ? 'Retrouvez votre fiche de personnage et le Grimoire de la Brume.' : 'Le Grimoire de la Brume est ouvert à tous. Connectez-vous avec Discord pour accéder à votre fiche de personnage.'}</p>
        ${auth.user ? '' : `<button class="btn discord big" data-shell="login">${DISCORD}Se connecter avec Discord</button>`}
      </section>
      <section class="cards">${cartes}</section>`;
  },
};
