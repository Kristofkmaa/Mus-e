# Musée

Un jeu de gacha de peinture. À chaque tirage, un vrai tableau du domaine public, de Giotto à Mondrian. La rareté se lit au nombre d'hexagones pleins, du cadre de bois au cadre de vermeil.

## Jouer

Site statique, sans build. Il faut le servir en HTTP (le catalogue est chargé par `fetch`) :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000. Pour le publier : Settings → Pages → Deploy from branch, dossier racine.

## Le catalogue

486 reproductions dans `art/`, décrites dans `art/catalogue.json` (clé, artiste, titre, date, musée, technique, salle). Les images viennent du jeu de données « Best Artworks of All Time » (peintres morts depuis plus de 70 ans). Les titres ont été attribués à la main à partir des images ; les œuvres non identifiées sont présentées sans titre, dans la salle commune. Quelques titres, dates ou lieux peuvent être inexacts.

| Hexagones | Salle | Cadre | Chance | Revente | Œuvres |
|---|---|---|---|---|---|
| 5 | Impériale | Vermeil | 1,5 % | 500 N | 19 |
| 4 | Légendaire | Or | 5 % | 150 N | 58 |
| 3 | Épique | Argent | 13,5 % | 50 N | 85 |
| 2 | Rare | Bronze | 30 % | 15 N | 156 |
| 1 | Commune | Bois | 50 % | 5 N | 168 |

## Règles

- 1 600 napoléons au départ, plus 500 par jour.
- 1 tirage = 100 N ; 10 tirages = 1 000 N, avec au moins un cadre d'argent.
- Un cadre doré au plus tard au 60e tirage.
- Les œuvres pas encore accrochées sortent un peu plus souvent.
- Les doublons se revendent. La progression est enregistrée dans le `localStorage` du navigateur.

## Design

Référence « Structured » : papier mastic, encre, os, craie et vélin. Aucune couleur saturée, aucun dégradé, aucune ombre. Fraunces en display (titres de section, nom de marque coupé par le bord de l'écran), Hanken Grotesk pour tout l'utilitaire entre 9 et 16 px. Boutons en pilule noire, cartes à coins encochés, vignettes rondes, hexagones comme indicateurs de rareté.

## Fichiers

- `index.html`, `css/style.css`, `js/main.js`
- `art/catalogue.json`, `art/*.jpg`
