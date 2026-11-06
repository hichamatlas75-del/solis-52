# ☀ Solis 52

**Solis 52** réunit deux grands classiques sur tapis de feutre — **🃏 Classique** (7 colonnes, 52 cartes) et **🕷️ Spider** (10 colonnes, 104 cartes) — en HTML5, CSS3 et JavaScript pur (aucune dépendance). C'est une **PWA** : installable sur ordinateur, Android et iOS, et jouable **hors ligne**.

## Deux jeux en onglets

Le sélecteur d'onglets en haut permet de basculer instantanément entre **Classique** et **Spider** sans perdre la partie ni les statistiques en cours dans chaque mode.

### 🃏 Onglet Classique
- 7 colonnes (suite décroissante en alternant les couleurs, Roi sur colonne vide), **4 fondations par enseigne** (`♠ ♥ ♣ ♦`) de l'As au Roi.
- **Tirage 1 ou 3 cartes**, recyclage de la pioche, score et chrono classiques.
- **Donnes toujours gagnables** (option vérifiée par solveur intégré) et **fin automatique**.

### 🕷️ Onglet Spider
- **104 cartes** (2 jeux complets) réparties sur **10 colonnes** (54 cartes au tableau + 50 cartes en pioche distribuées en **5 séries de 10 cartes**).
- **3 niveaux de difficulté** : **1 couleur (`♠`)**, **2 couleurs (`♠ ♥`)** et **4 couleurs (`♠ ♥ ♣ ♦`)**.
- Déplacement de suites décroissantes de **même couleur** ensemble ; pose sur toute carte de rang supérieur (`+1`) ou colonne vide.
- Assemblage automatique des suites complètes **Roi → As** de même enseigne vers les **8 fondations** (`+100` pts), score classique à base `500` (`-1` par coup).

## Fonctionnalités communes
- **Numéro de donne** reproductible, bouton **« Rejouer la même donne »** et lien de partage (`?game=spider&suits=2&seed=123456`).
- **Annuler / Rétablir** (`Ctrl+Z` / `Ctrl+Y`), **indice intelligent** (`H`), détection de **partie bloquée**.
- **Statistiques séparées** par jeu (parties, victoires, séries, meilleurs score/temps/coups) et **sauvegarde automatique** indépendante.
- Glisser-déposer fluide, tap pour sélectionner, **double-clic / double-tap** pour l'envoi automatique, adaptation **100 % mobile** (7 et 10 colonnes sans débordement horizontal).
- 3 tapis, 2 dos de cartes, mode **4 couleurs** (daltonisme), sons optionnels, cascade de victoire, pause auto du chrono.
- **PWA** : `manifest.webmanifest` + icônes *maskable*, service worker (`sw.js`) hors ligne et raccourcis directs Classique / Spider.

## Structure

| Fichier | Rôle |
|---|---|
| `rules.js` | Moteur de règles pur Classique (52 cartes, solveur, indice) |
| `spider-rules.js` | Moteur de règles pur Spider (104 cartes, 1/2/4 couleurs, séries, indice) |
| `storage.js` | Statistiques, réglages et sauvegardes séparés (`localStorage`) |
| `script.js` | Interface unifiée : onglets, rendu adaptatif, entrées, animations, PWA |
| `sw.js`, `manifest.webmanifest`, `icons/` | Application installable hors ligne |
| `tests/` | Tests unitaires Classique + Spider (`npm test`) |

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
