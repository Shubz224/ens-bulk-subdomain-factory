const fs = require('fs');
const csv = require('csv-parser');
const { MerkleTree } = require('merkletreejs');
const { ethers } = require('ethers');

// Store merkle data in memory (for demo - use Redis/DB in production)
let merkleData = {
  tree: null,
  leaves: [],
  records: [],
  root: null
};

/**
 * Generate Merkle tree from uploaded CSV
 * CSV format: address,subdomain,expiry
 */
exports.generateTree = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const rows = [];
    
    // Create a promise to handle async CSV reading properly
    const processCSV = new Promise((resolve, reject) => {
      const stream = fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          // Validate row format - ADD BETTER VALIDATION
          if (row.address && row.subdomain && row.expiry) {
            // Clean and validate address
            const cleanAddress = row.address.toLowerCase().trim();
            if (ethers.isAddress(cleanAddress)) {
              rows.push({
                address: cleanAddress,
                subdomain: row.subdomain.trim(),
                expiry: parseInt(row.expiry)
              });
            } else {
              console.warn(`Invalid address: ${row.address}`);
            }
          }
        })
        .on('end', () => {
          resolve(rows);
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    // Wait for CSV processing to complete
    const processedRows = await processCSV;
    
    // CHECK IF WE HAVE VALID ROWS
    if (processedRows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No valid rows found in CSV' });
    }

    // Generate leaves using same encoding as Solidity contract
    const leaves = processedRows.map(row => {
      return ethers.solidityPackedKeccak256(
        ['address', 'string', 'uint64'],
        [row.address, row.subdomain, row.expiry]
      );
    });

    // Create Merkle tree
    const tree = new MerkleTree(leaves, ethers.keccak256, { 
      sortPairs: true,
      sortLeaves: true 
    });

    const root = tree.getHexRoot();

    // Store in memory
    merkleData = {
      tree,
      leaves,
      records: processedRows,
      root
    };

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    console.log(`✅ Generated Merkle tree: ${leaves.length} leaves, root: ${root}`);

    res.json({
      success: true,
      merkleRoot: root,
      totalClaims: leaves.length,
      message: `Generated Merkle tree for ${leaves.length} claims`
    });

  } catch (error) {
    console.error('Upload error:', error);
    // Clean up file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
};

/**
 * Get Merkle proof for specific claim
 */
exports.getProof = async (req, res) => {
  try {
    if (!merkleData.tree) {
      return res.status(400).json({ error: 'No Merkle tree generated. Upload CSV first.' });
    }

    const { address, subdomain, expiry } = req.params;
    const cleanAddress = address.toLowerCase().trim();

    console.log(`🔍 Looking for proof: ${cleanAddress}, ${subdomain}, ${expiry}`);
    console.log(`📊 Available records: ${merkleData.records.length}`);

    // Generate leaf hash (same as contract)
    const leaf = ethers.solidityPackedKeccak256(
      ['address', 'string', 'uint64'],
      [cleanAddress, subdomain, parseInt(expiry)]
    );

    // CHECK if leaf exists in tree
    const leafIndex = merkleData.leaves.indexOf(leaf);
    if (leafIndex === -1) {
      console.log(`❌ Leaf not found in tree`);
      console.log(`🔍 Searching in records for: ${cleanAddress}`);
      
      // Debug: show available records
      const matchingRecords = merkleData.records.filter(r => r.address === cleanAddress);
      console.log(`📝 Found ${matchingRecords.length} matching records for address`);
      
      return res.status(404).json({ 
        error: 'Claim not found in Merkle tree',
        debug: {
          searchedFor: { address: cleanAddress, subdomain, expiry: parseInt(expiry) },
          availableRecords: matchingRecords,
          totalRecords: merkleData.records.length
        }
      });
    }

    // Get proof
    const proof = merkleData.tree.getHexProof(leaf);

    console.log(`✅ Proof generated: ${proof.length} elements`);

    res.json({
      success: true,
      address: cleanAddress,
      subdomain,
      expiry: parseInt(expiry),
      leaf,
      proof,
      merkleRoot: merkleData.root
    });

  } catch (error) {
    console.error('Proof generation error:', error);
    res.status(500).json({ error: 'Failed to generate proof: ' + error.message });
  }
};

/**
 * Get current tree statistics
 */
exports.getStats = async (req, res) => {
  res.json({
    hasTree: !!merkleData.tree,
    merkleRoot: merkleData.root,
    totalClaims: merkleData.records.length,
    sampleClaims: merkleData.records.slice(0, 5) // First 5 for preview
  });
};

// Keep your existing validateCSV function unchanged
exports.validateCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const rows = [];
    const errors = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row, index) => {
        const rowNum = index + 2; // +2 because CSV has header + 0-indexed

        // Validate address
        if (!row.address || !ethers.isAddress(row.address)) {
          errors.push(`Row ${rowNum}: Invalid Ethereum address`);
        }

        // Validate subdomain
        if (!row.subdomain || row.subdomain.trim().length === 0) {
          errors.push(`Row ${rowNum}: Missing subdomain`);
        }

        // Validate expiry
        if (!row.expiry || isNaN(parseInt(row.expiry))) {
          errors.push(`Row ${rowNum}: Invalid expiry timestamp`);
        }

        rows.push(row);
      })
      .on('end', () => {
        // Clean up file
        fs.unlinkSync(req.file.path);

        if (errors.length > 0) {
          return res.status(400).json({
            valid: false,
            errors,
            totalRows: rows.length
          });
        }

        res.json({
          valid: true,
          totalRows: rows.length,
          message: 'CSV format is valid'
        });
      })
      .on('error', (error) => {
        res.status(400).json({ error: 'Failed to parse CSV' });
      });

  } catch (error) {
    res.status(500).json({ error: 'Validation failed' });
  }
};
