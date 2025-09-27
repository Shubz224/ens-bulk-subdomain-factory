const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({ 
  dest: 'src/uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // INCREASE TO 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files allowed'), false);
    }
  }
});

const merkleController = require('../controllers/merkleController');

// Generate Merkle tree from CSV
router.post('/generate', upload.single('file'), merkleController.generateTree);

// Get proof for specific claim
router.get('/proof/:address/:subdomain/:expiry', merkleController.getProof);

// Validate CSV format
router.post('/validate', upload.single('file'), merkleController.validateCSV);

// Get tree stats
router.get('/stats', merkleController.getStats);

module.exports = router;
