import React, { useState } from 'react';
import { uploadCSV } from '../api/merkle';
import toast from 'react-hot-toast';

export default function UploadCSV({ onRoot }) {
  const [loading, setLoading] = useState(false);
  const [root, setRoot] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true); 
    setRoot(null);
    try {
      const resp = await uploadCSV(file);
      setRoot(resp.merkleRoot);
      onRoot && onRoot(resp.merkleRoot, resp.totalClaims);
      toast.success(`Root generated successfully!`);
    } catch (e) {
      toast.error('CSV upload failed. Check format.');
    }
    setLoading(false);
  };

  return (
    <div>
      <label className="block mb-3 text-gray-700 font-medium">Upload CSV File</label>
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={loading}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium">
            {loading ? 'Processing...' : 'Click to upload CSV'}
          </p>
          <p className="text-gray-500 text-sm mt-1">Supports .csv files</p>
        </label>
      </div>
      
      {root && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm font-medium">✅ Merkle root generated!</p>
        </div>
      )}
    </div>
  );
}
