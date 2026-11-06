# ☀ Solis 52

**Solis 52** est un jeu de patience à 7 colonnes sur tapis de feutre, en HTML5, CSS3 et JavaScript pur (aucune dépendance). C'est une **PWA** : installable sur ordinateur, Android et iOS, et jouable **hors ligne**.

## Fonctionnalités

**Règles**
- 7 colonnes (suite décroissante en alternant les couleurs, Roi sur colonne vide), 4 fondations par enseigne de l'As au Roi.
- **Tirage 1 ou 3 cartes**, recyclage de la pioche, score et chrono classiques.

**Gameplay**
- **Donnes toujours gagnables** (option) : chaque donne est vérifiée par un solveur intégré.
- **Numéro de donne** reproductible, bouton **« Rejouer la même donne »** et lien de partage (`?seed=123456&draw=1`).
- **Annuler / Rétablir** (`Ctrl+Z` / `Ctrl+Y`), **indice intelligent** basé sur le solveur (`H`), **fin automatique** qui suit une solution.
- Détection de **partie bloquée**.
- **Statistiques** (parties, victoires, séries, meilleurs score/temps/coups) et **sauvegarde automatique** de la partie en cours.

**Interface**
- Glisser-déposer, tap pour sélectionner, **double-clic / double-tap** pour l'envoi automatique, support tactile complet.
- Animations de déplacement et de retournement, sons optionnels, cascade de victoire.
- 3 tapis, 2 dos de cartes, mode **4 couleurs** (daltonisme), respect de `prefers-reduced-motion`.
- Clavier : `Tab` pour naviguer, `Entrée`/`Espace` pour envoyer une carte, `H`, `N`, `Ctrl+Z`, `Ctrl+Y`.
- Pause automatique du chrono quand l'onglet est masqué.

**PWA**
- `manifest.webmanifest` + icônes (dont *maskable*), service worker (`sw.js`) avec cache hors ligne et notification de mise à jour.
- Bouton **Installer** dans le menu (☰) ; sur iOS : *Partager ▸ Sur l'écran d'accueil*.

## Structure

| Fichier | Rôle |
|---|---|
| `rules.js` | Moteur de règles pur (sans DOM) : donnes, coups, score, solveur, indice |
| `storage.js` | Statistiques, réglages, sauvegarde (`localStorage`) |
| `script.js` | Interface : rendu, entrées, animations, PWA |
| `sw.js`, `manifest.webmanifest`, `icons/` | Application installable hors ligne |
| `tests/` | Tests unitaires (`npm test`) |

## Lancer en local

Le service worker exige `http://localhost` ou HTTPS :

```bash
python3 -m http.server 8080   # puis ouvrir http://localhost:8080
npm test                      # tests unitaires (Node ≥ 20)
```

## Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` lance les tests puis déploie. Activez-le une fois : **Settings ▸ Pages ▸ Source : GitHub Actions**.

## Licence

MIT
