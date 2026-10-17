/* =====================================================================
   Liste des modules de la plateforme
   ---------------------------------------------------------------------
   Pour ajouter une section (ex. l'Armurerie) :
     1. créer js/modules/armurerie.js qui exporte un module (voir le
        contrat dans js/core/router.js, et accueil.js pour un exemple court) ;
     2. l'importer ici et le mettre dans la liste (à la place de la ligne
        « bientôt » correspondante) ;
     3. si besoin, créer css/armurerie.css et l'ajouter dans index.html.
   ===================================================================== */
import accueil from './accueil.js';
import grimoire from './grimoire.js';
import fiche from './fiche/index.js';
import table from './table.js';
import armurerie from './armurerie.js';

export const MODULES = [
  accueil,
  grimoire,
  fiche,
  armurerie,
  table,
  // Sections prévues : affichées « bientôt » sur la page d'accueil
  { id: 'formation', bientot: true, carte: { titre: 'Centre de formation', texte: 'Faire progresser son personnage entre deux enquêtes.' } },
];
