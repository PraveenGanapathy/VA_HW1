document.addEventListener('DOMContentLoaded', function() {
    const documentList = document.getElementById('document-list');
    const documentWorkspace = document.getElementById('document-workspace');
    
    // Color palette for document groups
    const colorPalette = [
        '#ffcdd2', '#f8bbd0', '#e1bee7', '#d1c4e9', '#c5cae9',
        '#bbdefb', '#b3e5fc', '#b2ebf2', '#b2dfdb', '#c8e6c9',
        '#dcedc8', '#f0f4c3', '#fff9c4', '#ffecb3', '#ffe0b2'
    ];
    
    // Track open documents and minimized documents
    let openDocuments = new Set();
    let minimizedDocs = [];
    
    // Function to load document data from the server
    function loadDocumentData() {
        fetch('/documents')
            .then(response => response.json())
            .then(files => {
                // Clear the list first
                documentList.innerHTML = '';
                
                // Group files by name (before the first underscore)
                const fileGroups = {};
                
                files.forEach(file => {
                    // Skip invalid files
                    if (!file || typeof file.name !== 'string') {
                        console.warn('File without a valid name property:', file);
                        return;
                    }
                    
                    // Get the base name (before first underscore)
                    const baseName = file.name.split('_')[0] || file.name;
                    
                    if (!fileGroups[baseName]) {
                        fileGroups[baseName] = [];
                    }
                    fileGroups[baseName].push(file);
                });
                
                // Create document groups
                Object.keys(fileGroups).sort().forEach((groupName, groupIndex) => {
                    // Assign a color from the palette
                    const groupColor = colorPalette[groupIndex % colorPalette.length];
                    
                    // Create group header
                    const docHeader = document.createElement('div');
                    docHeader.className = 'doc-header';
                    docHeader.textContent = groupName;
                    docHeader.style.backgroundColor = groupColor;
                    documentList.appendChild(docHeader);
                    
                    // Add each file in the group
                    fileGroups[groupName].forEach(file => {
                        // Create list item
                        const listItem = document.createElement('div');
                        listItem.className = 'list-group-item list-group-item-action';
                        listItem.textContent = file.name;
                        listItem.dataset.fileName = file.name;
                        listItem.dataset.groupName = groupName;
                        listItem.style.borderLeft = `4px solid ${groupColor}`;
                        
                        // Make the item draggable
                        listItem.setAttribute('draggable', 'true');
                        
                        // Add drag event listeners
                        listItem.addEventListener('dragstart', function(e) {
                            e.dataTransfer.setData('text/plain', file.name);
                            e.dataTransfer.setData('application/json', JSON.stringify({
                                fileName: file.name,
                                groupName: groupName,
                                groupColor: groupColor
                            }));
                            e.dataTransfer.effectAllowed = 'copy';
                            this.classList.add('dragging');
                        });
                        
                        listItem.addEventListener('dragend', function() {
                            this.classList.remove('dragging');
                        });
                        
                        // Add click event listener
                        listItem.addEventListener('click', function() {
                            loadFileContent(file.name, groupColor);
                        });
                        
                        documentList.appendChild(listItem);
                    });
                });
                
                // Highlight any documents that are already open
                updateDocumentHighlighting();
            })
            .catch(error => {
                console.error('Error loading documents:', error);
                alert('Error loading documents. See console for details.');
            });
    }
    
    // Function to update highlighting for all open documents
    function updateDocumentHighlighting() {
        // Clear all selections first
        document.querySelectorAll('.list-group-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Highlight all open documents
        openDocuments.forEach(fileName => {
            const listItem = document.querySelector(`.list-group-item[data-file-name="${fileName}"]`);
            if (listItem) {
                listItem.classList.add('selected');
            }
        });
    }
    
    // Function to load file content
    function loadFileContent(fileName, groupColor) {
        // Check if document is already open
        if (openDocuments.has(fileName)) {
            // Focus on the existing document
            const existingDoc = document.querySelector(`.document-window[data-file-name="${fileName}"]`);
            if (existingDoc) {
                // Bring to front
                const allDocuments = document.querySelectorAll('.document-window');
                allDocuments.forEach(doc => {
                    doc.style.zIndex = "10";
                });
                existingDoc.style.zIndex = "100";
                
                // Scroll to it if needed
                existingDoc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
        }
        
        fetch(`/documents/${fileName}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(fileContent => {
                // Add to open documents set
                openDocuments.add(fileName);
                
                const newDocument = document.createElement('div');
                newDocument.className = 'document-window';
                newDocument.dataset.fileName = fileName;
                
                // Create header with filename
                const header = document.createElement('div');
                header.className = 'document-header';
                
                // Add title span
                const titleSpan = document.createElement('span');
                titleSpan.className = 'document-header-title';
                titleSpan.textContent = fileName;
                
                // Create header buttons container
                const headerButtons = document.createElement('div');
                headerButtons.className = 'document-header-buttons';
                
                // Add minimize button
                const minimizeBtn = document.createElement('button');
                minimizeBtn.className = 'minimize-btn';
                minimizeBtn.innerHTML = '&#8212;'; // Horizontal line character
                minimizeBtn.title = 'Minimize';
                minimizeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    minimizeDocument(newDocument, fileName, groupColor);
                });
                
                // Add close button
                const closeBtn = document.createElement('button');
                closeBtn.className = 'close-btn';
                closeBtn.textContent = '×';
                closeBtn.title = 'Close';
                closeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    newDocument.remove();
                    
                    // Remove from open documents set
                    openDocuments.delete(fileName);
                    
                    // Remove from minimized docs if it was there
                    minimizedDocs = minimizedDocs.filter(doc => doc.fileName !== fileName);
                    updateMinimizedDocsBar();
                    
                    // Update highlighting
                    updateDocumentHighlighting();
                });
                
                // Add buttons to header
                headerButtons.appendChild(minimizeBtn);
                headerButtons.appendChild(closeBtn);
                
                // Create content area
                const content = document.createElement('pre');
                content.className = 'document-content';
                content.textContent = fileContent;
                
                // Assemble the document window
                header.appendChild(titleSpan);
                header.appendChild(headerButtons);
                header.style.backgroundColor = groupColor || '#f5f5f5';
                newDocument.appendChild(header);
                newDocument.appendChild(content);
                
                // Position the document in a visible area
                const offset = document.querySelectorAll('.document-window').length * 20;
                newDocument.style.position = 'absolute';
                newDocument.style.top = `${offset}px`;
                newDocument.style.left = `${offset}px`;
                
                documentWorkspace.appendChild(newDocument);
                
                // Make the document window draggable
                makeElementDraggable(newDocument);
                
                // Update highlighting for all open documents
                updateDocumentHighlighting();
                
                // Bring this document to front
                const allDocuments = document.querySelectorAll('.document-window');
                allDocuments.forEach(doc => {
                    doc.style.zIndex = "10";
                });
                newDocument.style.zIndex = "100";
            })
            .catch(error => {
                console.error('Error loading file:', error);
                alert(`Error loading file: ${error.message}`);
            });
    }
    
    // Function to minimize a document
    function minimizeDocument(docElement, fileName, groupColor) {
        // Remove the document from workspace
        docElement.remove();
        
        // Keep in open documents set
        // But remove from visible area
        
        // Add to minimized documents if not already there
        if (!minimizedDocs.find(doc => doc.fileName === fileName)) {
            minimizedDocs.push({
                fileName: fileName,
                groupColor: groupColor
            });
        }
        
        // Update the minimized documents bar
        updateMinimizedDocsBar();
    }
    
    // Function to update the minimized documents bar
    function updateMinimizedDocsBar() {
        // Get the minimized docs bar
        let minimizedBar = document.getElementById('minimized-docs-bar');
        
        // Clear the bar
        minimizedBar.innerHTML = '';
        
        // Add minimized documents
        minimizedDocs.forEach(doc => {
            const docTab = document.createElement('div');
            docTab.className = 'minimized-doc';
            docTab.textContent = doc.fileName;
            docTab.style.backgroundColor = doc.groupColor;
            docTab.addEventListener('click', function() {
                // Remove from minimized list
                minimizedDocs = minimizedDocs.filter(d => d.fileName !== doc.fileName);
                updateMinimizedDocsBar();
                
                // Restore the document
                loadFileContent(doc.fileName, doc.groupColor);
            });
            minimizedBar.appendChild(docTab);
        });
        
        // Show/hide bar based on content
        minimizedBar.style.display = minimizedDocs.length > 0 ? 'flex' : 'none';
    }
    
    // Enable drop functionality in the workspace
    documentWorkspace.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    documentWorkspace.addEventListener('drop', function(e) {
        e.preventDefault();
        
        // Try to get the JSON data first for more info
        let fileData;
        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData) {
                fileData = JSON.parse(jsonData);
            }
        } catch (err) {
            console.warn('Could not parse JSON data from drag event');
        }
        
        // Fall back to plain text if JSON is not available
        const fileName = fileData?.fileName || e.dataTransfer.getData('text/plain');
        const groupColor = fileData?.groupColor;
        
        if (fileName) {
            // Calculate drop position relative to workspace
            const rect = documentWorkspace.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            loadFileContentAtPosition(fileName, groupColor, x, y);
        }
    });
    
    // Function to load file content at a specific position
    function loadFileContentAtPosition(fileName, groupColor, x, y) {
        // Check if document is already open
        if (openDocuments.has(fileName)) {
            // Move the existing document to the new position
            const existingDoc = document.querySelector(`.document-window[data-file-name="${fileName}"]`);
            if (existingDoc) {
                existingDoc.style.left = `${x}px`;
                existingDoc.style.top = `${y}px`;
                
                // Bring to front
                const allDocuments = document.querySelectorAll('.document-window');
                allDocuments.forEach(doc => {
                    doc.style.zIndex = "10";
                });
                existingDoc.style.zIndex = "100";
                return;
            }
        }
        
        fetch(`/documents/${fileName}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(fileContent => {
                // Add to open documents set
                openDocuments.add(fileName);
                
                const newDocument = document.createElement('div');
                newDocument.className = 'document-window';
                newDocument.dataset.fileName = fileName;
                
                // Create header with filename
                const header = document.createElement('div');
                header.className = 'document-header';
                
                // Add title span
                const titleSpan = document.createElement('span');
                titleSpan.className = 'document-header-title';
                titleSpan.textContent = fileName;
                
                // Create header buttons container
                const headerButtons = document.createElement('div');
                headerButtons.className = 'document-header-buttons';
                
                // Add minimize button
                const minimizeBtn = document.createElement('button');
                minimizeBtn.className = 'minimize-btn';
                minimizeBtn.innerHTML = '&#8212;'; // Horizontal line character
                minimizeBtn.title = 'Minimize';
                minimizeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    minimizeDocument(newDocument, fileName, groupColor);
                });
                
                // Add close button
                const closeBtn = document.createElement('button');
                closeBtn.className = 'close-btn';
                closeBtn.textContent = '×';
                closeBtn.title = 'Close';
                closeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    newDocument.remove();
                    
                    // Remove from open documents set
                    openDocuments.delete(fileName);
                    
                    // Remove from minimized docs if it was there
                    minimizedDocs = minimizedDocs.filter(doc => doc.fileName !== fileName);
                    updateMinimizedDocsBar();
                    
                    // Update highlighting
                    updateDocumentHighlighting();
                });
                
                // Add buttons to header
                headerButtons.appendChild(minimizeBtn);
                headerButtons.appendChild(closeBtn);
                
                // Create content area
                const content = document.createElement('pre');
                content.className = 'document-content';
                content.textContent = fileContent;
                
                // Assemble the document window
                header.appendChild(titleSpan);
                header.appendChild(headerButtons);
                header.style.backgroundColor = groupColor || '#f5f5f5';
                newDocument.appendChild(header);
                newDocument.appendChild(content);
                
                // Position the document at the drop location
                newDocument.style.position = 'absolute';
                newDocument.style.top = `${y}px`;
                newDocument.style.left = `${x}px`;
                
                documentWorkspace.appendChild(newDocument);
                
                // Make the document window draggable
                makeElementDraggable(newDocument);
                
                // Update highlighting for all open documents
                updateDocumentHighlighting();
                
                // Bring this document to front
                const allDocuments = document.querySelectorAll('.document-window');
                allDocuments.forEach(doc => {
                    doc.style.zIndex = "10";
                });
                newDocument.style.zIndex = "100";
            })
            .catch(error => {
                console.error('Error loading file:', error);
                alert(`Error loading file: ${error.message}`);
            });
    }

    // Add organize button event listener
    document.getElementById('organize-btn').addEventListener('click', organizeDocuments);

    // Function to organize documents by group
    function organizeDocuments() {
        const documents = document.querySelectorAll('.document-window');
        if (documents.length === 0) return;
        
        // Group documents by their header color
        const groups = {};
        
        documents.forEach(doc => {
            const header = doc.querySelector('.document-header');
            const color = header.style.backgroundColor;
            
            if (!groups[color]) {
                groups[color] = [];
            }
            groups[color].push(doc);
        });
        
        // Position documents in columns by group
        let columnWidth = 320; // Width of each document + margin
        let columnGap = 20;    // Gap between columns
        let rowHeight = 20;    // Starting Y position
        let rowGap = 20;       // Gap between rows
        
        Object.keys(groups).forEach((color, columnIndex) => {
            const docs = groups[color];
            const columnX = columnIndex * (columnWidth + columnGap);
            
            docs.forEach((doc, rowIndex) => {
                const rowY = rowHeight + rowIndex * (doc.offsetHeight + rowGap);
                doc.style.left = `${columnX}px`;
                doc.style.top = `${rowY}px`;
                
                // Bring to front
                doc.style.zIndex = "20";
            });
        });
    }

    // Loading overlay functions
function showLoadingOverlay(message = "Processing...") {
    document.getElementById('loading-message').textContent = message;
    document.getElementById('loading-overlay').classList.remove('d-none');
}

function hideLoadingOverlay() {
    document.getElementById('loading-overlay').classList.add('d-none');
}

// Function to show error messages
function showErrorMessage(message) {
    // Create a toast notification
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '1100';
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="toast-header bg-danger text-white">
            <strong class="me-auto">Error</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    toastContainer.appendChild(toast);
    document.body.appendChild(toastContainer);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove the toast container after the toast is hidden
    toast.addEventListener('hidden.bs.toast', function() {
        document.body.removeChild(toastContainer);
    });
}

// Function to load file content at a specific position
function loadFileContentAtPosition(fileName, groupColor, x, y) {
    // Check if document is already open
    if (openDocuments.has(fileName)) {
        // Move the existing document to the new position
        const existingDoc = document.querySelector(`.document-window[data-file-name="${fileName}"]`);
        if (existingDoc) {
            existingDoc.style.left = `${x}px`;
            existingDoc.style.top = `${y}px`;
            
            // Bring to front
            const allDocuments = document.querySelectorAll('.document-window');
            allDocuments.forEach(doc => {
                doc.style.zIndex = "10";
            });
            existingDoc.style.zIndex = "100";
            return;
        }
    }
    
    fetch(`/documents/${fileName}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(fileContent => {
            // Add to open documents set
            openDocuments.add(fileName);
            
            const newDocument = document.createElement('div');
            newDocument.className = 'document-window';
            newDocument.dataset.fileName = fileName;
            
            // Create header with filename
            const header = document.createElement('div');
            header.className = 'document-header';
            
            // Add title span
            const titleSpan = document.createElement('span');
            titleSpan.className = 'document-header-title';
            titleSpan.textContent = fileName;
            
            // Create header buttons container
            const headerButtons = document.createElement('div');
            headerButtons.className = 'document-header-buttons';
            
            // Add minimize button
            const minimizeBtn = document.createElement('button');
            minimizeBtn.className = 'minimize-btn';
            minimizeBtn.innerHTML = '&#8212;'; // Horizontal line character
            minimizeBtn.title = 'Minimize';
            minimizeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                minimizeDocument(newDocument, fileName, groupColor);
            });
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-btn';
            closeBtn.textContent = '×';
            closeBtn.title = 'Close';
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                newDocument.remove();
                
                // Remove from open documents set
                openDocuments.delete(fileName);
                
                // Remove from minimized docs if it was there
                minimizedDocs = minimizedDocs.filter(doc => doc.fileName !== fileName);
                updateMinimizedDocsBar();
                
                // Update highlighting
                updateDocumentHighlighting();
            });
            
            // Add buttons to header
            headerButtons.appendChild(minimizeBtn);
            headerButtons.appendChild(closeBtn);
            
            // Create content area
            const content = document.createElement('pre');
            content.className = 'document-content';
            content.textContent = fileContent;
            
            // Assemble the document window
            header.appendChild(titleSpan);
            header.appendChild(headerButtons);
            header.style.backgroundColor = groupColor || '#f5f5f5';
            newDocument.appendChild(header);
            newDocument.appendChild(content);
            
            // Position the document at the drop location
            newDocument.style.position = 'absolute';
            newDocument.style.top = `${y}px`;
            newDocument.style.left = `${x}px`;
            
            documentWorkspace.appendChild(newDocument);
            
            // Make the document window draggable
            makeElementDraggable(newDocument);
            
            // Update highlighting for all open documents
            updateDocumentHighlighting();
            
            // Bring this document to front
            const allDocuments = document.querySelectorAll('.document-window');
            allDocuments.forEach(doc => {
                doc.style.zIndex = "10";
            });
            newDocument.style.zIndex = "100";
        })
        .catch(error => {
            console.error('Error loading file:', error);
            showErrorMessage(`Error loading file: ${error.message}`);
        });
}

// Function to open all documents in a cluster
function openAllDocumentsInCluster(fileNames, clusterColor) {
    // Calculate positions for documents in a grid layout
    const gridCols = Math.ceil(Math.sqrt(fileNames.length));
    const gridRows = Math.ceil(fileNames.length / gridCols);
    const docWidth = 320; // Width of document window
    const docHeight = 350; // Height of document window
    const spacing = 20; // Spacing between documents
    
    // Clear any existing documents first if user prefers
    if (confirm("Do you want to clear existing documents before opening the cluster?")) {
        document.getElementById('clear-all').click();
    }
    
    // Open each document in the cluster
    fileNames.forEach((fileName, index) => {
        const row = Math.floor(index / gridCols);
        const col = index % gridCols;
        
        const xPos = col * (docWidth + spacing);
        const yPos = row * (docHeight + spacing);
        
        // Load the document at the calculated position
        loadFileContentAtPosition(fileName, clusterColor, xPos, yPos);
    });
}

// Add event listener for the cluster button
document.getElementById('cluster-btn').addEventListener('click', function() {
    performDocumentClustering();
});

// Function to perform document clustering
function performDocumentClustering() {
    showLoadingOverlay("Clustering documents...");
    
    fetch('/api/cluster-documents', {
        method: 'POST'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Store clustering results in localStorage
        localStorage.setItem('clusteringResults', JSON.stringify(data));
        
        // Process clustering results
        showClusteringVisualization(data);
        hideLoadingOverlay();
    })
    .catch(error => {
        console.error('Error clustering documents:', error);
        hideLoadingOverlay();
        showErrorMessage(`Failed to cluster documents: ${error.message}`);
    });
}

// Function to organize documents by cluster
function organizeDocumentsByCluster(clusteringResults) {
    const clusterMethod = localStorage.getItem('preferredClusterMethod') || 'kmeans';
    const clusters = clusteringResults[clusterMethod];
    const documents = clusteringResults.documents;
    
    // Group documents by cluster
    const documentClusters = {};
    clusters.forEach((cluster, index) => {
        if (!documentClusters[cluster]) {
            documentClusters[cluster] = [];
        }
        documentClusters[cluster].push(documents[index]);
    });
    
    // Clear the current document list
    documentList.innerHTML = '';
    
    // Display clustering method and total documents
    const clusteringInfo = document.createElement('div');
    clusteringInfo.className = 'clustering-info alert alert-info';
    clusteringInfo.innerHTML = `
        <strong>Active Clustering Method:</strong> ${clusterMethod.toUpperCase()}<br>
        <strong>Total Documents:</strong> ${documents.length}
    `;
    documentList.appendChild(clusteringInfo);
    
    // Create cluster blocks
    Object.keys(documentClusters).sort().forEach((clusterID, groupIndex) => {
        const clusterColor = colorPalette[groupIndex % colorPalette.length];
        const clusterHeader = document.createElement('div');
        clusterHeader.className = 'doc-header cluster-header';
        clusterHeader.innerHTML = `
            <span>Cluster ${parseInt(clusterID) + 1}</span>
            <span class="badge bg-secondary">${documentClusters[clusterID].length} docs</span>
        `;
        clusterHeader.style.backgroundColor = clusterColor;
        
        // Add open all button
        const openAllBtn = document.createElement('button');
        openAllBtn.className = 'btn btn-sm open-all-btn';
        openAllBtn.innerHTML = '<i class="fas fa-folder-open"></i>';
        openAllBtn.title = 'Open all documents in this cluster';
        openAllBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openAllDocumentsInCluster(documentClusters[clusterID], clusterColor);
        });
        
        clusterHeader.appendChild(openAllBtn);
        documentList.appendChild(clusterHeader);
        
        // Add documents in this cluster
        documentClusters[clusterID].forEach(fileName => {
            const listItem = document.createElement('div');
            listItem.className = 'list-group-item list-group-item-action';
            listItem.textContent = fileName;
            listItem.dataset.fileName = fileName;
            listItem.dataset.clusterID = clusterID;
            listItem.style.borderLeft = `4px solid ${clusterColor}`;
            
            listItem.setAttribute('draggable', 'true');
            listItem.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', fileName);
                e.dataTransfer.setData('application/json', JSON.stringify({
                    fileName: fileName,
                    clusterID: clusterID,
                    clusterColor: clusterColor
                }));
                e.dataTransfer.effectAllowed = 'copy';
                this.classList.add('dragging');
            });
            
            listItem.addEventListener('dragend', function() {
                this.classList.remove('dragging');
            });
            
            listItem.addEventListener('click', function() {
                loadFileContent(fileName, clusterColor);
            });
            
            documentList.appendChild(listItem);
        });
    });
    
    updateDocumentHighlighting();
}



// Function to enable cluster reordering
function enableClusterReordering() {
    // Add event listeners for cluster headers
    const documentList = document.getElementById('document-list');
    
    // Enable drop on document list
    documentList.addEventListener('dragover', function(e) {
        e.preventDefault();
        const draggingElement = document.querySelector('.cluster-header.dragging');
        if (draggingElement) {
            e.dataTransfer.dropEffect = 'move';
        }
    });
    
    documentList.addEventListener('drop', function(e) {
        e.preventDefault();
        const clusterID = e.dataTransfer.getData('text/plain');
        const draggingHeader = document.querySelector(`.cluster-header.dragging`);
        
        if (draggingHeader) {
            // Find the closest cluster header to drop position
            const headers = [...document.querySelectorAll('.cluster-header:not(.dragging)')];
            const closestHeader = headers.reduce((closest, header) => {
                const box = header.getBoundingClientRect();
                const offset = e.clientY - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: header };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
            
            // Get all elements in the dragging cluster
            const clusterElements = [draggingHeader];
            let nextElement = draggingHeader.nextElementSibling;
            while (nextElement && !nextElement.classList.contains('cluster-header')) {
                clusterElements.push(nextElement);
                nextElement = nextElement.nextElementSibling;
            }
            
            // Insert the cluster before the closest header
            if (closestHeader) {
                clusterElements.forEach(element => {
                    documentList.insertBefore(element, closestHeader);
                });
            } else {
                // Append to the end if no closest header
                clusterElements.forEach(element => {
                    documentList.appendChild(element);
                });
            }
        }
    });
}

// Implement the function
function renderBiclustering(data) {
    if (!data || !data.biclustering || !data.documents || !data.features) {
        console.error('Invalid data for biclustering visualization');
        return;
    }
    
    const documents = data.documents;
    const clusters = data.biclustering;
    const features = data.features;
    
    // Group documents by cluster
    const clusterGroups = {};
    clusters.forEach((cluster, idx) => {
        if (!clusterGroups[cluster]) {
            clusterGroups[cluster] = [];
        }
        clusterGroups[cluster].push({
            document: documents[idx],
            index: idx,
            features: features[idx]
        });
    });
    
    // Create a heatmap for each cluster
    const plotData = [];
    
    Object.keys(clusterGroups).forEach((cluster, i) => {
        const clusterDocs = clusterGroups[cluster];
        const clusterFeatures = clusterDocs.map(d => d.features);
        const clusterDocNames = clusterDocs.map(d => d.document);
        
        plotData.push({
            z: clusterFeatures,
            x: clusterDocNames,
            y: Array.from({length: clusterFeatures[0].length}, (_, i) => `Feature ${i+1}`),
            type: 'heatmap',
            colorscale: 'Viridis',
            showscale: i === 0, // Only show colorscale for first cluster
            name: `Cluster ${parseInt(cluster) + 1}`,
            xgap: 1,
            ygap: 1
        });
    });
    
    const layout = {
        title: 'Biclustering Results',
        grid: {
            rows: Math.ceil(Object.keys(clusterGroups).length / 2),
            columns: Math.min(2, Object.keys(clusterGroups).length),
            pattern: 'independent'
        },
        height: 800
    };
    
    Plotly.newPlot('biclustering-viz', plotData, layout);
    
    // Add explanation
    const biclusteringDiv = document.getElementById('biclustering-viz');
}

function addKMeansExplanation() {
    if (document.querySelector('#kmeans-content .alert-secondary')) {
        return; // Don't add it again
    }
    const div = document.getElementById('kmeans-content');
    const explanation = document.createElement('div');
    explanation.className = 'alert alert-secondary mt-3';
    explanation.innerHTML = `
        <h5>K-Means Clustering Process:</h5>
        <ol>
            <li><strong>Preprocessing:</strong> Documents are tokenized, stop words removed, and terms are lemmatized</li>
            <li><strong>Feature Extraction:</strong> TF-IDF vectorization converts text to numerical features</li>
            <li><strong>Optimal K Selection:</strong> The elbow method determines the optimal number of clusters</li>
            <li><strong>Clustering:</strong> K-Means algorithm groups documents by minimizing within-cluster variance</li>
            <li><strong>Visualization:</strong> Documents are plotted in 2D space using dimensionality reduction</li>
        </ol>
        <p><strong>Formula:</strong> K-Means minimizes the sum of squared distances: \( \sum_{i=1}^{k} \sum_{x \in S_i} ||x - \mu_i||^2 \)</p>
    `;
    div.appendChild(explanation);
}

function addHierarchicalExplanation() {
    if (document.querySelector('#hierarchical-content .alert-secondary')) {
        return; // Don't add it again
    }
    const div = document.getElementById('hierarchical-content');
    const explanation = document.createElement('div');
    explanation.className = 'alert alert-secondary mt-3';
    explanation.innerHTML = `
        <h5>Hierarchical Clustering Process:</h5>
        <ol>
            <li><strong>Preprocessing:</strong> Documents are tokenized, stop words removed, and terms are lemmatized</li>
            <li><strong>Feature Extraction:</strong> TF-IDF vectorization converts text to numerical features</li>
            <li><strong>Distance Calculation:</strong> Pairwise distances between documents are computed</li>
            <li><strong>Agglomerative Clustering:</strong> Documents are merged into clusters bottom-up</li>
            <li><strong>Dendrogram Creation:</strong> The hierarchical structure is visualized as a tree</li>
        </ol>
        <p><strong>Method:</strong> Agglomerative clustering with Ward's linkage minimizes the increase in variance when merging clusters</p>
    `;
    div.appendChild(explanation);
}

function addBiclusteringExplanation() {
    if (document.querySelector('#biclustering-content .alert-secondary')) {
        return; // Don't add it again
    }
    const div = document.getElementById('biclustering-content');
    const explanation = document.createElement('div');
    explanation.className = 'alert alert-secondary mt-3';
    explanation.innerHTML = `
        <h5>Biclustering Process:</h5>
        <ol>
            <li><strong>Preprocessing:</strong> Documents are tokenized, stop words removed, and terms are lemmatized</li>
            <li><strong>Feature Extraction:</strong> TF-IDF vectorization converts text to numerical features</li>
            <li><strong>Spectral Decomposition:</strong> The document-term matrix is decomposed</li>
            <li><strong>Co-Clustering:</strong> Documents and terms are simultaneously clustered</li>
            <li><strong>Visualization:</strong> Biclusters are shown as submatrices of the document-term matrix</li>
        </ol>
        <p><strong>Advantage:</strong> Biclustering identifies subsets of documents that exhibit similar behavior across a subset of features</p>
    `;
    div.appendChild(explanation);
}


// Function to show clustering visualization
function showClusteringVisualization(clusteringData) {
    // Create modal for visualization
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'clusteringVisualizationModal';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'clusteringVisualizationModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    
    // Create modal content
    modal.innerHTML = `
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="clusteringVisualizationModalLabel">Document Clustering Visualization</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                
                <div class="modal-body">
                <div class="alert alert-info mb-3">
    <h5>Document Clustering Overview</h5>
    <p>This visualization shows how documents are grouped based on their content similarity using different clustering algorithms.</p>
</div>
                    <ul class="nav nav-tabs" id="clusteringTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="feature-tab" data-bs-toggle="tab" data-bs-target="#feature-content" type="button" role="tab">TF-IDF Features</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="kmeans-tab" data-bs-toggle="tab" data-bs-target="#kmeans-content" type="button" role="tab">K-Means</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="hierarchical-tab" data-bs-toggle="tab" data-bs-target="#hierarchical-content" type="button" role="tab">Hierarchical</button>
                        </li>
                        <li class="nav-item" role="presentation">
    <button class="nav-link" id="biclustering-tab" data-bs-toggle="tab" data-bs-target="#biclustering-content" type="button" role="tab">Biclustering</button>
</li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="entities-tab" data-bs-toggle="tab" data-bs-target="#entities-content" type="button" role="tab">Named Entities</button>
                        </li>
                    </ul>
                    <div class="tab-content pt-3" id="clusteringTabContent">
                        <div class="tab-pane fade show active" id="feature-content" role="tabpanel">
                            <div id="tfidf-heatmap" style="height: 500px;"></div>
                        </div>
                        <div class="tab-pane fade" id="kmeans-content" role="tabpanel">
                            <div id="kmeans-scatter" style="height: 500px;"></div>
                        </div>
                        <div class="tab-pane fade" id="hierarchical-content" role="tabpanel">
                            <div id="hierarchical-dendrogram" style="height: 500px;"></div>
                        </div>
                        <div class="tab-pane fade" id="biclustering-content" role="tabpanel">
    <div id="biclustering-viz" style="height: 500px;"></div>
</div>
                        <div class="tab-pane fade" id="entities-content" role="tabpanel">
                            <div id="entities-network" style="height: 500px;"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="form-group me-auto">
                        <label for="clusterMethodSelect">Preferred Clustering Method:</label>
                        <select id="clusterMethodSelect" class="form-select form-select-sm">
                            <option value="kmeans">K-Means</option>
                            <option value="hierarchical">Hierarchical</option>
                            <option value="biclustering">Biclustering</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-primary" id="applyClusteringBtn">Apply Clustering</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;


    
    document.body.appendChild(modal);
    
    // Initialize the modal
    const modalElement = new bootstrap.Modal(document.getElementById('clusteringVisualizationModal'));
    modalElement.show();
    
    // Initialize visualizations when tabs are shown
    document.getElementById('feature-tab').addEventListener('shown.bs.tab', function() {
        renderTfidfHeatmap(clusteringData);
    });
    
    document.getElementById('kmeans-tab').addEventListener('shown.bs.tab', function() {
        renderKMeansScatter(clusteringData);
        addKMeansExplanation();
    });
    
    document.getElementById('hierarchical-tab').addEventListener('shown.bs.tab', function() {
        renderHierarchicalDendrogram(clusteringData);
        addHierarchicalExplanation();
    });

    document.getElementById('biclustering-tab').addEventListener('shown.bs.tab', function() {
        renderBiclustering(clusteringData);
        addBiclusteringExplanation();
    });
    
    document.getElementById('entities-tab').addEventListener('shown.bs.tab', function() {
        renderEntitiesNetwork(clusteringData);
    });
    
    // Set preferred clustering method
    const clusterMethodSelect = document.getElementById('clusterMethodSelect');
    clusterMethodSelect.value = localStorage.getItem('preferredClusterMethod') || 'kmeans';
    
    // Apply clustering button
    document.getElementById('applyClusteringBtn').addEventListener('click', function() {
        localStorage.setItem('preferredClusterMethod', clusterMethodSelect.value);
        organizeDocumentsByCluster(clusteringData);
        modalElement.hide();
    });
    
    // Render initial visualization
    renderTfidfHeatmap(clusteringData);
}

// Function to render TF-IDF heatmap
function renderTfidfHeatmap(data) {
    if (!data || !data.features || !data.documents) {
        console.error('Invalid data for TF-IDF heatmap');
        return;
    }
    
    const features = data.features;
    const documents = data.documents;
    console.log(data);
    const featureNames = data.feature_names || [];
    
    // Get top features for better visualization
    const featureImportance = features.reduce((acc, doc, docIdx) => {
        doc.forEach((value, featureIdx) => {
            if (!acc[featureIdx]) acc[featureIdx] = 0;
            acc[featureIdx] += Math.abs(value); // Use absolute value to handle negative values
        });
        return acc;
    }, {});
    
    // Sort features by importance and get top 30
    const topFeatureIndices = Object.keys(featureImportance)
        .sort((a, b) => featureImportance[b] - featureImportance[a])
        .slice(0, 30)
        .map(Number);
    
    // Create a reduced matrix with only top features
    const reducedFeatures = features.map(doc => 
        topFeatureIndices.map(idx => {
            // Replace NaN, null, or undefined with 0
            const value = doc[idx];
            return (value === null || value === undefined || isNaN(value)) ? 0 : value;
        })
    );
    
    // Create feature labels using actual names
    const featureLabels = topFeatureIndices.map(i => 
        featureNames[i] || `Feature ${i+1}`
    );
    
    // Create heatmap data
    const heatmapData = [{
        z: reducedFeatures,
        x: documents,
        y: featureLabels,
        type: 'heatmap',
        colorscale: 'Viridis',
        hoverongaps: false,
        showscale: true,
        zmin: 0,  // Set minimum value
        zauto: true,  // Auto-scale colors
        connectgaps: true  // Connect gaps across null/NaN values
    }];
    
    const layout = {
        title: 'TF-IDF Feature Matrix (Top Features)',
        xaxis: {
            title: 'Documents',
            tickangle: -45
        },
        yaxis: {
            title: 'Features'
        },
        margin: {
            l: 150,
            r: 50,
            b: 120,
            t: 50,
            pad: 4
        },
        paper_bgcolor: '#f8f9fa',
        plot_bgcolor: '#f8f9fa'
    };
    
    Plotly.newPlot('tfidf-heatmap', heatmapData, layout);
}





// Function to render K-Means clustering visualization
function renderKMeansScatter(data) {
    const documents = data.documents;
    const clusters = data.kmeans;
    
    // Apply PCA to reduce dimensions to 2D for visualization
    // This is a simplified version - in production you'd use a proper PCA implementation
    const features = data.features;
    
    // Create a simple 2D projection (random for demo)
    // In a real implementation, you'd compute this with PCA
    const points = features.map((doc, i) => {
        // Create a deterministic but varied mapping for demo
        const x = Math.cos(i * 0.5) * 5 + (clusters[i] * 2) + (Math.random() * 0.5);
        const y = Math.sin(i * 0.5) * 5 + (clusters[i] * 2) + (Math.random() * 0.5);
        return [x, y];
    });
    
    // Create scatter plot data
    const scatterData = [];
    
    // Create a trace for each cluster
    const uniqueClusters = [...new Set(clusters)];
    uniqueClusters.forEach(cluster => {
        const clusterPoints = {
            x: [],
            y: [],
            text: [],
            mode: 'markers',
            type: 'scatter',
            name: `Cluster ${parseInt(cluster) + 1}`,
            marker: {
                size: 12
            }
        };
        
        // Add points for this cluster
        clusters.forEach((c, i) => {
            if (c === cluster) {
                clusterPoints.x.push(points[i][0]);
                clusterPoints.y.push(points[i][1]);
                clusterPoints.text.push(documents[i]);
            }
        });
        
        scatterData.push(clusterPoints);
    });
    
    const layout = {
        title: 'K-Means Clustering Visualization',
        xaxis: {
            title: 'Component 1'
        },
        yaxis: {
            title: 'Component 2'
        },
        hovermode: 'closest'
    };
    
    Plotly.newPlot('kmeans-scatter', scatterData, layout);
}

// Function to render hierarchical clustering dendrogram
function renderHierarchicalDendrogram(data) {
    if (!data || !data.hierarchical || !data.documents) {
        console.error('Invalid data for hierarchical dendrogram');
        return;
    }
    
    const documents = data.documents;
    const clusters = data.hierarchical;
    
    // Group documents by cluster
    const clusterGroups = {};
    clusters.forEach((cluster, idx) => {
        if (!clusterGroups[cluster]) {
            clusterGroups[cluster] = [];
        }
        clusterGroups[cluster].push(documents[idx]);
    });
    
    // Create a more realistic dendrogram structure
    const dendrogramData = [];
    
    // Create a trace for each cluster
    Object.keys(clusterGroups).forEach((cluster, i) => {
        const clusterDocs = clusterGroups[cluster];
        
        dendrogramData.push({
            x: clusterDocs.map((_, idx) => idx * 10),
            y: clusterDocs.map(() => i * 10),
            mode: 'markers+text',
            type: 'scatter',
            name: `Cluster ${parseInt(cluster) + 1}`,
            text: clusterDocs,
            textposition: 'top center',
            marker: { size: 10, color: `hsl(${(i * 360 / Object.keys(clusterGroups).length) % 360}, 70%, 50%)` }
        });
    });
    
    const layout = {
        title: 'Hierarchical Clustering Results',
        showlegend: true,
        height: 600,
        xaxis: {
            showticklabels: false,
            showgrid: false,
            zeroline: false
        },
        yaxis: {
            showticklabels: false,
            showgrid: false,
            zeroline: false
        }
    };
    
    Plotly.newPlot('hierarchical-dendrogram', dendrogramData, layout);
    
    // Add explanation
    const dendrogramDiv = document.getElementById('hierarchical-dendrogram');
    const note = document.createElement('div');
    note.className = 'alert alert-info mt-3';
    note.innerHTML = `
        <h5>Hierarchical Clustering Visualization</h5>
        <p>This visualization shows documents grouped by their hierarchical cluster assignments. 
        A true dendrogram would show the full hierarchical structure with distance measurements, 
        which requires the full distance matrix from the clustering algorithm.</p>
    `;
    dendrogramDiv.appendChild(note);
}


// Function to render named entities network
function renderEntitiesNetwork(data) {
    const entities = data.entities;
    const documents = data.documents;
    
    // Create a visualization of entities across documents
    // This would be better with a network visualization library like vis.js
    
    // For now, create a simple visualization using Plotly
    const entityTypes = ['PERSON', 'ORGANIZATION', 'LOCATION', 'GPE', 'FACILITY'];
    const entityCounts = {};
    
    // Count entities by type across documents
    Object.keys(entities).forEach(docId => {
        const docEntities = entities[docId];
        
        entityTypes.forEach(type => {
            if (!entityCounts[type]) entityCounts[type] = 0;
            if (docEntities[type]) {
                entityCounts[type] += docEntities[type].length;
            }
        });
    });
    
    // Create bar chart data
    const barData = [{
        x: Object.keys(entityCounts),
        y: Object.values(entityCounts),
        type: 'bar',
        marker: {
            color: ['#FF9800', '#2196F3', '#4CAF50', '#9C27B0', '#F44336']
        }
    }];
    
    const layout = {
        title: 'Named Entity Distribution Across Documents',
        xaxis: {
            title: 'Entity Type'
        },
        yaxis: {
            title: 'Count'
        }
    };
    
    Plotly.newPlot('entities-network', barData, layout);
    
    // Add note about network visualization
    const networkDiv = document.getElementById('entities-network');
    const note = document.createElement('div');
    note.className = 'alert alert-info mt-3';
    note.innerHTML = `
        <h5>Entity Network Visualization</h5>
        <p>A full entity network visualization would show connections between documents and entities, 
        highlighting relationships and patterns. For a production implementation, consider using a 
        dedicated network visualization library like vis.js or D3.js.</p>
    `;
    networkDiv.appendChild(note);
}
// Add event listener for the group button
document.getElementById('group-by-cluster-btn').addEventListener('click', function() {
    const clusteringResultsJson = localStorage.getItem('clusteringResults');
    
    if (clusteringResultsJson) {
        try {
            const clusteringResults = JSON.parse(clusteringResultsJson);
            organizeDocumentsByCluster(clusteringResults);
        } catch (e) {
            showErrorMessage("Error parsing clustering results. Please run clustering analysis again.");
        }
    } else {
        showErrorMessage("No clustering results available. Please run clustering analysis first.");
    }
});
// Function to organize documents in the workspace by cluster
function organizeDocumentsByClusterInWorkspace() {
    const clusteringResultsJson = localStorage.getItem('clusteringResults');
    
    if (!clusteringResultsJson) {
        showErrorMessage("No clustering results available. Please run clustering analysis first.");
        return;
    }
    
    try {
        const clusteringResults = JSON.parse(clusteringResultsJson);
        const clusterMethod = localStorage.getItem('preferredClusterMethod') || 'kmeans';
        const clusters = clusteringResults[clusterMethod];
        const documents = clusteringResults.documents;
        
        // Create a mapping of document names to their cluster IDs
        const documentClusterMap = {};
        documents.forEach((docName, index) => {
            documentClusterMap[docName] = clusters[index];
        });
        
        // Get all open documents in the workspace
        const openDocElements = document.querySelectorAll('.document-window');
        if (openDocElements.length === 0) {
            showErrorMessage("No documents are currently open in the workspace.");
            return;
        }
        
        // Group open documents by their cluster
        const clusterGroups = {};
        openDocElements.forEach(docElement => {
            const fileName = docElement.dataset.fileName;
            const clusterId = documentClusterMap[fileName];
            
            // Skip if we don't have clustering data for this document
            if (clusterId === undefined) return;
            
            if (!clusterGroups[clusterId]) {
                clusterGroups[clusterId] = [];
            }
            clusterGroups[clusterId].push(docElement);
        });
        
        // Position documents in columns by cluster
        let columnWidth = 320; // Width of each document + margin
        let columnGap = 20;    // Gap between columns
        let rowHeight = 20;    // Starting Y position
        let rowGap = 20;       // Gap between rows
        
        // Display clustering method and total documents in a notification
        const clusterInfo = document.createElement('div');
        clusterInfo.className = 'alert alert-info cluster-info';
        clusterInfo.innerHTML = `
            <strong>Active Clustering Method:</strong> ${clusterMethod.toUpperCase()}<br>
            <strong>Documents Organized:</strong> ${openDocElements.length}
        `;
        clusterInfo.style.position = 'absolute';
        clusterInfo.style.top = '10px';
        clusterInfo.style.right = '10px';
        clusterInfo.style.zIndex = '1000';
        clusterInfo.style.padding = '10px';
        clusterInfo.style.maxWidth = '300px';
        
        // Add a close button to the notification
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.style.float = 'right';
        closeBtn.addEventListener('click', () => clusterInfo.remove());
        clusterInfo.prepend(closeBtn);
        
        document.getElementById('document-workspace').appendChild(clusterInfo);
        
        // Set a timeout to remove the notification after 5 seconds
        setTimeout(() => {
            if (document.body.contains(clusterInfo)) {
                clusterInfo.remove();
            }
        }, 5000);
        
        // Organize documents by cluster
        Object.keys(clusterGroups).forEach((clusterId, columnIndex) => {
            const docs = clusterGroups[clusterId];
            const columnX = columnIndex * (columnWidth + columnGap);
            
            // Add a cluster label
            const clusterLabel = document.createElement('div');
            clusterLabel.className = 'cluster-label';
            clusterLabel.textContent = `Cluster ${parseInt(clusterId) + 1} (${docs.length} docs)`;
            clusterLabel.style.position = 'absolute';
            clusterLabel.style.left = `${columnX}px`;
            clusterLabel.style.top = `${rowHeight - 20}px`;
            clusterLabel.style.backgroundColor = colorPalette[columnIndex % colorPalette.length];
            clusterLabel.style.color = '#fff';
            clusterLabel.style.padding = '2px 8px';
            clusterLabel.style.borderRadius = '4px';
            clusterLabel.style.zIndex = '50';
            document.getElementById('document-workspace').appendChild(clusterLabel);
            
            docs.forEach((doc, rowIndex) => {
                const rowY = rowHeight + rowIndex * (doc.offsetHeight + rowGap);
                doc.style.left = `${columnX}px`;
                doc.style.top = `${rowY}px`;
                
                // Update the document header color to match the cluster
                const header = doc.querySelector('.document-header');
                if (header) {
                    header.style.backgroundColor = colorPalette[columnIndex % colorPalette.length];
                }
                
                // Bring to front
                doc.style.zIndex = "20";
            });
        });
    } catch (e) {
        console.error('Error organizing documents by cluster:', e);
        showErrorMessage("Error organizing documents by cluster. Please run clustering analysis again.");
    }
}

// Add event listener for the group-by-cluster button
document.getElementById('group-by-cluster-btn').addEventListener('click', organizeDocumentsByClusterInWorkspace);



    // Clear all documents from the workspace
    document.getElementById('clear-all').addEventListener('click', function() {
        documentWorkspace.innerHTML = '';
        openDocuments.clear();
        minimizedDocs = [];
        updateMinimizedDocsBar();
        updateDocumentHighlighting();
    });

    // Function to make an element draggable
    function makeElementDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.document-header');
        
        if (header) {
            header.onmousedown = dragMouseDown;
        } else {
            element.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            // Don't start drag if clicking on buttons
            if (e.target.classList.contains('close-btn') || 
                e.target.classList.contains('minimize-btn')) {
                return;
            }
            
            e.preventDefault();
            
            // Bring this element to the front
            const allDocuments = document.querySelectorAll('.document-window');
            allDocuments.forEach(doc => {
                doc.style.zIndex = "10";
            });
            element.style.zIndex = "100";
            
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
            
            // Add dragging class
            element.classList.add('dragging');
        }

        function elementDrag(e) {
            e.preventDefault();
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // Calculate new position
            let newTop = element.offsetTop - pos2;
            let newLeft = element.offsetLeft - pos1;
            
            // Set the element's new position
            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            element.classList.remove('dragging');
        }
    }

    // Load the document data
    loadDocumentData();
});
// Add refresh button functionality
document.getElementById('refresh-btn').addEventListener('click', function() {
    // Clear the document list
    documentList.innerHTML = '';
    
    // Reload the document data
    loadDocumentData();
    
    // Add a small animation to the refresh button
    this.classList.add('rotate-animation');
    setTimeout(() => {
        this.classList.remove('rotate-animation');
    }, 1000);
});

// Add keyboard shortcut handling to the document
document.addEventListener('keydown', function(event) {
    // Check if a document is being edited or if a modal is open
    const isModalOpen = document.querySelector('.modal.show');
    
    // Organize documents (Ctrl+O or Command+O on Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault(); // Prevent browser's open dialog
        document.getElementById('organize-btn').click();
    }
    
    // Clear all documents (Ctrl+C or Command+C on Mac)
    // Note: This conflicts with copy, so you might want to use a different shortcut
    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !window.getSelection().toString()) {
        // Only trigger if no text is selected (to avoid interfering with copy)
        event.preventDefault();
        document.getElementById('clear-all').click();
    }
    
    // Refresh document list (Ctrl+R or Command+R on Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault(); // Prevent browser refresh
        document.getElementById('refresh-btn').click();
    }
    
    // Close active document (Esc)
    if (event.key === 'Escape' && !isModalOpen) {
        // Find the document with highest z-index (the active one)
        const documents = document.querySelectorAll('.document-window');
        if (documents.length > 0) {
            let activeDoc = documents[0];
            let highestZ = parseInt(window.getComputedStyle(activeDoc).zIndex, 10) || 0;
            
            documents.forEach(doc => {
                const zIndex = parseInt(window.getComputedStyle(doc).zIndex, 10) || 0;
                if (zIndex > highestZ) {
                    highestZ = zIndex;
                    activeDoc = doc;
                }
            });
            
            // Click the close button of the active document
            activeDoc.querySelector('.close-btn').click();
        }
    }
});
