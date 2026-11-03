# Musée

Une app de gacha de peinture. On ouvre des caisses, on découvre de vrais tableaux du domaine public, de Giotto à Mondrian, et on remplit sa galerie. La rareté se lit à la couleur du cadre : bois, bronze, argent, or, vermeil holographique.

## Jouer

Site statique, sans build. Il faut le servir en HTTP (le catalogue est chargé par `fetch`) :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000. Pour le publier : Settings → Pages → Deploy from branch, dossier racine.

## Le catalogue

491 œuvres : 486 reproductions de tableaux dans `art/`, décrites dans `art/catalogue.json` (clé, artiste, titre, date, musée, technique, salle). Les images viennent du jeu de données « Best Artworks of All Time » (peintres morts depuis plus de 70 ans). Les titres ont été attribués à la main à partir des images ; les œuvres non identifiées sont présentées sans titre, dans la salle commune. Quelques titres, dates ou lieux peuvent être inexacts.

| Hexagones | Salle | Cadre | Chance | Revente | Œuvres |
|---|---|---|---|---|---|
| 5 | Impériale | Vermeil | 1,5 % | 500 N | 19 |
| 4 | Légendaire | Or | 5 % | 150 N | 58 |
| 3 | Épique | Argent | 13,5 % | 50 N | 85 |
| 2 | Rare | Bronze | 30 % | 15 N | 156 |
| 1 | Commune | Bois | 50 % | 5 N | 168 |

## Sculptures en 3D

Cinq sculptures numérisées, dans `art/3d/` (GLB allégés à 17 000–80 000 faces, sans texture : la page leur applique un marbre uniforme), affichées avec [model-viewer](https://modelviewer.dev/) chargé depuis unpkg. On peut les faire tourner du doigt.

| Œuvre | Source du scan | Licence |
|---|---|---|
| David, Michel-Ange | Sketchfab, via un projet de galerie virtuelle | non précisée |
| Victoire de Samothrace | fichier `full_sculpture` d'un projet de galerie virtuelle | non précisée |
| Tête du David | Statens Museum for Kunst (Scan the World), repost Thomas Flynn | CC BY 4.0 |
| Buste de jeune femme | exemples de t3d.js | non précisée |
| Buste d'homme à l'antique | Poly Haven, `marble_bust_01` | CC0 |

Les API de modèles 3D de musées (Smithsonian 3D, Sketchfab, Scan the World) existent mais n'étaient pas joignables depuis l'environnement de développement ; les fichiers viennent de dépôts GitHub publics.

## Règles

- 1 600 napoléons au départ, plus 500 par jour.
- 1 tirage = 100 N ; 10 tirages = 1 000 N, avec au moins un cadre d'argent.
- Un cadre doré au plus tard au 60e tirage.
- Les œuvres pas encore accrochées sortent un peu plus souvent.
- Un doublon est revendu sur-le-champ (5 à 500 N selon le cadre). Un cadeau quotidien de 500 N entretient la série de jours.
- La progression est enregistrée dans le `localStorage` du navigateur.

## Design

App à écran unique avec trois onglets (Ouvrir, Galerie, Collection). Papier mastic, encre et os, bouton principal noir, cadres métalliques en dégradé par rareté, tableau voilé d'un drap de velours rouge qui frémit puis tombe (plus longtemps si l'œuvre est rare), le cadre s'allumant à la couleur de la rareté sous le drap, confettis et flash d'écran pour l'or et le vermeil, tampon « Légendaire ! », dix caisses sous forme de cartes à retourner. Fraunces en display, Hanken Grotesk pour l'interface.

## Panneau admin

En bas de l'onglet Collection : ajouter des napoléons, forcer la rareté de la prochaine ouverture (ou une sculpture), déclencher la garantie dorée, tout remettre à zéro. C'est un outil de test visible de tous : retirer le bouton `#openAdmin` avant de publier.

## Fichiers

- `index.html`, `css/style.css`, `js/main.js`
- `art/catalogue.json`, `art/*.jpg`
