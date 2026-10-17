/* Client Supabase unique, partagé par tous les modules.
   La bibliothèque est chargée depuis vendor/ par index.html (window.supabase). */
import { CONFIG } from '../config.js';

export const sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
  auth: {
    flowType: 'pkce',          // le retour de Discord arrive en ?code=… (compatible avec le routage par #)
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
