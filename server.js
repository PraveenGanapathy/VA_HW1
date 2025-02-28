const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Determine the correct paths for production (Vercel) or development
const isProduction = process.env.NODE_ENV === 'production';
const rootDir = isProduction ? process.cwd() : __dirname;

// Serve static files
app.use(express.static(path.join(rootDir, 'src')));

// Function to recursively get all files in a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
    try {
        const files = fs.readdirSync(dirPath);
        
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            
            if (fs.statSync(filePath).isDirectory()) {
                arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
            } else {
                arrayOfFiles.push(filePath);
            }
        });
        
        return arrayOfFiles;
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
        return arrayOfFiles;
    }
}

// Get all documents
app.get('/documents', (req, res) => {
    const datasetPath = path.join(rootDir, 'dataset');
    
    try {
        // Get all files in the dataset directory
        const allFiles = fs.readdirSync(datasetPath);
        
        // Get file details to help with displaying them properly
        const fileDetails = allFiles.map(file => {
            const filePath = path.join(datasetPath, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                extension: path.extname(file) || 'no-extension'
            };
        });
        
        res.json(fileDetails);
    } catch (error) {
        console.error('Error reading dataset directory:', error);
        return res.status(500).send('Unable to scan directory: ' + error.message);
    }
});

// Get a specific document
app.get('/documents/:filename', (req, res) => {
    const filePath = path.join(rootDir, 'dataset', req.params.filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }
    
    // Read file as binary first
    fs.readFile(filePath, (err, data) => {
        if (err) {
            return res.status(500).send('Unable to read file');
        }
        
        // Try to detect if it's a text file
        const extension = path.extname(filePath);
        const textExtensions = ['.txt', '.md', '.js', '.html', '.css', '.json', '.xml', '.csv', ''];
        
        // If it's a common text extension or has no extension, try to send as text
        if (textExtensions.includes(extension.toLowerCase())) {
            try {
                // Try to convert to string - this will work for text files
                const textContent = data.toString('utf8');
                return res.send(textContent);
            } catch (e) {
                // If conversion fails, send as binary
                return res.send(data);
            }
        } else {
            // For non-text files, send as binary
            return res.send(data);
        }
    });
});

// Get detailed information about all files
app.get('/files-info', (req, res) => {
    const datasetPath = path.join(rootDir, 'dataset');
    
    try {
        const allFilePaths = getAllFiles(datasetPath);
        
        const fileInfos = allFilePaths.map(filePath => {
            const stats = fs.statSync(filePath);
            const relativePath = path.relative(datasetPath, filePath);
            
            return {
                path: relativePath,
                name: path.basename(filePath),
                size: stats.size,
                extension: path.extname(filePath) || 'no-extension',
                created: stats.birthtime,
                modified: stats.mtime,
                isDirectory: stats.isDirectory()
            };
        });
        
        res.json(fileInfos);
    } catch (error) {
        console.error('Error getting file information:', error);
        return res.status(500).send('Unable to get file information: ' + error.message);
    }
});

// Add a catch-all route to handle SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(rootDir, 'src', 'index.html'));
});

// Start the server if not in production (Vercel handles this in production)
if (!isProduction) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

// Export the Express app for Vercel
module.exports = app;
