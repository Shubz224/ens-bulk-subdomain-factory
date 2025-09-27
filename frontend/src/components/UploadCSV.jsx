import React, { useState } from 'react';
import { uploadCSV } from '../api/merkle';
import toast from 'react-hot-toast';

export default function UploadCSV({ onRoot }) {
  const [loading, setLoading] = useState(false);
  const [root, setRoot] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Basic validation
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file.');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    setLoading(true); 
    setRoot(null);
    setFileInfo({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB'
    });
    
    try {
      const resp = await uploadCSV(file);
      setRoot(resp.merkleRoot);
      setFileInfo(prev => ({ ...prev, entries: resp.totalClaims }));
      onRoot && onRoot(resp.merkleRoot, resp.totalClaims);
      toast.success(`Root generated successfully! (${resp.totalClaims} entries)`);
    } catch (e) {
      console.error('Upload error:', e);
      toast.error('CSV upload failed. Check format.');
      setFileInfo(null);
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
        <label htmlFor="csv-upload" className={`cursor-pointer ${loading ? 'opacity-50' : ''}`}>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium">
            {loading ? 'Processing...' : 'Click to upload CSV'}
          </p>
          <p className="text-gray-500 text-sm mt-1">Supports .csv files (max 10MB)</p>
        </label>
      </div>
      
      {/* File info display */}
      {fileInfo && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm space-y-1">
            <div><strong>File:</strong> {fileInfo.name}</div>
            <div><strong>Size:</strong> {fileInfo.size}</div>
            {fileInfo.entries && <div><strong>Entries:</strong> {fileInfo.entries}</div>}
          </div>
        </div>
      )}
      
      {root && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm font-medium mb-2">✅ Merkle root generated!</p>
          <div className="font-mono text-xs text-green-700 bg-white p-2 rounded border break-all">
            {root}
          </div>
        </div>
      )}
    </div>
  );
}
