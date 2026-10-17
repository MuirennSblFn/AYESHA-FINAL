/* =====================================================================
   Connexion (Discord via Supabase) et profil du joueur
   ---------------------------------------------------------------------
   auth.user     : l'utilisateur Supabase connecté (ou null)
   auth.profile  : sa ligne dans la table profiles { id, display_name, avatar_url, role }
   auth.isMJ     : vrai si profile.role === 'mj'
   auth.onChange(fn) : appelé à chaque connexion / déconnexion
   ===================================================================== */
import { sb } from './supabase.js';

const RETOUR = 'ayesha.retour';
const listeners = new Set();

export const auth = {
  user: null,
  profile: null,
  get isMJ() { return this.profile?.role === 'mj'; },
  get nom() { return this.profile?.display_name || nomDiscord(this.user) || 'Joueur'; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  async init() {
    // Erreur renvoyée par Discord / Supabase au retour de connexion
    const qs = new URLSearchParams(location.search);
    const err = qs.get('error_description') || qs.get('error');

    const { data } = await sb.auth.getSession();
    await setUser(data.session?.user || null);

    sb.auth.onAuthStateChange((event, session) => {
      const u = session?.user || null;
      if ((u?.id || null) === (auth.user?.id || null) && event !== 'USER_UPDATED') return;
      // Ne pas appeler Supabase dans ce rappel (recommandation de la bibliothèque)
      setTimeout(async () => { await setUser(u); listeners.forEach(fn => fn()); }, 0);
    });

    // Nettoyer l'adresse (?code=… ou ?error=…) et revenir à la page demandée avant la connexion
    if (qs.has('code') || qs.has('error')) {
      let retour = '';
      try { retour = sessionStorage.getItem(RETOUR) || ''; sessionStorage.removeItem(RETOUR); } catch (e) {}
      history.replaceState(null, '', location.pathname + (retour || location.hash));
    }
    return { erreur: err };
  },

  async signIn() {
    try { sessionStorage.setItem(RETOUR, location.hash || '#/'); } catch (e) {}
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
  },

  async signOut() {
    await sb.auth.signOut();
  },
};

function nomDiscord(u) {
  const m = u?.user_metadata || {};
  return m.custom_claims?.global_name || m.full_name || m.name || m.user_name || m.preferred_username || (u?.email ? u.email.split('@')[0] : '');
}

async function setUser(u) {
  auth.user = u;
  auth.profile = null;
  if (!u) return;
  // Le profil est créé par un déclencheur côté base à la première connexion.
  // Par sécurité, on le crée ici s'il manque (le rôle est forcé à « joueur » par la base).
  let { data: p } = await sb.from('profiles').select('id, display_name, avatar_url, role').eq('id', u.id).maybeSingle();
  if (!p) {
    const row = { id: u.id, display_name: nomDiscord(u), avatar_url: u.user_metadata?.avatar_url || null };
    const r = await sb.from('profiles').insert(row).select('id, display_name, avatar_url, role').maybeSingle();
    p = r.data || { ...row, role: 'joueur' };
  }
  auth.profile = p;
}
