import os
import json
import numpy as np
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans, AgglomerativeClustering, SpectralBiclustering
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from collections import defaultdict
import re
import string
from nltk.tag import pos_tag
from nltk.chunk import ne_chunk
import multiprocessing
from scipy.sparse import issparse
# Add this import at the top of the file
import pandas as pd

def visualize_tfidf_features(X, vectorizer, kmeans, filenames, optimal_k):
    """
    Visualize TF-IDF features with actual feature names
    """
    # Get feature names from vectorizer
    feature_names = vectorizer.get_feature_names_out()
    
    # Visualize top features per cluster
    top_terms_per_cluster = {}
    order_centroids = kmeans.cluster_centers_.argsort()[:, ::-1]
    
    for i in range(optimal_k):
        top_terms = [feature_names[ind] for ind in order_centroids[i, :10]]
        top_terms_per_cluster[i] = top_terms
    
    # Plot top features for each cluster
    plt.figure(figsize=(15, 10))
    for i in range(optimal_k):
        plt.subplot(1, optimal_k, i+1)
        y_pos = np.arange(len(top_terms_per_cluster[i]))
        # Get TF-IDF scores for the top terms
        term_scores = [kmeans.cluster_centers_[i][order_centroids[i, j]] for j in range(10)]
        plt.barh(y_pos, term_scores, align='center')
        plt.yticks(y_pos, top_terms_per_cluster[i])
        plt.title(f'Cluster {i}')
        plt.tight_layout()
    
    plt.savefig('cluster_features.png', dpi=300)
    
    # Create a visualization of the most important features across all documents
    # Sum TF-IDF scores across all documents for each feature
    feature_importance = X.sum(axis=0).A1 if issparse(X) else X.sum(axis=0)
    # Create a DataFrame with feature names and their importance
    feature_df = pd.DataFrame({'feature': feature_names, 'importance': feature_importance})
    feature_df = feature_df.sort_values('importance', ascending=False).head(20)
    
    plt.figure(figsize=(12, 8))
    plt.barh(feature_df['feature'], feature_df['importance'])
    plt.xlabel('TF-IDF Score Sum')
    plt.ylabel('Features')
    plt.title('Top 20 Features by TF-IDF Score')
    plt.gca().invert_yaxis()  # Display highest score at the top
    plt.tight_layout()
    plt.savefig('top_features.png', dpi=300)
    
    # Create PCA visualization with document names
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X.toarray() if issparse(X) else X)
    
    # Create a DataFrame for the PCA results
    pca_df = pd.DataFrame(X_pca, columns=['PC1', 'PC2'])
    pca_df['cluster'] = kmeans.labels_
    pca_df['document'] = filenames
    
    # Plot clusters
    plt.figure(figsize=(10, 8))
    scatter = plt.scatter(pca_df['PC1'], pca_df['PC2'], c=pca_df['cluster'], cmap='viridis')
    plt.title('Document Clusters Visualization (PCA)')
    plt.xlabel('Principal Component 1')
    plt.ylabel('Principal Component 2')
    plt.colorbar(scatter, label='Cluster')
    
    # Add document IDs as annotations
    for i, row in pca_df.iterrows():
        plt.annotate(row['document'], (row['PC1'], row['PC2']), fontsize=8)
    
    plt.savefig('document_clusters.png', dpi=300)
    
    return top_terms_per_cluster


# Download necessary NLTK resources
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('wordnet', quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
nltk.download('maxent_ne_chunker', quiet=True)
nltk.download('words', quiet=True)

def preprocess_text(text):
    """
    Preprocess text by tokenizing, removing stopwords, and lemmatizing
    """
    # Convert to lowercase
    text = text.lower()
    
    # Remove punctuation
    text = re.sub(f'[{string.punctuation}]', ' ', text)
    
    # Tokenize
    tokens = word_tokenize(text)
    
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = [token for token in tokens if token not in stop_words]
    
    # Lemmatize
    lemmatizer = WordNetLemmatizer()
    tokens = [lemmatizer.lemmatize(token) for token in tokens]
    
    return ' '.join(tokens)

def extract_named_entities(text):
    """
    Extract named entities (people, organizations, locations) from text
    """
    entities = {
        'PERSON': [],
        'ORGANIZATION': [],
        'LOCATION': [],
        'GPE': [],
        'FACILITY': []
    }
    
    try:
        # Tokenize and tag parts of speech
        tokens = word_tokenize(text)
        pos_tags = pos_tag(tokens)
        
        # Extract named entities
        named_entities = ne_chunk(pos_tags)
        
        # Process named entities
        for chunk in named_entities:
            if hasattr(chunk, 'label'):
                entity_type = chunk.label()
                if entity_type in entities:
                    entity_text = ' '.join([c[0] for c in chunk])
                    entities[entity_type].append(entity_text)
    except Exception as e:
        print(f"Error extracting named entities: {e}")
    
    return entities

def process_document(args):
    """
    Process a single document for parallel execution
    """
    doc, filename = args
    preprocessed = preprocess_text(doc)
    entities = extract_named_entities(doc)
    return filename, preprocessed, entities

def determine_optimal_clusters(X, max_clusters=10):
    """
    Determine the optimal number of clusters using the elbow method
    """
    # Ensure we have enough samples for clustering
    n_samples = X.shape[0]
    max_clusters = min(max_clusters, n_samples - 1)
    
    if max_clusters < 2:
        print("Not enough samples for meaningful clustering. Using 2 clusters.")
        return 2
    
    # Convert to dense if sparse
    if issparse(X):
        X_data = X.toarray()
    else:
        X_data = X
    
    inertia = []
    silhouette_scores = []
    k_values = list(range(2, max_clusters + 1))
    
    for k in k_values:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        kmeans.fit(X)
        inertia.append(kmeans.inertia_)
        
        # Calculate silhouette score if we have more than one cluster
        if k > 1:
            labels = kmeans.labels_
            try:
                silhouette_scores.append(silhouette_score(X, labels))
            except Exception as e:
                print(f"Error calculating silhouette score for k={k}: {e}")
                silhouette_scores.append(0)
    
    # Plot the elbow curve
    plt.figure(figsize=(12, 5))
    
    plt.subplot(1, 2, 1)
    plt.plot(k_values, inertia, 'bo-')
    plt.xlabel('Number of clusters')
    plt.ylabel('Inertia')
    plt.title('Elbow Method for Optimal k')
    
    # Make sure we have silhouette scores to plot
    if silhouette_scores:
        plt.subplot(1, 2, 2)
        plt.plot(k_values, silhouette_scores, 'ro-')
        plt.xlabel('Number of clusters')
        plt.ylabel('Silhouette Score')
        plt.title('Silhouette Method for Optimal k')
    
    plt.tight_layout()
    plt.savefig('optimal_clusters.png')
    
    # Determine optimal k (this is a simple heuristic, can be improved)
    if len(inertia) > 2:
        # Find the point of maximum curvature in the inertia plot
        inertia_diff = np.diff(inertia)
        inertia_diff2 = np.diff(inertia_diff)
        optimal_k = k_values[np.argmax(np.abs(inertia_diff2)) + 1]
    else:
        optimal_k = 2  # Default to 2 clusters if we can't determine optimal k
    
    return optimal_k

def main():
    try:
        # Get all document files from the dataset directory
        dataset_dir = os.path.join(os.getcwd(), 'dataset')
        documents = []
        filenames = []
        
        if not os.path.exists(dataset_dir):
            print(f"Dataset directory not found: {dataset_dir}")
            return
        
        # Load documents
        for filename in os.listdir(dataset_dir):
            file_path = os.path.join(dataset_dir, filename)
            if os.path.isfile(file_path):
                try:
                    if not filename.endswith('.txt'):
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                            content = file.read()
                            documents.append(content)
                            filenames.append(filename)
                except Exception as e:
                    print(f"Error reading file {filename}: {e}")
        
        if not documents:
            print("No documents found in the dataset directory")
            return
        
        print(f"Loaded {len(documents)} documents")
        
        # Process documents in parallel
        with multiprocessing.Pool(processes=multiprocessing.cpu_count()) as pool:
            results = pool.map(process_document, zip(documents, filenames))
        
        # Unpack results
        processed_data = {}
        preprocessed_documents = []
        document_entities = {}
        
        for filename, preprocessed, entities in results:
            processed_data[filename] = {'preprocessed': preprocessed, 'entities': entities}
            preprocessed_documents.append(preprocessed)
            document_entities[filename] = entities
        
        # Create TF-IDF matrix
        vectorizer = TfidfVectorizer(max_df=0.8, min_df=1, stop_words='english')
        X = vectorizer.fit_transform(preprocessed_documents)
        feature_names = vectorizer.get_feature_names_out().tolist()
        
        print(f"TF-IDF matrix shape: {X.shape}")
        
        # Determine optimal number of clusters (with a minimum of 2)
        optimal_k = max(2, determine_optimal_clusters(X))
        print(f"Optimal number of clusters: {optimal_k}")
        
        # Perform K-means clustering
        kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
        kmeans_labels = kmeans.fit_predict(X)
        
        # Perform hierarchical clustering
        # Convert to dense array for hierarchical clustering
        X_dense = X.toarray() if issparse(X) else X
        hierarchical = AgglomerativeClustering(n_clusters=optimal_k)
        hierarchical_labels = hierarchical.fit_predict(X_dense)
        
        # Perform biclustering
        try:
            biclustering = SpectralBiclustering(n_clusters=optimal_k, random_state=42)
            biclustering.fit(X)
            biclustering_labels = biclustering.row_labels_
        except Exception as e:
            print(f"Error in biclustering: {e}")
            biclustering_labels = np.zeros(len(documents), dtype=int)  # Default to all zeros
        
        # Create a dictionary of clustering results
        clustering_results = {
            'documents': filenames,
            'kmeans': kmeans_labels.tolist(),
            'hierarchical': hierarchical_labels.tolist(),
            'biclustering': biclustering_labels.tolist()
        }
        top_terms_per_cluster = visualize_tfidf_features(X, vectorizer, kmeans, filenames, optimal_k)
        clustering_results['top_terms'] = top_terms_per_cluster
        # Save clustering results to JSON
        with open('clustering_results.json', 'w') as f:
            json.dump(clustering_results, f)
        
        # Save document features (TF-IDF matrix and entities) to JSON
        document_features = {
            'features': X.toarray().tolist() if issparse(X) else X.tolist(),
            'entities': document_entities,
            'feature_names': feature_names
        }
        
        with open('document_features.json', 'w') as f:
            json.dump(document_features, f)
        
        # Print top terms per cluster for K-means
        print("Top terms per K-means cluster:")
        order_centroids = kmeans.cluster_centers_.argsort()[:, ::-1]
        terms = vectorizer.get_feature_names_out()
        
        for i in range(optimal_k):
            print(f"Cluster {i}: ", end="")
            for ind in order_centroids[i, :10]:
                print(f"{terms[ind]} ", end="")
            print()
        
        # Visualize clusters with PCA
        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X.toarray() if issparse(X) else X)

        
        
        plt.figure(figsize=(10, 8))
        scatter = plt.scatter(X_pca[:, 0], X_pca[:, 1], c=kmeans_labels, cmap='viridis')
        plt.title('Document Clusters Visualization (PCA)')
        plt.xlabel('Principal Component 1')
        plt.ylabel('Principal Component 2')
        plt.colorbar(scatter, label='Cluster')
        
        # Add document IDs as annotations
        for i, filename in enumerate(filenames):
            plt.annotate(filename, (X_pca[i, 0], X_pca[i, 1]), fontsize=8)
        
        plt.savefig('document_clusters.png', dpi=300)
        
        # Create cluster-document mapping
        cluster_documents = defaultdict(list)
        for i, cluster_id in enumerate(kmeans_labels):
            cluster_documents[int(cluster_id)].append(filenames[i])

        
        # Save cluster-document mapping to JSON
        with open('cluster_documents.json', 'w') as f:
            json.dump(dict(cluster_documents), f)
        
        print("Clustering completed. Results saved to clustering_results.json and document_features.json")
    
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
