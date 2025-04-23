const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const NodeCache = require('node-cache');

// Initialize cache with standard TTL of 1 day (in seconds)
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 120 });

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

// Middleware for caching
function cacheMiddleware(key) {
    return (req, res, next) => {
        const cacheKey = key || req.originalUrl;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            console.log(`Serving from cache: ${cacheKey}`);
            return res.json(cachedData);
        }
        
        // Store the original json method
        const originalJson = res.json;
        
        // Override the json method
        res.json = function(data) {
            // Store in cache before sending
            cache.set(cacheKey, data);
            // Call the original method
            return originalJson.call(this, data);
        };
        
        next();
    };
}

// Get all documents with caching
app.get('/documents', cacheMiddleware('documents-list'), (req, res) => {
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

// Get a specific document with caching
app.get('/documents/:filename', (req, res) => {
    const filePath = path.join(rootDir, 'dataset', req.params.filename);
    const cacheKey = `document-${req.params.filename}`;
    
    // Check cache first
    const cachedContent = cache.get(cacheKey);
    if (cachedContent) {
        console.log(`Serving ${req.params.filename} from cache`);
        return res.send(cachedContent);
    }
    
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
                // Cache the content
                cache.set(cacheKey, textContent);
                return res.send(textContent);
            } catch (e) {
                // If conversion fails, send as binary
                cache.set(cacheKey, data);
                return res.send(data);
            }
        } else {
            // For non-text files, send as binary
            cache.set(cacheKey, data);
            return res.send(data);
        }
    });
});

// Get detailed information about all files with caching
app.get('/files-info', cacheMiddleware('files-info'), (req, res) => {
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

app.post('/api/cluster-documents', (req, res) => {
    // Check cache first
    const cacheKey = 'clustering-results';
    const cachedResults = cache.get(cacheKey);
    
    if (cachedResults) {
        console.log('Serving clustering results from cache');
        return res.json(cachedResults);
    }
    
    // Run the Python script
    const pythonProcess = spawn('python', [path.join(__dirname, 'document_clustering.py')]);
    
    let dataString = '';
    let errorString = '';
    
    // Collect data from script
    pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
    });
    
    // Collect errors from script
    pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
    });
    
    // When the script is done
    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python script exited with code ${code}`);
            console.error(`Error: ${errorString}`);
            return res.status(500).json({ error: 'Failed to cluster documents', details: errorString });
        }
        
        try {
            // Read the clustering results from the files generated by Python
            const clusteringResults = JSON.parse(fs.readFileSync('clustering_results.json', 'utf8'));
            const documentFeatures = JSON.parse(fs.readFileSync('document_features.json', 'utf8'));
            
            // Combine the results
            const result = {
                ...clusteringResults,
                features: documentFeatures.features,
                entities: documentFeatures.entities,
                mds_coordinates: documentFeatures.mds_coordinates
            };
            
            // Cache the results
            cache.set(cacheKey, result);
            
            res.json(result);
        } catch (error) {
            console.error('Error reading clustering results:', error);
            res.status(500).json({ error: 'Failed to read clustering results' });
        }
    });
});

app.get('/clear-cache', (req, res) => {
    cache.flushAll();
    res.send('Cache cleared');
});

// Add a catch-all route to handle SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(rootDir, 'src', 'index.html'));
});

// Cache cleanup event listener
cache.on('expired', (key, value) => {
    console.log(`Cache key expired: ${key}`);
});

// Start the server if not in production (Vercel handles this in production)
if (!isProduction) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log(`Cache configured with TTL of 1 day (86400 seconds)`);
    });
}

// Export the Express app for Vercel
module.exports = app;
