# Prototype : la scène 3D du Petit Prince

Ce dossier a servi à valider la scène de l'ouverture avant l'implémentation (voir la spec, section 6). Il ne fait pas partie du site.

- `render.html` : la scène en Three.js (relief généré, éclairages, variantes de l'heure), rendue dans une page et récupérée en image.
- `shoot.cjs` : ouvre `render.html` dans Chromium sans interface et enregistre une image par variante.
- `optimize.mjs` : réduit l'export Blender pour le web (corrections de `fixes.mjs`, simplification par objet, quantification, compression meshopt).
- `fixes.mjs` : corrige deux défauts de l'export avant l'optimisation. Le renard, enfoncé à moitié dans la planète, est relevé le long de la verticale du sol jusqu'à s'y asseoir, sans changer de pose. L'écharpe, un simple ruban qui passait derrière la nuque, est prolongée depuis son bord pour faire le tour du cou. Le fichier Blender n'est pas modifié ; les deux corrections se refont à chaque export, et le renard n'est plus déplacé si l'export est déjà juste.

## Mise en route

```sh
npm install
mkdir models renders
cp /chemin/vers/projet2.glb models/   # l'export Blender de Grégoire (non versionné)
npm run optimize                       # écrit models/petit-prince.glb (version web)
npm run serve                          # sert ce dossier sur le port 8765
```

Puis, dans un autre terminal (les navigateurs de Playwright doivent être installés, ou `CHROMIUM_PATH` renseigné) :

```sh
node shoot.cjs renders "nuit:layer=planet&w=1200&h=1200" "aube:layer=planet&w=1200&h=1200&tod=aube"
```

## Paramètres de `render.html`

| Paramètre      | Valeurs                                    | Rôle                                                                 |
| -------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `amb`          | `noir` (défaut), `nuit`, `brume`           | ambiance ; `noir` est celle retenue                                  |
| `tod`          | `aube`, `jour`, `crepuscule`               | lumière selon l'heure ; sans ce paramètre, la nuit                   |
| `layer`        | `planet` (défaut), `decor`, `full`         | planète seule sur fond transparent, décor seul sur fond noir, ou tout |
| `w`, `h`       | pixels                                     | taille de l'image                                                    |
| `model`        | nom de fichier dans `models/`              | `petit-prince.glb` par défaut                                        |
| `proc`         | `0`                                        | garde la planète et les cheveux lisses du fichier, sans relief généré |
| `detail`, `seed` | nombres                                  | finesse de la planète (110) et tirage des cratères (5)               |
| `t`            | secondes                                   | instant des animations                                               |
| `fov`, `cy`    | degrés, unités                             | champ (20) et hauteur (15,5) de la caméra                            |
| `spread`, `dscale` | facteurs                               | rapprochement et taille du décor autour de la planète                |
| `lx`, `lz`     | `-1` à `1`                                 | idée non retenue : lumière qui suit la souris                        |
| `fox`          | degrés                                     | idée non retenue : le renard tourne la tête                          |
| `fixfox`       | `1`                                        | répare un export fait sans « Apply Modifiers »                       |
| `fmt`          | `png` (défaut), `jpg`                      | format de l'image                                                    |

Le calque `decor` se rend sur fond noir : on convertit ensuite la luminosité en transparence pour le poser sur la page.
