// server.js - Simplified API Server for Agricultural Supply Chain (No IoT)
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const PORT = process.env.API_PORT || 3001;
const CONTRACT_ADDRESS = process.env.AGRI_CONTRACT_ADDRESS;
const RPC_URL = process.env.LOCAL_RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Blockchain setup
let provider, wallet, contract;

// Contract ABI (simplified for API)
const CONTRACT_ABI = [
    "function participants(address) view returns (string name, string location, uint8 role, bool isActive, uint256 reputation)",
    "function products(uint256) view returns (uint256 productId, string productName, string variety, uint256 quantity, string harvestDate, address farmer, uint8 currentQuality, bool isOrganic)",
    "function batches(uint256) view returns (uint256 batchId, uint256 productId, uint8 currentStage, address currentOwner, uint256 timestamp, string location)",
    "function getBatchByQR(string) view returns (uint256)",
    "function getEnvironmentData(uint256, uint256) view returns (uint256 timestamp, int256 temperature, uint256 humidity, string location, address recorder, string notes)",
    "function getBatchHistory(uint256) view returns (address[] owners, string[] locations, uint256[] timestamps)",
    "function getBatchDetails(uint256) view returns (uint256 batchId, uint256 productId, uint8 currentStage, address currentOwner, string location, string notes, uint256 environmentRecordCount)",
    "function getProductInfo(uint256) view returns (string name, string variety, uint256 quantity, address farmer, uint8 quality, bool isOrganic, string[] certifications)",
    "function registerParticipant(string name, string location, uint8 role)",
    "function createProduct(string productName, string variety, uint256 quantity, string harvestDate, bool isOrganic, string[] certifications) returns (uint256)",
    "function createBatch(uint256 productId, string qrCode, string initialLocation) returns (uint256)",
    "function recordEnvironmentData(uint256 batchId, int256 temperature, uint256 humidity, string location, string notes)",
    "function transferOwnership(uint256 batchId, address newOwner, uint8 newStage, string newLocation)"
];

// Initialize blockchain connection
async function initBlockchain() {
    try {
        provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        
        if (PRIVATE_KEY) {
            wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        }
        
        if (CONTRACT_ADDRESS) {
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet || provider);
            console.log('✅ Connected to smart contract:', CONTRACT_ADDRESS);
        } else {
            console.log('⚠️ Contract address not set. Please deploy contract first.');
        }
        
        // Test connection
        const blockNumber = await provider.getBlockNumber();
        console.log('📊 Current block number:', blockNumber);
        
    } catch (error) {
        console.error('❌ Blockchain initialization error:', error.message);
    }
}

// In-memory storage for demo data
let environmentData = new Map(); // batchId -> array of readings
let batchNotes = new Map(); // batchId -> array of notes

// Routes

// Health check
app.get('/api/health', async (req, res) => {
    try {
        let blockchainStatus = false;
        let blockNumber = null;
        
        if (provider) {
            try {
                blockNumber = await provider.getBlockNumber();
                blockchainStatus = true;
            } catch (error) {
                console.error('Blockchain health check failed:', error);
            }
        }
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            blockchain_connected: blockchainStatus,
            contract_address: CONTRACT_ADDRESS,
            current_block: blockNumber
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve web application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get participant info
app.get('/api/participant/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        if (!contract) {
            return res.status(503).json({ error: 'Contract not available' });
        }
        
        const participant = await contract.participants(address);
        
        res.json({
            address,
            name: participant.name,
            location: participant.location,
            role: participant.role,
            isActive: participant.isActive,
            reputation: participant.reputation.toString()
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Register participant
app.post('/api/participant/register', async (req, res) => {
    try {
        const { name, location, role, userAddress } = req.body;
        
        if (!contract || !wallet) {
            return res.status(503).json({ error: 'Contract or wallet not available' });
        }
        
        const tx = await contract.registerParticipant(name, location, role);
        const receipt = await tx.wait();
        
        res.json({
            success: true,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
app.post('/api/product/create', async (req, res) => {
    try {
        const { productName, variety, quantity, harvestDate, isOrganic, certifications } = req.body;
        
        if (!contract || !wallet) {
            return res.status(503).json({ error: 'Contract or wallet not available' });
        }
        
        const tx = await contract.createProduct(
            productName,
            variety,
            quantity,
            harvestDate,
            isOrganic,
            certifications || []
        );
        
        const receipt = await tx.wait();
        
        // Extract product ID from events
        let productId = null;
        if (receipt.events) {
            const event = receipt.events.find(e => e.event === 'ProductCreated');
            if (event) {
                productId = event.args.productId.toString();
            }
        }
        
        res.json({
            success: true,
            productId,
            transactionHash: receipt.transactionHash
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get product info
app.get('/api/product/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!contract) {
            return res.status(503).json({ error: 'Contract not available' });
        }
        
        const product = await contract.getProductInfo(id);
        
        res.json({
            productId: id,
            productName: product.name,
            variety: product.variety,
            quantity: product.quantity.toString(),
            farmer: product.farmer,
            quality: product.quality,
            isOrganic: product.isOrganic,
            certifications: product.certifications
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create batch
app.post('/api/batch/create', async (req, res) => {
    try {
        const { productId, qrCode, initialLocation } = req.body;
        
        if (!contract || !wallet) {
            return res.status(503).json({ error: 'Contract or wallet not available' });
        }
        
        const tx = await contract.createBatch(productId, qrCode, initialLocation);
        const receipt = await tx.wait();
        
        // Extract batch ID from events
        let batchId = null;
        if (receipt.events) {
            const event = receipt.events.find(e => e.event === 'BatchCreated');
            if (event) {
                batchId = event.args.batchId.toString();
            }
        }
        
        res.json({
            success: true,
            batchId,
            qrCode,
            transactionHash: receipt.transactionHash
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get batch info
app.get('/api/batch/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!contract) {
            return res.status(503).json({ error: 'Contract not available' });
        }
        
        const batchDetails = await contract.getBatchDetails(id);
        const productInfo = await contract.getProductInfo(batchDetails.productId);
        
        res.json({
            batchId: batchDetails.batchId.toString(),
            productId: batchDetails.productId.toString(),
            productName: productInfo.name,
            currentStage: batchDetails.currentStage,
            currentOwner: batchDetails.currentOwner,
            location: batchDetails.location,
            notes: batchDetails.notes,
            environmentRecordCount: batchDetails.environmentRecordCount.toString(),
            product: {
                name: productInfo.name,
                variety: productInfo.variety,
                quantity: productInfo.quantity.toString(),
                farmer: productInfo.farmer,
                isOrganic: productInfo.isOrganic,
                quality: productInfo.quality,
                certifications: productInfo.certifications
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Track by QR code
app.get('/api/track/:qrCode', async (req, res) => {
    try {
        const { qrCode } = req.params;
        
        if (!contract) {
            return res.status(503).json({ error: 'Contract not available' });
        }
        
        const batchId = await contract.getBatchByQR(qrCode);
        
        if (batchId.toString() === '0') {
            return res.status(404).json({ error: 'QR code not found' });
        }
        
        // Get batch and product details
        const batchDetails = await contract.getBatchDetails(batchId);
        const productInfo = await contract.getProductInfo(batchDetails.productId);
        const history = await contract.getBatchHistory(batchId);
        
        res.json({
            batchId: batchId.toString(),
            qrCode,
            product: {
                name: productInfo.name,
                variety: productInfo.variety,
                quantity: productInfo.quantity.toString(),
                farmer: productInfo.farmer,
                isOrganic: productInfo.isOrganic,
                quality: productInfo.quality,
                certifications: productInfo.certifications
            },
            currentStage: batchDetails.currentStage,
            currentOwner: batchDetails.currentOwner,
            currentLocation: batchDetails.location,
            notes: batchDetails.notes,
            environmentRecordCount: batchDetails.environmentRecordCount.toString(),
            history: {
                owners: history.owners,
                locations: history.locations,
                timestamps: history.timestamps.map(t => t.toString())
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Record environmental data
app.post('/api/batch/:id/environment', async (req, res) => {
    try {
        const { id } = req.params;
        const { temperature, humidity, location, notes } = req.body;
        
        if (!contract || !wallet) {
            return res.status(503).json({ error: 'Contract or wallet not available' });
        }
        
        // Convert temperature to int (multiply by 100)
        const tempInt = Math.round(parseFloat(temperature) * 100);
        const humidityInt = Math.round(parseFloat(humidity) * 100);
        
        const tx = await contract.recordEnvironmentData(id, tempInt, humidityInt, location, notes || '');
        const receipt = await tx.wait();
        
        // Store in local cache for quick access
        if (!environmentData.has(id)) {
            environmentData.set(id, []);
        }
        
        const reading = {
            timestamp: Date.now(),
            temperature: parseFloat(temperature),
            humidity: parseFloat(humidity),
            location,
            notes,
            transactionHash: receipt.transactionHash
        };
        
        environmentData.get(id).push(reading);
        
        res.json({
            success: true,
            reading,
            transactionHash: receipt.transactionHash
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get environmental data for batch
app.get('/api/batch/:id/environment', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;
        
        if (!contract) {
            // Return cached data if contract not available
            const cachedData = environmentData.get(id) || [];
            return res.json({
                batchId: id,
                readings: cachedData.slice(-parseInt(limit)),
                count: cachedData.length
            });
        }
        
        try {
            const batchDetails = await contract.getBatchDetails(id);
            const recordCount = parseInt(batchDetails.environmentRecordCount);
            
            const readings = [];
            const maxRecords = Math.min(recordCount, parseInt(limit));
            
            for (let i = Math.max(0, recordCount - maxRecords); i < recordCount; i++) {
                try {
                    const envData = await contract.getEnvironmentData(id, i);
                    readings.push({
                        timestamp: parseInt(envData.timestamp) * 1000, // Convert to milliseconds
                        temperature: parseInt(envData.temperature) / 100, // Convert back from int
                        humidity: parseInt(envData.humidity) / 100,
                        location: envData.location,
                        recorder: envData.recorder,
                        notes: envData.notes
                    });
                } catch (error) {
                    console.error(`Error fetching environment record ${i}:`, error);
                }
            }
            
            res.json({
                batchId: id,
                readings,
                count: readings.length
            });
            
        } catch (error) {
            // Fallback to cached data
            const cachedData = environmentData.get(id) || [];
            res.json({
                batchId: id,
                readings: cachedData.slice(-parseInt(limit)),
                count: cachedData.length
            });
        }
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Transfer ownership
app.post('/api/batch/:id/transfer', async (req, res) => {
    try {
        const { id } = req.params;
        const { newOwner, newStage, newLocation } = req.body;
        
        if (!contract || !wallet) {
            return res.status(503).json({ error: 'Contract or wallet not available' });
        }
        
        const tx = await contract.transferOwnership(id, newOwner, newStage, newLocation);
        const receipt = await tx.wait();
        
        res.json({
            success: true,
            transactionHash: receipt.transactionHash
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add batch note
app.post('/api/batch/:id/note', async (req, res) => {
    try {
        const { id } = req.params;
        const { note, author } = req.body;
        
        // Store note locally (in production, this could go to blockchain or database)
        if (!batchNotes.has(id)) {
            batchNotes.set(id, []);
        }
        
        const noteEntry = {
            timestamp: Date.now(),
            note,
            author: author || 'Unknown',
            id: Date.now().toString()
        };
        
        batchNotes.get(id).push(noteEntry);
        
        res.json({
            success: true,
            note: noteEntry
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get batch notes
app.get('/api/batch/:id/notes', (req, res) => {
    const { id } = req.params;
    const notes = batchNotes.get(id) || [];
    
    res.json({
        batchId: id,
        notes,
        count: notes.length
    });
});

// Get all batches (for demo purposes)
app.get('/api/batches', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // For demo, return simulated batch data
        // In production, you'd query the blockchain for actual batches
        const sampleBatches = [];
        
        for (let i = 1; i <= Math.min(parseInt(limit), 10); i++) {
            sampleBatches.push({
                batchId: i,
                productName: `Product ${i}`,
                currentStage: Math.floor(Math.random() * 5),
                currentOwner: '0x' + Math.random().toString(16).substr(2, 40),
                location: `Location ${i}`,
                lastUpdate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        res.json({
            batches: sampleBatches,
            count: sampleBatches.length
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard summary
app.get('/api/dashboard', async (req, res) => {
    try {
        // For demo purposes, return simulated dashboard data
        res.json({
            summary: {
                totalBatches: 25,
                activeBatches: 18,
                totalProducts: 12,
                totalParticipants: 35,
                environmentRecords: environmentData.size
            },
            recentActivity: [
                {
                    type: 'batch_created',
                    message: 'New batch created: Organic Tomatoes',
                    timestamp: Date.now() - 300000
                },
                {
                    type: 'ownership_transferred',
                    message: 'Batch #123 transferred to distributor',
                    timestamp: Date.now() - 600000
                },
                {
                    type: 'environment_recorded',
                    message: 'Temperature recorded: 4.2°C',
                    timestamp: Date.now() - 900000
                }
            ]
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate QR code (utility endpoint)
app.post('/api/qr/generate', (req, res) => {
    try {
        const { data, prefix = 'QR' } = req.body;
        const qrCode = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        res.json({
            success: true,
            qrCode,
            data: data || `BATCH_${Date.now()}`
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Start server
async function startServer() {
    try {
        await initBlockchain();
        
        app.listen(PORT, () => {
            console.log(`🚀 Agricultural Supply Chain API Server running on port ${PORT}`);
            console.log(`📊 Web Application: http://localhost:${PORT}`);
            console.log(`🔗 API Endpoints: http://localhost:${PORT}/api`);
            console.log(`📖 Health Check: http://localhost:${PORT}/api/health`);
            
            // Initialize demo data
            initializeDemoData();
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Initialize demo data
function initializeDemoData() {
    // Add sample environment data
    const sampleBatches = ['1', '2', '3'];
    
    sampleBatches.forEach(batchId => {
        const readings = [];
        for (let i = 0; i < 5; i++) {
            readings.push({
                timestamp: Date.now() - (i * 30 * 60 * 1000), // 30 min intervals
                temperature: Math.random() * 8 + 2, // 2-10°C
                humidity: Math.random() * 30 + 50,  // 50-80%
                location: 'Demo Location',
                notes: `Demo reading ${i + 1}`
            });
        }
        environmentData.set(batchId, readings);
    });
    
    console.log('✅ Demo data initialized');
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    process.exit(0);
});

// Start the server
startServer();