/* =====================================================================
   Module Grimoire de la Brume (configuration du moteur js/shared/codex.js)
   ---------------------------------------------------------------------
   Joueurs (et visiteurs) : lisent les entrées publiées, la partie que le MJ
   a rendue visible ; proposent des observations au MJ.
   MJ : l'exemplaire complet (ex-« Grimoire du Maître ») sur la même page.
   Adresses : #/grimoire/<id>   #/grimoire/<id>/reecrire[/<section>]   #/grimoire/nouvelle
   ===================================================================== */
import { esc } from '../core/ui.js';
import { creerCodex } from '../shared/codex.js';
import { FAMILLES, CONNAISSANCE, STATS, EXTRA, SECTIONS_J, SECTIONS_MJ, grimoire, depuisPublication } from '../shared/grimoire.js';

const pips = c => { const i = CONNAISSANCE.indexOf(c); return `<span class="kpips" title="Connaissance : ${esc(c || 'non précisée')}">${CONNAISSANCE.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span>`; };
const famLabel = e => e.famille === 'Autre' ? (e.familleAutre || 'Autre') : (e.famille || '');

export default creerCodex({
  id: 'grimoire',
  titre: 'Grimoire de la Brume',
  nav: { label: 'Grimoire', ordre: 10 },
  carte: { titre: 'Grimoire de la Brume', texte: 'Le bestiaire des Gris : ce que l’on sait des entités de la Brume.' },
  depot: grimoire, SJ: SECTIONS_J, SM: SECTIONS_MJ, STATS, EXTRA,

  /* En-tête de la fiche (sous le nom) : champs du formulaire, puis affichage */
  entete: [
    { k: 'autresNoms', l: 'Autres noms (folklore, régions, langue ancienne)', t: 'text' },
    { k: 'famille', l: 'Famille', t: 'radio', o: FAMILLES },
    { k: 'familleAutre', l: 'Si « Autre » : laquelle ?', t: 'text' },
    { k: 'connaissance', l: 'Niveau de connaissance', t: 'radio', o: CONNAISSANCE, demi: true },
    { k: 'redacteur', l: 'Rédigé par', t: 'text', demi: true },
  ],
  defauts: { connaissance: 'Rumeur' },
  metaAffiche: e => [
    famLabel(e) && `<span>Famille <b>${esc(famLabel(e))}</b></span>`,
    `<span>Connaissance ${pips(e.connaissance)} <b>${esc(e.connaissance || 'non précisée')}</b></span>`,
    e.redacteur && `<span>Rédigé par <b>${esc(e.redacteur)}</b></span>`,
  ],
  ligneDiscord: e => `Famille : ${famLabel(e) || '—'} · Connaissance : ${e.connaissance || '—'}`,
  sousTitre: famLabel,
  coin: e => pips(e.connaissance),
  filtre: { k: 'famille', options: FAMILLES },

  /* Note rapide (vue MJ) et observations versées : dans les Notes des Gris */
  noteRapide: { section: 'notes', champ: 'notes', quiPh: 'Personnage', textePh: 'Ce que la table a découvert…', bouton: 'Consigner la note', ligne: (date, perso, texte) => ({ date, perso, texte }) },

  importFichier: { libelle: 'Reprendre les entrées publiées', async charger() { const r = await fetch('grimoire.json', { cache: 'no-store' }); const d = await r.json(); return (d.entries || []).map(depuisPublication); } },
  importSauvegarde: {
    libelle: 'Importer une sauvegarde du Grimoire du Maître',
    aide: 'Choisissez une sauvegarde du Grimoire du Maître (« grimoire-du-maitre-….json », bouton « Sauvegarder ») ou un fichier grimoire.json.',
    convertir(d) {
      if (d.format === 'grimoire-mj-v1') return Object.entries(d.entries || {}).map(([id, e]) => {
        const { publie, numero, updatedAt, ...entree } = e;
        return { id, numero: parseInt(numero, 10) || null, publie: !!publie, entree, profil: (d.profils || {})[id] || {} };
      });
      if (d.format === 'grimoire-brume-v1') return (d.entries || []).map(depuisPublication);
      return null;
    },
  },

  T: {
    ouverture: 'Ouverture du grimoire…', eyebrow: 'ENTRÉE', nouvelle: 'Nouvelle entrée', reecrire: 'Réécrire l’entrée',
    sceller: "Sceller l'entrée", scellee: 'Entrée scellée', effacer: "Effacer l'entrée", effacee: 'Entrée effacée',
    nomPh: 'Nom commun', publier: 'Publier cette entité dans le Grimoire des joueurs',
    partieJ: 'Ce que dit le Grimoire', partieM: 'Profil technique', partieMRevelee: 'Ce que le Maître a révélé',
    muet: 'Le Grimoire est encore muet sur cette entité.',
    singulierCourt: 'entrée', plurielCourt: 'entrées', sommaireVide: "Aucune entité consignée pour l'instant.",
    consignee: 'ENTITÉ CONSIGNÉE', consignees: 'ENTITÉS CONSIGNÉES',
    ouvert: 'Le Grimoire est ouvert', scelle: 'Le Grimoire est encore scellé',
    accueilMJ: 'Choisissez une entité dans le sommaire, ou inscrivez-en une nouvelle. Ce que vous publiez est visible des joueurs immédiatement.',
    accueilJoueur: 'Choisissez une entité dans le sommaire pour lire ce que les Gris en savent.',
    scelleTexte: "Aucune entité n'y a encore été consignée. Le MJ y ajoutera les créatures au fil des scénarios.",
    vierge: 'Le Grimoire est vierge', premiere: 'Inscrire une entité',
    viergeTexte: 'Aucune entité n’est encore consignée dans la base. Vous pouvez reprendre les entrées déjà publiées sur le site (fichier grimoire.json), importer une sauvegarde du Grimoire du Maître, ou inscrire une première entité.',
    obsIntro: 'Ce que votre personnage a vu, appris ou subi face à cette entité.', obsDestination: 'aux Notes des Gris', obsDestinationCourte: 'les Notes des Gris',
  },
});
