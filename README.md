# Ayesha — Plateforme des Gris

Un seul site pour la table : le **Grimoire de la Brume** (public) et la **fiche de personnage** de chaque joueur, enregistrée sur son compte (connexion Discord). Le MJ consulte toutes les fiches depuis **La table**.

Le site est statique (HTML, CSS, JavaScript, sans outil de compilation) : il s'héberge sur GitHub Pages. Les comptes et les fiches sont stockés dans **Supabase**.

---

## Mise en service (à faire une fois)

### 1. Créer la base dans Supabase
1. Ouvrez votre projet Supabase › **SQL Editor** › **New query**.
2. Collez tout le contenu de `supabase/schema.sql`, puis cliquez sur **Run**.

### 2. Brancher la connexion Discord
1. Allez sur <https://discord.com/developers/applications> › **New Application** (nom : « Ayesha », par exemple).
2. Dans **OAuth2** :
   - copiez le **Client ID** ;
   - cliquez sur **Reset Secret** et copiez le **Client Secret** ;
   - dans **Redirects**, ajoutez exactement :
     `https://oltfcwsgvvltazsnojyq.supabase.co/auth/v1/callback`
3. Dans Supabase › **Authentication** › **Sign In / Providers** › **Discord** : activez-le, collez le Client ID et le Client Secret, puis enregistrez.

### 3. Mettre le site en ligne (GitHub Pages)
1. Mettez tous les fichiers de ce dossier dans un dépôt GitHub (par exemple en remplaçant le contenu de `ayesha-grimoire`).
2. Dépôt › **Settings** › **Pages** › *Deploy from a branch* › branche `main`, dossier `/ (root)`.
3. Notez l'adresse du site, par exemple `https://votre-pseudo.github.io/ayesha-grimoire/`.

### 4. Autoriser l'adresse du site dans Supabase
Supabase › **Authentication** › **URL Configuration** :
- **Site URL** : l'adresse du site (étape 3) ;
- **Redirect URLs** : ajoutez la même adresse.

### 5. Devenir MJ
1. Connectez-vous une première fois sur le site avec Discord.
2. Dans Supabase › **SQL Editor**, exécutez (avec votre pseudo Discord tel qu'il s'affiche en haut à droite du site) :
   ```sql
   update public.profiles set role = 'mj' where display_name = 'VotrePseudo';
   ```
3. Rechargez le site : l'onglet **La table** apparaît.

### 6. Vérifier le maintien en éveil
Supabase met en pause les projets gratuits inactifs pendant 7 jours. Le workflow `.github/workflows/keepalive.yml` appelle la base tous les 2 jours.
- Dépôt › **Actions** › « Garder Supabase éveillé » › **Run workflow** pour le tester une fois (il doit finir en vert).
- Si GitHub demande d'activer les Actions sur le dépôt, acceptez.
- Le 1er de chaque mois, le workflow ajoute aussi un petit commit (`.github/derniere-activite.txt`). Sans lui, GitHub désactive les tâches planifiées d'un dépôt resté 60 jours sans activité.

---

## Utilisation au quotidien

**Mettre à jour le Grimoire** : comme avant, remplacez le contenu de `grimoire.json` par le code copié depuis le bouton « Publier pour les joueurs » du Grimoire du Maître.

**Joueurs** : ils ouvrent le site, cliquent sur *Se connecter*, puis *Ma fiche*. À la première visite, ils peuvent :
- créer un nouveau personnage ;
- reprendre une fiche de l'ancien site « Fiches des Gris » restée dans leur navigateur (même ordinateur, même navigateur) ;
- importer un fichier `.json` enregistré avec l'ancien site.

**Saisie manuelle** : toutes les valeurs se tapent directement (caractéristiques, chance, valeurs actuelles et maximums de PV / PM / SM). Un maximum saisi à la main s'affiche en doré, avec la valeur calculée en rappel et un lien « ↺ calcul » pour y revenir. Les dés en ligne et le Joker fonctionnent comme avant.

**Sauvegarde** : automatique, en ligne. L'état est affiché au-dessus de la fiche. En cas de coupure, une copie reste sur l'appareil et l'envoi reprend tout seul. Si la fiche a été modifiée entre-temps depuis un autre appareil, le site demande quelle version garder.

---

## Organisation du code

```
index.html               page unique : charge les styles et js/main.js
grimoire.json            contenu du Grimoire (publié depuis le Grimoire du Maître)
css/base.css             couleurs, barre du haut, boutons, fenêtres, accueil
css/grimoire.css         styles du module Grimoire
css/fiche.css            styles de la fiche, de La table et de l'impression
js/config.js             adresse et clé publique Supabase
js/core/                 socle : connexion (auth.js), routeur (router.js), outils (ui.js)
js/shared/regles.js      règles d'Ayesha (caractéristiques, classes, sac, sorts…)
js/shared/personnage.js  modèle du personnage, calculs, lecture et enregistrement en ligne
js/modules/index.js      LISTE DES MODULES (c'est ici qu'on en ajoute)
js/modules/*.js          accueil, grimoire, table (MJ)
js/modules/fiche/        fiche : sheet.js (affichage), print.js (impression), index.js (page)
supabase/schema.sql      tables, règles d'accès, rôle MJ, fonction de maintien en éveil
vendor/                  bibliothèque Supabase (version figée, pas de dépendance à un CDN)
```

### Ajouter une section (Armurerie, Centre de formation…)
1. Créer `js/modules/armurerie.js` sur le modèle de `accueil.js` : un objet `{ id, titre, acces, nav, carte, mount(el, ctx) }` (le contrat complet est décrit en tête de `js/core/router.js`).
2. Dans `js/modules/index.js`, l'importer et remplacer la ligne « bientôt » correspondante.
3. Pour lire ou modifier le personnage du joueur : `personnage.charger()` puis `personnage.modifie(data)` (voir `js/shared/personnage.js`). Les règles communes sont dans `js/shared/regles.js`.
4. Si la section a besoin de nouvelles données en ligne (catalogue de l'armurerie…), ajouter une table et ses règles d'accès dans `supabase/schema.sql`.

### Tester en local
Servez le dossier avec n'importe quel petit serveur (`python3 -m http.server 8000`) et ajoutez `http://localhost:8000/` aux **Redirect URLs** de Supabase.
