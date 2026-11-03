# Musée

Une app de gacha de peinture. On ouvre des caisses, on découvre de vrais tableaux du domaine public, de Giotto à Mondrian, et on remplit sa galerie. La rareté se lit à la couleur du cadre : bois, bronze, argent, or, vermeil holographique.

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
- Un doublon est revendu sur-le-champ (5 à 500 N selon le cadre). Un cadeau quotidien de 500 N entretient la série de jours.
- La progression est enregistrée dans le `localStorage` du navigateur.

## Design

App à écran unique avec trois onglets (Ouvrir, Galerie, Collection). Nuit violette, bouton principal doré, cadres métalliques en dégradé par rareté, caisse qui tremble puis éclate (plus longtemps si l'œuvre est rare), confettis et flash d'écran pour l'or et le vermeil, tampon « Légendaire ! », dix caisses sous forme de cartes à retourner. Fraunces (axe SOFT) en display, Bricolage Grotesque pour l'interface.

## Fichiers

- `index.html`, `css/style.css`, `js/main.js`
- `art/catalogue.json`, `art/*.jpg`
