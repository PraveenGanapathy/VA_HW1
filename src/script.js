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
    
    // Global tracking variable for selected points (MUST be in the same scope as your other variables)
    let selectedPoints = [];

    fetch('/api/cluster-documents', { method: 'POST' })
    .then(response => response.text())  // Use .text() instead of .json()
    .then(text => {
      console.log("Raw response:", text);  // Check if it's HTML or JSON
      return JSON.parse(text);
    })
    .then(data => {
      console.log('API Response:', data); // Inspect in browser console
      
      if (!data.mds_coordinates) {
        throw new Error('MDS coordinates missing in API response');
      }
      
      renderMDSPlot(data.mds_coordinates);
    })
    .catch(err => {
      console.error('Fetch error:', err);
      showErrorMessage(`MDS data load failed: ${err.message}`);
    });
  


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
        console.log("Loading file:", fileName, "Selected points:", selectedPoints); // Debug logging
        
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
                    
                    // Get the file name before removing the element
                    const fileName = newDocument.dataset.fileName;
                    
                    // Remove from selectedPoints array if present
                    const pointIndex = selectedPoints.indexOf(fileName);
                    if (pointIndex !== -1) {
                        selectedPoints.splice(pointIndex, 1);
                        console.log("Removed closed document from selected points:", selectedPoints);
                    }
                    
                    // Find the point in the visualization and reset it
                    d3.selectAll('.point')
                        .each(function(d) {
                            if (d && d.docId === fileName) {
                                d3.select(this)
                                    .attr('r', 8)
                                    .attr('stroke', 'white')
                                    .attr('stroke-width', 2);
                            }
                        });
                    
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

    // Add this function to manually highlight an MDS point by document name
    function highlightMdsPoint(docId) {
        if (!docId) return;
        
        // Check if already in selected points
        if (!selectedPoints.includes(docId)) {
            selectedPoints.push(docId);
        }
        
        console.log("Manually highlighting point:", docId);
        
        // Find and highlight the corresponding point in the MDS plot
        d3.selectAll('.point')
            .each(function(d) {
                if (d && d.docId === docId) {
                    d3.select(this)
                        .attr('r', 12)
                        .attr('stroke', '#f72585')
                        .attr('stroke-width', 3.5);
                }
            });
        
        // Add persistent highlight to document in list
        const listItem = document.querySelector(`.list-group-item[data-file-name="${docId}"]`);
        if (listItem) {
            listItem.classList.add('persistent-highlight');
        }
    }

    // Modify the openDocument function to ensure highlighting is maintained
    function openDocument(docId) {
        console.log("Opening document:", docId);
        const fileEntry = document.querySelector(`.list-group-item[data-file-name="${docId}"]`);
        if (fileEntry) {
            // Do NOT modify selectedPoints here
            
            // Trigger click to open the document
            fileEntry.click();
        }
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
                    
                    // Get the file name before removing the element
                    const fileName = newDocument.dataset.fileName;
                    
                    // Remove from selectedPoints array if present
                    const pointIndex = selectedPoints.indexOf(fileName);
                    if (pointIndex !== -1) {
                        selectedPoints.splice(pointIndex, 1);
                        console.log("Removed closed document from selected points:", selectedPoints);
                    }
                    
                    // Find the point in the visualization and reset it
                    d3.selectAll('.point')
                        .each(function(d) {
                            if (d && d.docId === fileName) {
                                d3.select(this)
                                    .attr('r', 8)
                                    .attr('stroke', 'white')
                                    .attr('stroke-width', 2);
                            }
                        });
                    
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
                
                // Get the file name before removing the element
                const fileName = newDocument.dataset.fileName;
                
                // Remove from selectedPoints array if present
                const pointIndex = selectedPoints.indexOf(fileName);
                if (pointIndex !== -1) {
                    selectedPoints.splice(pointIndex, 1);
                    console.log("Removed closed document from selected points:", selectedPoints);
                }
                
                // Find the point in the visualization and reset it
                d3.selectAll('.point')
                    .each(function(d) {
                        if (d && d.docId === fileName) {
                            d3.select(this)
                                .attr('r', 8)
                                .attr('stroke', 'white')
                                .attr('stroke-width', 2);
                        }
                    });
                
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
function renderMDSPlot(mdsData) {
    // Clear existing plot
    const plotContainer = document.getElementById('mds-plot');
    plotContainer.innerHTML = '';
    
    // Check if data is available or show placeholder
    if (!mdsData || !Array.isArray(mdsData) || mdsData.length === 0) {
        plotContainer.innerHTML = `
            <div class="d-flex flex-column justify-content-center align-items-center h-100">
                <i class="fas fa-project-diagram fa-3x mb-3 text-muted"></i>
                <h5>No Document Relationship Data</h5>
                <p class="text-muted">Run clustering to visualize document relationships</p>
                <button class="btn btn-primary btn-sm mt-2" id="run-clustering-btn">
                    <i class="fas fa-object-group me-1"></i> Run Clustering
                </button>
            </div>
        `;
        
        document.getElementById('run-clustering-btn')?.addEventListener('click', function() {
            document.getElementById('cluster-btn').click();
        });
        
        return;
    }
    
    // Set minimum dimensions for the plot to ensure it's always visible
    const minWidth = 800;
    const minHeight = 400;
    
    // Get container dimensions
    const containerRect = plotContainer.getBoundingClientRect();
    
    // Use the larger of the actual container size or minimum dimensions
    const width = Math.max(containerRect.width, minWidth);
    const height = Math.max(containerRect.height, minHeight);
    
    // Apply minimum dimensions to container if needed
    if (containerRect.width < minWidth) {
        plotContainer.style.minWidth = `${minWidth}px`;
    }
    
    if (containerRect.height < minHeight) {
        plotContainer.style.minHeight = `${minHeight}px`;
    }
    
    // Define margins with safety checks - reduced to maximize plot area
    const margin = {top: 50, right: 30, bottom: 60, left: 60};
    
    // Ensure inner dimensions are positive
    const innerWidth = Math.max(width - margin.left - margin.right, 0);
    const innerHeight = Math.max(height - margin.top - margin.bottom, 0);

    // SVG setup - make it responsive
    const svg = d3.select('#mds-plot')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('class', 'mds-svg')
        .style('font-family', "'Inter', sans-serif");
    
    // Add title to the plot
    svg.append('text')
        .attr('class', 'plot-title')
        .attr('x', width / 2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .text('Document Similarity Map (MDS)');
    
    // Add subtitle
    svg.append('text')
        .attr('class', 'plot-subtitle')
        .attr('x', width / 2)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#6c757d')
        .text('Documents with similar content appear closer together');
    
    // Create a group for zoom behavior
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create clip path to prevent points from going outside the plot area
    svg.append('defs')
        .append('clipPath')
        .attr('id', 'clip')
        .append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight);
    
    // Group for points with clip path
    const pointsGroup = g.append('g')
        .attr('clip-path', 'url(#clip)');
    
    // Scales
    const xExtent = d3.extent(mdsData, d => d.x);
    const yExtent = d3.extent(mdsData, d => d.y);
    
    // Add padding to the domains
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;

    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([innerHeight, 0]);
    
    // Initialize zoom behavior
    const zoomBehavior = d3.zoom()
        .scaleExtent([0.5, 8])
        .on('zoom', (event) => {
            // Apply zoom transform to points group
            pointsGroup
            .attr('transform', event.transform)
            .attr('clip-path', 'url(#clip)');  // Keep clipped
            
            // Update axes during zoom
            xAxisGroup.call(xAxis.scale(event.transform.rescaleX(xScale)));
            yAxisGroup.call(yAxis.scale(event.transform.rescaleY(yScale)));
        });
    
    // Apply zoom behavior to SVG with initial transform
    svg.call(zoomBehavior);
    
    // Add zoom button in a better position
    svg.append('g')
        .attr('class', 'zoom-buttons')
        .attr('transform', `translate(${width - 110}, 15)`)
        .call(g => {
            // Reset zoom button
            const resetBtn = g.append('g')
                .attr('class', 'zoom-button')
                .style('cursor', 'pointer')
                .on('click', () => resetZoom());
            
            resetBtn.append('rect')
                .attr('width', 100)
                .attr('height', 30)
                .attr('rx', 4)
                .attr('fill', '#f8f9fa')
                .attr('stroke', '#dee2e6');
                
            resetBtn.append('text')
                .attr('x', 50)
                .attr('y', 20)
                .attr('text-anchor', 'middle')
                .attr('font-size', '12px')
                .attr('fill', '#495057')
                .text('Reset View');
        });

    // Axes
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(-innerHeight)
        .tickPadding(10);
    
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickPadding(10);

    const xAxisGroup = g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

    const yAxisGroup = g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis);
    
    // Style the grid lines
    g.selectAll('.x-axis line, .y-axis line')
        .attr('stroke', '#e9ecef')
        .attr('stroke-dasharray', '2,2');
    
    g.selectAll('.x-axis path, .y-axis path')
        .attr('stroke', '#ced4da');
    
    // Add axis labels
    g.append('text')
        .attr('class', 'x-axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 40)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#495057')
        .text('MDS Dimension 1');
    
    g.append('text')
        .attr('class', 'y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#495057')
        .text('MDS Dimension 2');

    // Create tooltip
    let tooltip = d3.select('body').select('.mds-tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'mds-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', 'rgba(33, 37, 41, 0.9)')
            .style('color', 'white')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.2)')
            .style('max-width', '250px');
    }

    // Map of clusters for legend
    const clusterCounts = {};
    
    // Just before your existing draw points code, add a variable to track the selected point
    let selectedPoint = null;

    // Draw points with better visibility
    pointsGroup.selectAll('.point')
        .data(mdsData)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 8) // Larger points for better visibility
        .attr('fill', d => {
            // Track clusters for legend
            clusterCounts[d.cluster] = (clusterCounts[d.cluster] || 0) + 1;
            return colorPalette[Number(d.cluster) % colorPalette.length];
        })
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .attr('data-doc-id', d => d.docId) // Add document ID as data attribute
        .style('cursor', 'pointer')
        .style('transition', 'r 0.2s, stroke-width 0.2s')
        .on('mouseover', function(event, d) {
            // Don't apply hover effect if this is a selected point
            if (!selectedPoints.includes(d.docId)) {
                // Enhanced tooltip with more information
                tooltip.html(`
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${d.docId}</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span style="color:#ced4da">Cluster:</span>
                        <span style="font-weight: 500;">${parseInt(d.cluster) + 1}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color:#ced4da">Coordinates:</span>
                        <span style="font-weight: 500;">(${d.x.toFixed(2)}, ${d.y.toFixed(2)})</span>
                    </div>
                `)
                .style('visibility', 'visible');
                
                // Highlight point
                d3.select(this)
                    .attr('r', 12)
                    .attr('stroke-width', 3)
                    .attr('stroke', '#212529');
                
                // Highlight document in list
                highlightDocument(d.docId);
            }
        })
        .on('mousemove', function(event) {
            // Position tooltip near cursor but avoid edges
            const tooltipWidth = 220; 
            const tooltipHeight = 90;
            
            let xPos = event.pageX + 12;
            let yPos = event.pageY - 10;
            
            // Adjust if near right edge
            if (xPos + tooltipWidth > window.innerWidth) {
                xPos = event.pageX - tooltipWidth - 12;
            }
            
            // Adjust if near bottom edge
            if (yPos + tooltipHeight > window.innerHeight) {
                yPos = event.pageY - tooltipHeight - 12;
            }
            
            tooltip
                .style('left', `${xPos}px`)
                .style('top', `${yPos}px`);
        })
        .on('mouseout', function(event, d) {
            tooltip.style('visibility', 'hidden');
            
            // Only reset highlighting if this is not a selected point
            if (!selectedPoints.includes(d.docId)) {
                d3.select(this)
                    .attr('r', 8)
                    .attr('stroke-width', 2)
                    .attr('stroke', 'white');
                clearHighlights();
            }
        })
        .on('click', function(event, d) {
            console.log("Point clicked:", d.docId); // Debug logging
            
            // Check if this point is already selected
            const pointIndex = selectedPoints.indexOf(d.docId);
            
            if (pointIndex === -1) {
                // If not selected, add to selected points array
                selectedPoints.push(d.docId);
                console.log("Added to selected points:", selectedPoints);
                
                // Apply highlight to this point
                d3.select(this)
                    .attr('r', 12)
                    .attr('stroke', '#f72585')
                    .attr('stroke-width', 3.5);
                
                // Apply persistent highlight to document in list
                const listItem = document.querySelector(`.list-group-item[data-file-name="${d.docId}"]`);
                if (listItem) {
                    listItem.classList.add('persistent-highlight');
                    console.log("Added persistent-highlight to list item"); // Debug logging
                }
            } else {
                // If already selected, remove highlight
                selectedPoints.splice(pointIndex, 1);
                console.log("Removed from selected points:", selectedPoints);
                
                // Remove highlight from this point
                d3.select(this)
                    .attr('r', 8)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 2);
                
                // Remove persistent highlight from document in list
                const listItem = document.querySelector(`.list-group-item[data-file-name="${d.docId}"]`);
                if (listItem) {
                    listItem.classList.remove('persistent-highlight');
                }
            }
            
            // Open the document
            openDocument(d.docId);
        });

    // Function to reset zoom
    function resetZoom() {
        svg.transition()
            .duration(750)
            .call(
                zoomBehavior.transform,
                d3.zoomIdentity
            );
    }
    
    // Add double-click behavior to reset zoom
    svg.on('dblclick.zoom', null); // Remove default double-click behavior
    svg.on('dblclick', resetZoom);
    
    // Add keyboard shortcut for reset zoom (spacebar)
    d3.select('body').on('keydown.mds', function(event) {
        if (event.key === ' ' && document.activeElement.tagName !== 'INPUT' && 
            document.activeElement.tagName !== 'TEXTAREA') {
            event.preventDefault();
            resetZoom();
        }
    });
    
    // Adjust document workspace styles for better document visibility
    const documentWorkspace = document.getElementById('document-workspace');
    if (documentWorkspace) {
        // Make sure documents in workspace are visible and properly sized
        documentWorkspace.style.position = 'relative';
        documentWorkspace.style.padding = '20px';
        
        // Apply styles to existing document windows
        const docWindows = documentWorkspace.querySelectorAll('.document-window');
        docWindows.forEach(docWindow => {
            // Ensure document windows are properly sized and visible
            docWindow.style.width = '400px';
            docWindow.style.maxWidth = '95%';
            docWindow.style.maxHeight = '80%';
            docWindow.style.overflow = 'auto';
            docWindow.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            docWindow.style.border = '1px solid #dee2e6';
            docWindow.style.borderRadius = '6px';
            docWindow.style.backgroundColor = 'white';
            
            // Ensure document content is scrollable
            const content = docWindow.querySelector('.document-content');
            if (content) {
                content.style.overflowY = 'auto';
                content.style.maxHeight = 'calc(100% - 40px)';
                content.style.padding = '15px';
            }
        });
    }
    let zoomEnabled = true;

svg.append('g')
    .attr('class', 'zoom-lock-button')
    .attr('transform', `translate(${width - 220}, 15)`)
    .call(g => {
        const lockBtn = g.append('g')
            .attr('class', 'zoom-button')
            .style('cursor', 'pointer')
            .on('click', () => {
                zoomEnabled = !zoomEnabled;
                if (zoomEnabled) {
                    svg.call(zoomBehavior);
                    lockBtn.select('rect').attr('fill', '#f8f9fa');
                    lockBtn.select('text').text('Zoom: ON');
                } else {
                    svg.on('.zoom', null);
                    lockBtn.select('rect').attr('fill', '#e9ecef');
                    lockBtn.select('text').text('Zoom: OFF');
                }
            });

        lockBtn.append('rect')
            .attr('width', 100)
            .attr('height', 30)
            .attr('rx', 4)
            .attr('fill', '#f8f9fa')
            .attr('stroke', '#dee2e6');
        
        lockBtn.append('text')
            .attr('x', 50)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#495057')
            .text('Zoom: ON');
    });

}

// Add styles to document head to ensure proper sizing
document.addEventListener('DOMContentLoaded', function() {
    // Add custom styles for the document workspace and MDS plot
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #mds-plot {
            width: 100%;
            height: 100%;
            min-height: 400px;
        }
        
        .card-body {
            padding: 0 !important;
            overflow: hidden !important;
        }
        
        #mds-panel .card-body {
            height: 40vh !important;
            min-height: 400px !important;
        }
        
        #right-panel .card-body {
            height: 50vh !important;
            min-height: 400px !important;
        }
        
        #document-workspace {
            position: relative;
            padding: 20px;
            overflow: auto !important;
            width: 100%;
            height: 100%;
        }
        
        .document-window {
            width: 400px;
            max-width: 95%;
            max-height: 80%;
            overflow: auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background-color: white;
            z-index: 10;
        }
        
        .document-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            cursor: move;
        }
        
        .document-content {
            overflow-y: auto;
            max-height: calc(100% - 40px);
            padding: 15px;
        }
        .persistent-highlight {
            background-color: rgba(247, 37, 133, 0.15) !important;
            font-weight: bold !important;
            border-left: 4px solid #f72585 !important;
            position: relative;
        }
        
        .persistent-highlight::after {
            content: "●";
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #f72585;
            font-size: 14px;
        }
    `;
    document.head.appendChild(styleElement);
    
    // Function to adjust workspace dimensions
    function resizeWorkspace() {
        const windowHeight = window.innerHeight;
        const workspaceContainer = document.querySelector('.workspace-container');
        const mdsContainer = document.querySelector('#mds-panel .card-body');
        
        if (workspaceContainer && mdsContainer) {
            // Calculate heights for a dynamic layout
            const navbarHeight = 60; // Typical navbar height
            const cardHeaderHeight = 56; // Typical card header height
            const marginHeight = 20; // Typical margin height
            
            // Adjust heights based on window size
            if (windowHeight > 1000) {
                // For large screens
                mdsContainer.style.height = '38vh';
                workspaceContainer.style.height = '58vh';
            } else if (windowHeight > 800) {
                // For medium screens
                mdsContainer.style.height = '40vh';
                workspaceContainer.style.height = '56vh';
            } else {
                // For smaller screens
                mdsContainer.style.height = '35vh';
                workspaceContainer.style.height = '60vh';
            }
        }
    }
    
    // Call resize on load and window resize
    resizeWorkspace();
    window.addEventListener('resize', resizeWorkspace);
    
    // Enhance the document window creation
    function createDocumentWindow(fileName, fileContent, groupColor, x, y) {
        const docWindow = document.createElement('div');
        docWindow.className = 'document-window';
        docWindow.dataset.fileName = fileName;
        
        // Position the window
        docWindow.style.left = `${x}px`;
        docWindow.style.top = `${y}px`;
        
        // Create the header
        const header = document.createElement('div');
        header.className = 'document-header';
        header.style.backgroundColor = groupColor || '#f5f5f5';
        
        // Add title span
        const titleSpan = document.createElement('span');
        titleSpan.className = 'document-header-title';
        titleSpan.textContent = fileName;
        
        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'document-header-buttons';
        
        // Add minimize button
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'minimize-btn';
        minimizeBtn.innerHTML = '&#8212;';
        minimizeBtn.title = 'Minimize';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.title = 'Close';
        
        // Add buttons to container
        buttonsContainer.appendChild(minimizeBtn);
        buttonsContainer.appendChild(closeBtn);
        
        // Add elements to header
        header.appendChild(titleSpan);
        header.appendChild(buttonsContainer);
        
        // Create content area
        const content = document.createElement('pre');
        content.className = 'document-content';
        content.textContent = fileContent;
        
        // Assemble the document window
        docWindow.appendChild(header);
        docWindow.appendChild(content);
        
        return docWindow;
    }
    function adjustLeftPanelHeight() {
        const mdsHeight = document.querySelector('#mds-panel .card-body')?.offsetHeight || 0;
        const rightPanelHeight = document.querySelector('#right-panel .card-body')?.offsetHeight || 0;
        const navbarHeight = 60; // adjust if your navbar is different
        const totalHeight = mdsHeight + rightPanelHeight + navbarHeight;
    
        const leftPanel = document.getElementById('left-panel');
        if (leftPanel) {
            leftPanel.style.height = `${totalHeight}px`;
        }
    }
    adjustLeftPanelHeight();
window.addEventListener('resize', adjustLeftPanelHeight);

    
});

// Helper functions for highlighting and opening documents
function highlightDocument(docId) {
    d3.selectAll('.list-group-item').classed('highlight', function() {
        return d3.select(this).text() === docId;
    });
}
function clearHighlights() {
    d3.selectAll('.list-group-item').classed('highlight', false);
}
function openDocument(docId) {
    const fileEntry = document.querySelector(`.list-group-item[data-file-name="${docId}"]`);
    if (fileEntry) {
        fileEntry.click();
        
        // Listen for when the document appears in the workspace
        setTimeout(() => {
            const docInWorkspace = document.querySelector(`.document-window[data-file-name="${docId}"]`);
            if (docInWorkspace) {
                // Document is now in workspace, we can keep the selection
            } else {
                // If document failed to open for some reason, clear the selection
                clearMdsSelection();
            }
        }, 500);
    }
}

// Add a function to clear MDS selection
function clearMdsSelection() {
    console.log("Clearing MDS selection, was:", selectedPoints); // Debug logging
    selectedPoints = [];
    
    // Reset all points
    d3.selectAll('.point')
        .attr('r', 8)
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    
    // Clear document highlights
    d3.selectAll('.list-group-item.persistent-highlight').classed('persistent-highlight', false);
}

// Add this new function to handle persistent document highlighting
function persistentHighlightDocument(docId) {
    // Remove any existing persistent highlights
    d3.selectAll('.list-group-item.persistent-highlight').classed('persistent-highlight', false);
    
    // Add persistent highlight class to the clicked document
    const listItem = document.querySelector(`.list-group-item[data-file-name="${docId}"]`);
    if (listItem) {
        listItem.classList.add('persistent-highlight');
    }
}

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
        // Clear workspace
        documentWorkspace.innerHTML = '';
        
        // Clear open documents tracking
        openDocuments.clear();
        minimizedDocs = [];
        
        // Reset highlighted points in MDS plot
        selectedPoints = []; // Clear the array of selected points
        
        // Reset all point styles in the MDS plot
        d3.selectAll('.point')
            .attr('r', 8)
            .attr('stroke', 'white')
            .attr('stroke-width', 2);
        
        // Remove any persistent highlights from the document list
        d3.selectAll('.list-group-item.persistent-highlight')
            .classed('persistent-highlight', false);
        
        // Update minimized docs bar
        updateMinimizedDocsBar();
        
        // Update document highlighting
        updateDocumentHighlighting();
        
        console.log("All documents cleared, MDS point selections reset");
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
document.addEventListener('DOMContentLoaded', function() {
    // Add custom styles for the document workspace
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* MDS Plot container */
        #mds-panel .card-body {
            height: 40vh !important;
            min-height: 400px !important;
            padding: 0 !important;
            overflow: hidden !important;
        }
        
        #mds-plot {
            width: 100%;
            height: 100%;
            min-height: 400px;
        }
        
        /* Document Workspace container */
        .workspace-container {
            height: 60vh !important;
            min-height: 500px !important;
            padding: 0 !important;
            position: relative;
            overflow: hidden !important;
        }
        
        #document-workspace {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            padding: 20px;
            overflow: auto !important;
            background-color: #f8f9fa;
        }
        
        /* Document Window styles */
        .document-window {
            position: absolute;
            width: 450px;
            max-width: 95%;
            max-height: 80%;
            box-shadow: 0 6px 16px rgba(0,0,0,0.15);
            border: 1px solid #dee2e6;
            border-radius: 8px;
            background-color: white;
            z-index: 10;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .document-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            cursor: move;
            user-select: none;
        }
        
        .document-content {
            flex: 1;
            overflow-y: auto;
            max-height: calc(100% - 45px);
            padding: 15px;
            font-size: 0.9rem;
            line-height: 1.5;
        }
    `;
    document.head.appendChild(styleElement);
    
    // Function to adjust workspace dimensions
    function resizeWorkspace() {
        const windowHeight = window.innerHeight;
        const workspaceContainer = document.querySelector('.workspace-container');
        const mdsContainer = document.querySelector('#mds-panel .card-body');
        
        if (workspaceContainer && mdsContainer) {
            // Calculate heights for a dynamic layout
            const navbarHeight = 60; // Typical navbar height
            const cardHeaderHeight = 56; // Typical card header height
            const marginHeight = 20; // Typical margin height
            
            // Adjust heights based on window size
            if (windowHeight > 1000) {
                // For large screens
                mdsContainer.style.height = '38vh';
                workspaceContainer.style.height = '58vh';
            } else if (windowHeight > 800) {
                // For medium screens
                mdsContainer.style.height = '40vh';
                workspaceContainer.style.height = '56vh';
            } else {
                // For smaller screens
                mdsContainer.style.height = '35vh';
                workspaceContainer.style.height = '60vh';
            }
        }
    }
    
    // Call resize on load and window resize
    resizeWorkspace();
    window.addEventListener('resize', resizeWorkspace);
    
    // Enhance the document window creation
    function createDocumentWindow(fileName, fileContent, groupColor, x, y) {
        const docWindow = document.createElement('div');
        docWindow.className = 'document-window';
        docWindow.dataset.fileName = fileName;
        
        // Position the window
        docWindow.style.left = `${x}px`;
        docWindow.style.top = `${y}px`;
        
        // Create the header
        const header = document.createElement('div');
        header.className = 'document-header';
        header.style.backgroundColor = groupColor || '#f5f5f5';
        
        // Add title span
        const titleSpan = document.createElement('span');
        titleSpan.className = 'document-header-title';
        titleSpan.textContent = fileName;
        
        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'document-header-buttons';
        
        // Add minimize button
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'minimize-btn';
        minimizeBtn.innerHTML = '&#8212;';
        minimizeBtn.title = 'Minimize';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.title = 'Close';
        
        // Add buttons to container
        buttonsContainer.appendChild(minimizeBtn);
        buttonsContainer.appendChild(closeBtn);
        
        // Add elements to header
        header.appendChild(titleSpan);
        header.appendChild(buttonsContainer);
        
        // Create content area
        const content = document.createElement('pre');
        content.className = 'document-content';
        content.textContent = fileContent;
        
        // Assemble the document window
        docWindow.appendChild(header);
        docWindow.appendChild(content);
        
        return docWindow;
    }
    function adjustLeftPanelHeight() {
        const mdsHeight = document.querySelector('#mds-panel .card-body')?.offsetHeight || 0;
        const rightPanelHeight = document.querySelector('#right-panel .card-body')?.offsetHeight || 0;
        const navbarHeight = 60; // adjust if your navbar is different
        const totalHeight = mdsHeight + rightPanelHeight + navbarHeight;
    
        const leftPanel = document.getElementById('left-panel');
        if (leftPanel) {
            leftPanel.style.height = `${totalHeight}px`;
        }
    }
    adjustLeftPanelHeight();
window.addEventListener('resize', adjustLeftPanelHeight);

    
});
