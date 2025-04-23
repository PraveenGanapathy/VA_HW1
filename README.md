
# Document Visualization Platform (DocViz)

A web-based platform to **visualize, cluster, and organize documents interactively**. DocViz supports dynamic document comparison, text clustering using machine learning, and an interactive drag-and-drop workspace for multi-document analysis.

---

## 📄 Overview

DocViz enables users to:
- Open and explore documents from a dataset.
- Drag, move, minimize, and close multiple documents in a shared workspace.
- Automatically group documents using clustering algorithms like KMeans and Hierarchical Clustering.
- Visually compare relationships between documents via MDS (Multidimensional Scaling).
- Organize or rearrange documents by their assigned cluster visually.

---

## ⚙️ How It Works

### Frontend (JavaScript / HTML / D3.js / Bootstrap)
- Provides interactive UI with drag-and-drop capabilities.
- Built with plain JavaScript and Bootstrap.
- MDS graph rendered using D3.js (`renderMDSPlot`) with cluster color coding and zoom support.
- Cluster organization logic triggered by buttons, with keyboard shortcut bindings.

### Backend (Node.js / Express)
- Express-based server (`server.js`) provides APIs to:
  - Serve document content.
  - Serve static files.
  - Provide clustering results (`/api/cluster-documents`).
  - Handle caching with `node-cache`.

### Data Pipeline (Python)
- A Python script (`document_clustering.py`) is run periodically or manually to:
  - Read all text documents from the `/dataset` folder.
  - Preprocess the text (tokenization, stopword removal, lemmatization).
  - Convert text to TF-IDF vectors.
  - Perform KMeans and Hierarchical Clustering.
  - Generate MDS coordinates for 2D projection.
  - Output files:
    - `data/clustering_results.json`
    - `data/document_features.json`

### GitHub Actions
- A workflow automatically re-runs the clustering pipeline when:
  - Python file is updated
  - The dataset is modified
- On push, GitHub Action:
  - Installs dependencies (Python, `scikit-learn`, `spacy`, `nltk`, etc.)
  - Runs `document_clustering.py`
  - Pushes generated JSON outputs back to `data/` directory

---

## 🧩 Dependencies

### Python (used for ML and data generation)
- `scikit-learn` — clustering and dimensionality reduction
- `spacy` — NLP preprocessing (lemmatization, tokenization)
- `nltk` — stopword filtering
- `numpy`, `pandas` — matrix and data handling

### JavaScript / Web
- `Bootstrap` — layout and styling
- `D3.js` — interactive visualizations (MDS, tooltips)
- `Plotly.js` — heatmaps, scatter plots, dendrograms

### Node
- `express` — server backend
- `node-cache` — in-memory caching for fast access
- `fs`, `path` — file operations

---

## 🚀 Setup Instructions

### Local Setup
```bash
git clone https://github.com/yourusername/docviz.git
cd docviz

npm install
mkdir dataset  # Add your `.txt` or `.md` files here

# Start the server
npm start

# Visit in browser
http://localhost:3000
```

### Run the clustering pipeline manually
```bash
python document_clustering.py
```

### Deployment on Vercel
```bash
vercel
```
- Make sure your `vercel.json` has the correct routes and build settings.
- Your server file should be named `server.js`.

---

## 💡 Features Summary

- Drag and drop interface to view documents.
- Clustering of documents by content similarity.
- Grouping, organizing, and toggling clusters visually.
- Hotkeys for organizing, clearing, refreshing.
- GitHub Actions auto-regenerate cluster data.
- Interactive MDS map with cluster insights.
