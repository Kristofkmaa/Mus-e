# Musée

Un jeu de gacha d'œuvres d'art réelles, dans un salon de style Empire. Chaque tirage décroche une œuvre du domaine public dans un grand musée. La rareté se lit dans le cadre (bois, bronze, argent, or, vermeil), puis le rideau se lève sur l'œuvre.

## Jouer

Site statique, sans build ni clé d'API. Il faut juste le servir en HTTP (les modules ES ne marchent pas en `file://`) :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000. Pour le publier : Settings → Pages → Deploy from branch, dossier racine.

## Rareté et API

| Cadre | Rareté | Chance | Source |
|---|---|---|---|
| Vermeil | Impériale | 1,5 % | [Met Collection API](https://metmuseum.github.io/) : `isHighlight` + peinture européenne (dép. 11) |
| Or | Légendaire | 5 % | [Art Institute of Chicago API](https://api.artic.edu/docs/) : peintures `is_boosted` |
| Argent | Épique | 13,5 % | Met : `isHighlight`, tous départements |
| Bronze | Rare | 30 % | Art Institute of Chicago : domaine public |
| Bois | Commune | 50 % | [Cleveland Museum of Art Open Access](https://openaccess-api.clevelandart.org/) : CC0 |

Les trois API sont gratuites, sans clé et autorisent CORS. Si l'une ne répond pas, le tirage passe par une autre salle en gardant la rareté tirée. Si les trois échouent, les napoléons sont rendus.

## Règles

- 1 600 napoléons au départ, plus 500 par jour.
- 1 tirage = 100, 10 tirages = 1 000, avec au moins un cadre d'argent garanti.
- Un cadre doré au plus tard au 60e tirage.
- Les doublons se revendent (5 à 500 napoléons selon le cadre).
- La progression est enregistrée dans le `localStorage` du navigateur.

## Fichiers

- `index.html` : structure de la page
- `css/style.css` : direction artistique (vert Empire, or, pourpre, Bodoni Moda et EB Garamond)
- `js/museums.js` : appels aux API et normalisation des œuvres
- `js/main.js` : économie, tirages, galerie
