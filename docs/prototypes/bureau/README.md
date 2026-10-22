# Prototype : le bureau de la section Contact

Ce dossier fabrique la scène du bureau qui termine le parcours (voir la spec `docs/specs/2026-10-21-maquette-v3-bureau.md`). La scène est en code et sert de version finale : le site la reprendra pour le rendu en temps réel.

- `scene.js` : la scène Three.js (pièce, objets du bureau, ville générée, deux lumières, deux cadrages).
- `render.html` : rend une couche ou un aperçu complet dans une page et le récupère en image.
- `shoot.cjs` : ouvre `render.html` dans Chromium sans interface et enregistre chaque image avec ses données de placement (`.json`).
- `layers.mjs` : rend toutes les couches finales, les convertit en WebP et rassemble les placements dans `renders/layers/placement.json`.

## Mise en route

```sh
npm install
npm run serve        # sert docs/prototypes sur le port 8766, pour atteindre aussi le modèle de la planète
```

Puis, dans un autre terminal (les navigateurs de Playwright doivent être installés, ou `CHROMIUM_PATH` renseigné) :

```sh
mkdir -p renders
node shoot.cjs renders "apercu:moment=crepuscule&framing=desktop&layer=preview"
npm run layers       # les couches finales, dans renders/layers
node layers.mjs --layers=desk   # seulement certaines couches (city, room, desk, windows)
```

La rose posée sur le bureau est celle de la planète : la scène la prend dans l'export Blender de Grégoire, `../petit-prince/models/projet2.glb` (non versionné, voir le README du prototype de la planète). Sans ce fichier, une rose simplifiée la remplace.

Pour voir le fond d'écran sur le moniteur dans les aperçus, copier la photo de Grégoire dans `renders/wallpaper.jpg` (non versionnée).

## Paramètres de `render.html`

| Paramètre             | Valeurs                                               | Rôle                                                                                                                |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `moment`              | `crepuscule` (défaut), `aube`                         | lumière                                                                                                             |
| `framing`             | `desktop` (défaut, 1440 × 900), `mobile` (390 × 844)  | cadrage                                                                                                             |
| `layer`               | `preview` (défaut), `city`, `room`, `desk`, `windows` | aperçu complet sur le ciel, ou une couche détourée ; `windows` : toutes les fenêtres de la ville allumées, sur noir |
| `scale`               | facteur                                               | densité de pixels (1,5 et 2 pour les couches finales)                                                               |
| `overscan`            | fraction                                              | marge autour du cadre pour les mouvements de tête (0,04 pour les couches finales)                                   |
| `screen`              | `0`                                                   | aperçu sans le fond d'écran sur le moniteur                                                                         |
| `fov`, `pitch`, `yaw` | degrés                                                | réglages de la caméra pendant la recherche du cadrage                                                               |
| `cx`, `cy`, `cz`      | mètres                                                | position de la caméra, pour la même recherche                                                                       |

## Les données de placement

Chaque image est accompagnée d'un `.json` qui donne, en pixels CSS du cadre élargi par la marge : la ligne d'horizon, la position de la lueur du soleil, les quatre coins de l'écran (pour y caler l'écran de verrouillage en HTML), les coins de l'ouverture de la fenêtre et la position de l'ampoule (pour son halo). Le composant « Bureau » de la maquette reprend ces valeurs.
