<div align="center">

# ML Playground

### *Interactive notes on machine learning*

Every algorithm is an interactive figure. Draw your own data, step through the algorithm one move at a time, and read what happened: in plain language, with the real equations, and with the exact worked examples from the lecture slides.

[**Live site → ml.mirazulislamnahid.com**](https://ml.mirazulislamnahid.com)

![three.js](https://img.shields.io/badge/three.js-r187-4A3F35?logo=threedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-4A3F35?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/vanilla_JS-ES2020-4A3F35?logo=javascript&logoColor=white)
![KaTeX](https://img.shields.io/badge/math-KaTeX-4A3F35)
![Docker](https://img.shields.io/badge/deploy-Docker_·_Dokploy-4A3F35?logo=docker&logoColor=white)
[![Build check](https://github.com/TheRealNightmare/ML-Playground/actions/workflows/build.yml/badge.svg)](https://github.com/TheRealNightmare/ML-Playground/actions/workflows/build.yml)

<img src="docs/home.png" alt="Home page: a 3D point cloud clustering itself with K-Means, in a soft neumorphic warm-sand design" width="900" />

</div>

---

## Contents

- [Why](#why)
- [Playgrounds](#playgrounds)
- [Lecture mode](#lecture-mode)
- [Design](#design)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Adding an algorithm](#adding-an-algorithm)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## Why

Most explanations of ML algorithms are either a wall of equations or a GIF you can't touch. ML Playground sits in between: each algorithm is a small lab you can **poke**. Add points where you want, drag centroids around, slow it down, step through it, and read what just happened.

It is written for two audiences at once:

- **Beginners** get an analogy-first *Intuition* tab and a narrator that explains every step in plain English.
- **University students** get a *Math* tab with numbered equations and pseudocode that highlights the line currently running, plus *Worked example* tables that rebuild the lecture slides step by step.

## Playgrounds

| § | Playground | Type | Status |
|---|---|---|---|
| 1.1 | [K-Means Clustering](https://ml.mirazulislamnahid.com/#/kmeans) | Unsupervised · Clustering | ✅ Live |
| 1.2 | [Hierarchical Clustering](https://ml.mirazulislamnahid.com/#/hierarchical) | Unsupervised · Clustering | ✅ Live |
| 1.3 | [Fuzzy C-Means](https://ml.mirazulislamnahid.com/#/fcm) | Unsupervised · Soft clustering | ✅ Live |
| 1.4 | [DBSCAN](https://ml.mirazulislamnahid.com/#/dbscan) | Unsupervised · Density | ✅ Live |
| 1.5 | [HDBSCAN](https://ml.mirazulislamnahid.com/#/hdbscan) | Unsupervised · Density | ✅ Live |
| 2.1–2.3 | Decision Tree · Random Forest · Ensemble Learning | Trees & Ensembles | 🚧 Next |
| 3.1–3.3 | AdaBoost · XGBoost · CatBoost | Boosting | 🚧 Planned |
| 4.1 | Cross-Validation | Model Evaluation | 🚧 Planned |

<table>
<tr>
<td width="50%"><img src="docs/kmeans.png" alt="K-Means lecture example with distance tables" /><br><sub><b>K-Means</b> — the 5-point lecture example, mid-run, with the iteration table on the right.</sub></td>
<td width="50%"><img src="docs/hierarchical.png" alt="Hierarchical clustering with a live dendrogram" /><br><sub><b>Hierarchical</b> — single linkage draws the spanning tree; drag the dashed line to cut the dendrogram.</sub></td>
</tr>
<tr>
<td colspan="2"><img src="docs/dbscan.png" alt="DBSCAN on two moons with noise" /><br><sub><b>DBSCAN</b> — two moons found, noise left hollow, and a k-distance plot to choose ε.</sub></td>
</tr>
</table>

### What every playground has

- **Draw your own data.** Click to add points, drag to move them, spray whole clouds, erase. Everything re-runs live.
- **Presets.** Blobs, moons, rings, uneven groups, noisy data, different densities, overlap, a smiley.
- **Step-by-step playback.** Play, pause, single step, reset and speed, with a narrator and a step tracker for the current phase.
- **Live numbers.** Inertia, merge heights, memberships, core/border/noise counts, and charts such as the elbow and k-distance plots.
- **Learn tabs.** *Intuition* (analogies), *Math* (numbered equations, pseudocode), *Try this* (one-click challenges that show where the algorithm shines and where it fails).

### Per algorithm

| Playground | Highlights |
|---|---|
| **K-Means** | Rippling assignments, centroid footprints, Voronoi regions in a shader, K-Means++ / random / farthest-pair starts, Euclidean or Manhattan distance, elbow chart, bad-start challenge. |
| **Hierarchical** | Single, complete, average and centroid linkage; Euclidean or Manhattan; a growing dendrogram with a draggable cut line; distance-table exercise from the slides. |
| **Fuzzy C-Means** | Point colors blend by membership; a soft membership field fills the background; fuzziness *m* slider; hover any point for its membership bars. |
| **DBSCAN** | Visits one point per step with its ε-circle and neighbours; core / border / noise; k-distance plot; ε and minPts update the result live. |
| **HDBSCAN** | Core distances → mutual reachability → animated minimum spanning tree → condensed tree with stability. Switch between real HDBSCAN and the slides' threshold cut. |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `→` | One step |
| `R` | Reset (keeps your points) |
| `↑ ↑ ↓ ↓ ← → ← → B A` | Appendix A |

## Lecture mode

Each page has **From the lecture** buttons that load the exact worked examples from the course slides (same points, same settings), and a **Worked example** card that rebuilds the slide tables live as you step: distance matrices, centroid formulas, membership tables, ε-neighbourhoods, core distances and spanning-tree edges. The axes switch to the slides' units so every number matches.

The maths lives in pure `algo.js` files and was checked in Node against the slides:

| Example | Matches |
|---|---|
| K-Means, 5 points, k = 2 | Converges after 3 iterations to C1 = (3, 5), C2 = (5.5, 7); new point (2, 7) → Cluster 1. |
| Hierarchical, 5 points, Manhattan + centroid | Merge heights 1, 2, 5.5, 10.75. |
| Hierarchical, A–E distance table, single link | Merges at 2, 3, 4, 5. |
| Fuzzy C-Means, 1D x = 1, 2, 7, 8 | c₁ ≈ 2.34, c₂ ≈ 6.44, u₁₁ ≈ 0.94. |
| Fuzzy C-Means, 2D three points | c₁ ≈ (1.93, 2.35), c₂ ≈ (4.34, 3.50), u₁₁ ≈ 0.93. |
| DBSCAN, A–J, ε = 1.5, minPts = 3 | Two clusters, H is a border point, I and J are noise. |
| HDBSCAN, A–F, k = 2 | Core distances 1.41, 1, 1.41, 7.07, 7.21, 74.95; MST A–B, B–C, C–D, D–E, D–F; cut at ε = 7 → (A, B, C). |

Where a slide step is inconsistent, the card shows the correct value with a short 📌 note (for example, the final centroid in the hierarchical example, and one mutual-reachability value in the HDBSCAN example).

## Design

A soft **neumorphic** interface in warm sand, laid out like a research paper.

- **Surfaces** are either raised from the page or pressed into it. Buttons press in when clicked, and the simulation canvas is a pressed-in well.
- **Colors**: sand base `#EDE6DB` with earthy categorical colors (terracotta, teal, mustard, sage, plum, slate, rust, olive) that stay distinct on the background.
- **Type**: Source Serif 4 for headings, Inter for text, JetBrains Mono for numbers.
- **Paper touches**: § section numbers, *Abstract* lines, live **Figure** captions, numbered equations and notes, booktabs-style tables.
- **3D (three.js)** on the home page only, so lab pages stay focused:
  - **Figure 1**, a 1,500-point cloud that runs K-Means on itself in a loop (drag to rotate, double-click for new data);
  - a faint drifting neighbour graph in the background;
  - a small 3D figure on every card that animates on hover (all drawn by one shared WebGL renderer).
- Respects *reduce motion*, and pauses 3D when it's off-screen.

## Getting started

Requires **Node.js 18+** (developed on Node 22).

```bash
git clone https://github.com/TheRealNightmare/ML-Playground.git
cd ML-Playground
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built site locally |

## Project structure

```
ML-Playground/
├── index.html
├── public/favicon.svg
├── src/
│   ├── main.js                # hash router (#/kmeans), header, fonts
│   ├── home.js                # home page: hero figure, sections, cards
│   ├── konami.js              # Appendix A
│   ├── styles.css             # neumorphic warm-sand theme
│   ├── three/                 # 3D for the home page
│   │   ├── hero3d.js          # Figure 1: self-clustering 3D point cloud
│   │   ├── bgfield.js         # faint background neighbour graph
│   │   ├── cardart.js         # per-card 3D previews (one shared renderer)
│   │   └── points3d.js        # shaded round points, palette, figure box
│   ├── core/                  # shared by every playground
│   │   ├── pointlab.js        # scaffold: tools, datasets, lecture mode, narrator, playback
│   │   ├── lab.js             # page layout: § title, abstract, figure + caption
│   │   ├── stage.js           # orthographic 2D three.js stage
│   │   ├── layers.js          # points, stars, region shader, circles, segments, trails
│   │   ├── space.js           # slide units ↔ canvas units
│   │   ├── overlay.js         # point labels and axes in slide units
│   │   ├── worked.js          # worked-example tables and notes
│   │   ├── player.js          # play / pause / step / reset / speed
│   │   ├── chart.js           # small canvas line & bar charts
│   │   ├── datasets.js        # shared 2D datasets
│   │   ├── tex.js             # KaTeX helpers
│   │   ├── ui.js              # sliders, segmented controls, toggles, tabs
│   │   └── theme.js           # one palette for CSS, canvas and 3D
│   └── algorithms/
│       ├── index.js           # registry + sections
│       ├── kmeans/            # <id>.js page · algo.js pure math · content.js text
│       ├── hierarchical/
│       ├── fcm/
│       ├── dbscan/
│       └── hdbscan/
├── Dockerfile                 # node build → nginx serve (multi-arch)
├── nginx.conf                 # caching, gzip, headers, /healthz
├── .github/workflows/build.yml
└── DEPLOY.md                  # step-by-step Dokploy + Cloudflare Tunnel guide
```

No UI framework: plain ES modules, three.js for graphics, KaTeX for equations. Each playground is lazy-loaded.

## Adding an algorithm

1. Create `src/algorithms/<id>/<id>.js` exporting `mount(root)`, which returns an `unmount()` function.
2. For point-based algorithms, start from `createPointLab()`. It gives you the layout, drawing tools, datasets, lecture mode, narrator and playback; you fill in `L.hooks` (`reset`, `step`, `frame`, `labels`, …).
3. Put the maths in a pure `algo.js` so it can be checked in Node against the slide numbers.
4. Register it in `src/algorithms/index.js` (remove `soon: true` and add `load`):

```js
{
  id: 'decision-tree', section: 'trees',
  title: 'Decision Tree',
  category: 'Supervised · Trees', level: 'Beginner',
  tagline: 'Ask yes/no questions that split the data, picked by entropy or MSE.',
  accent: '#6B8E5A',
  load: () => import('./decision-tree/decision-tree.js'),
},
```

The home card, its § number and the `#/decision-tree` route appear automatically. Add a 3D preview for the card in `src/three/cardart.js` if you like.

## Deployment

The site is a static build served by nginx in Docker. It runs on a **Raspberry Pi with Dokploy**, behind a **Cloudflare Tunnel**, at **ml.mirazulislamnahid.com**.

**Short version** (full guide with checks and troubleshooting in **[DEPLOY.md](DEPLOY.md)**):

1. Dokploy → **Create Service → Application** → Provider **GitHub** → `TheRealNightmare/ML-Playground`, branch `main`.
2. Build Type **Dockerfile** (`Dockerfile`, context `.`).
3. Domains → Host `ml.mirazulislamnahid.com`, Path `/`, Container Port `80`, **HTTPS off** (Cloudflare handles TLS).
4. **Deploy**, then turn on **Autodeploy**.
5. Check: `curl https://ml.mirazulislamnahid.com/healthz` → `ok`.

Every push to `main` runs the **Build check** workflow (site build + arm64 Docker image smoke test) and triggers a Dokploy redeploy.

Run it anywhere with Docker:

```bash
docker build -t ml-playground .
docker run -d -p 8080:80 --restart unless-stopped ml-playground   # http://localhost:8080
```

## Roadmap

- [x] §1 Clustering: K-Means, Hierarchical, Fuzzy C-Means, DBSCAN, HDBSCAN
- [ ] §2 Trees & Ensembles: Decision Tree, Random Forest, Ensemble Learning
- [ ] §3 Boosting: AdaBoost, XGBoost, CatBoost
- [ ] §4 Model Evaluation: Cross-Validation

## Author

**Mirazul Islam Nahid**
[Portfolio](https://mirazulislamnahid.com) · [GitHub](https://github.com/TheRealNightmare) · [Blog](https://therealnightmare.github.io)
