const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
const merkleRoutes = require('./routes/merkle');
app.use('/api/merkle', merkleRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'ENS Bulk Subdomain Backend API', status: 'running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
});
