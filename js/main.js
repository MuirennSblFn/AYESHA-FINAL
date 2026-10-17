/* Point d'entrée de la plateforme */
import { demarrer } from './core/router.js';
import { MODULES } from './modules/index.js';

window.__ayeshaPret = true;   // le code a bien été chargé (voir index.html)
demarrer(MODULES);
