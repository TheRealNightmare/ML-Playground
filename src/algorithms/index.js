// Every simulation is registered here. To add a new one:
//   1. create src/algorithms/<id>/<id>.js exporting `mount(root) => unmount()`
//   2. add an entry below. The home page and router pick it up automatically.

export const ALGORITHMS = [
  {
    id: 'kmeans',
    title: 'K-Means Clustering',
    emoji: '⭐',
    category: 'Unsupervised · Clustering',
    level: 'Beginner',
    tagline: 'Drop K stars on the map and watch them find the groups hiding in your data.',
    accent: '#FFC93C',
    load: () => import('./kmeans/kmeans.js'),
  },
];

export const findAlgorithm = (id) => ALGORITHMS.find((a) => a.id === id);
