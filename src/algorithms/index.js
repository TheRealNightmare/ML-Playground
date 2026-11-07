// Every simulation is registered here. To add a new one:
//   1. create src/algorithms/<id>/<id>.js exporting `mount(root) => unmount()`
//   2. add an entry below (or flip `soon` off). The home page and router pick it up automatically.

export const SECTIONS = [
  { id: 'clustering', title: 'Clustering', heading: 'Find the groups', emoji: '', blurb: 'Find groups in data that has no labels.' },
  { id: 'trees', title: 'Trees & Ensembles', heading: 'Split & vote', emoji: '', blurb: 'Split data with questions, then combine many models into one.' },
  { id: 'boosting', title: 'Boosting', heading: 'Learn from mistakes', emoji: '', blurb: 'Build models one after another, each fixing the last one’s mistakes.' },
  { id: 'evaluation', title: 'Model Evaluation', heading: 'Test it honestly', emoji: '', blurb: 'Check honestly how well a model will do on new data.' },
];

export const ALGORITHMS = [
  {
    id: 'kmeans', section: 'clustering',
    title: 'K-Means Clustering', emoji: '',
    category: 'Unsupervised · Clustering', level: 'Beginner',
    tagline: 'Drop K stars on the map and watch them find the groups hiding in your data.',
    accent: '#D4A24C',
    load: () => import('./kmeans/kmeans.js'),
  },
  {
    id: 'hierarchical', section: 'clustering',
    title: 'Hierarchical Clustering', emoji: '',
    category: 'Unsupervised · Clustering', level: 'Beginner',
    tagline: 'Merge the two closest clusters again and again, and grow a dendrogram you can cut.',
    accent: '#6B8E5A',
    load: () => import('./hierarchical/hierarchical.js'),
  },
  {
    id: 'fcm', section: 'clustering',
    title: 'Fuzzy C-Means', emoji: '',
    category: 'Unsupervised · Soft clustering', level: 'Intermediate',
    tagline: 'Points can belong to several clusters at once — watch the colors blend.',
    accent: '#8A5A83',
    load: () => import('./fcm/fcm.js'),
  },
  {
    id: 'dbscan', section: 'clustering',
    title: 'DBSCAN', emoji: '',
    category: 'Unsupervised · Density', level: 'Intermediate',
    tagline: 'Grow clusters from dense regions and leave the lonely points as noise.',
    accent: '#3D8B8B',
    load: () => import('./dbscan/dbscan.js'),
  },
  {
    id: 'hdbscan', section: 'clustering',
    title: 'HDBSCAN', emoji: '',
    category: 'Unsupervised · Density', level: 'Advanced',
    tagline: 'Density clustering that handles groups of different densities — via a spanning tree.',
    accent: '#4F6D8A',
    load: () => import('./hdbscan/hdbscan.js'),
  },
  { id: 'decision-tree', section: 'trees', soon: true, title: 'Decision Tree', emoji: '', category: 'Supervised · Trees', level: 'Beginner', tagline: 'Ask yes/no questions that split the data, picked by entropy or MSE.', accent: '#6B8E5A' },
  { id: 'random-forest', section: 'trees', soon: true, title: 'Random Forest', emoji: '', category: 'Supervised · Ensemble', level: 'Intermediate', tagline: 'Many trees on bootstrap samples, voting together.', accent: '#4F6D8A' },
  { id: 'ensemble', section: 'trees', soon: true, title: 'Ensemble Learning', emoji: '', category: 'Concepts · Bias & variance', level: 'Beginner', tagline: 'Bagging vs boosting vs stacking, and the bias–variance dartboard.', accent: '#C46A8A' },
  { id: 'adaboost', section: 'boosting', soon: true, title: 'AdaBoost', emoji: '', category: 'Supervised · Boosting', level: 'Intermediate', tagline: 'Re-weight the mistakes so the next stump focuses on them.', accent: '#D4A24C' },
  { id: 'xgboost', section: 'boosting', soon: true, title: 'XGBoost', emoji: '', category: 'Supervised · Boosting', level: 'Advanced', tagline: 'Gradients, Hessians and gain — boosting with second-order math.', accent: '#E07A5F' },
  { id: 'catboost', section: 'boosting', soon: true, title: 'CatBoost', emoji: '', category: 'Supervised · Boosting', level: 'Advanced', tagline: 'Ordered target encoding for categories, then gradient boosting.', accent: '#8A5A83' },
  { id: 'cross-validation', section: 'evaluation', soon: true, title: 'Cross-Validation', emoji: '', category: 'Concepts · Evaluation', level: 'Beginner', tagline: 'Holdout, K-fold, LOOCV and stratified folds, animated.', accent: '#3D8B8B' },
];

export const findAlgorithm = (id) => ALGORITHMS.find((a) => a.id === id && !a.soon);
