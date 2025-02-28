
  
 


Document Visualization Platform (DocViz)


---

 A web-based application for visualizing and organizing documents that allows users to browse, open, and arrange multiple documents simultaneously in a workspace.
     


## 📝 Table of Contents

- [About](#about)
- [Getting Started](#getting_started)
- [Deployment](#deployment)
- [Usage](#usage)
- [Built Using](#built_using)
- [Authors](#authors)

## 🧐 About 

DocViz is an advanced document visualization tool designed for visual analysts to efficiently explore, analyze, and organize multiple documents simultaneously. The platform provides an intuitive interface for comparing documents, identifying patterns, and extracting insights across various intelligence sources.

## 🏁 Getting Started 

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

What things you need to install:

```
Node.js (v14 or higher)
npm (v6 or higher)
```

### Installing

A step by step series of examples that tell you how to get a development environment running:

1. Clone the repository:
```
git clone https://github.com/yourusername/docviz.git
cd docviz
```

2. Install dependencies:
```
npm install
```

3. Create a dataset folder and add your documents:
```
mkdir dataset
```

4. Start the application:
```
npm start
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## 🎈 Usage 

### Document List
- Browse through categorized documents in the left panel
- Click on any document to open it in the workspace
- Drag documents from the list into the workspace

### Workspace
- Move documents by dragging their headers
- Minimize documents using the minimize button
- Close documents using the close button
- Organize documents by category with the "Organize" button
- Clear all documents with the "Clear All" button

### Keyboard Shortcuts
- **Ctrl/⌘ + O**: Organize documents
- **Ctrl/⌘ + C**: Clear all documents
- **Ctrl/⌘ + R**: Refresh document list
- **Esc**: Close active document

## 🚀 Deployment 

### Vercel Deployment
1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts to deploy

## ⛏️ Built Using 

- [Express](https://expressjs.com/) - Server Framework
- [NodeJs](https://nodejs.org/en/) - Server Environment
- [Bootstrap](https://getbootstrap.com/) - Frontend Framework

## ✍️ Authors 

- Visual Analysts Course - Project 1

- Readme generated @Readme_Pattern
