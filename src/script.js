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
