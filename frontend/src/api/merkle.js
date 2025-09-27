import axios from "axios";

const base = process.env.REACT_APP_BACKEND_API || "http://localhost:3001";

export const uploadCSV = (file) => {
  const form = new FormData();
  form.append("file", file);
  return axios
    .post(`${base}/api/merkle/generate`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000, // 60 second timeout for large files
    })
    .then((r) => {
      console.log('✅ Upload response:', r.data);
      return r.data;
    })
    .catch((error) => {
      console.error('❌ Upload error:', error.response?.data || error.message);
      throw error;
    });
};

export const getProof = async (address, subdomain, expiry) => {
  try {
    console.log(`🔍 Requesting proof for: ${address}, ${subdomain}, ${expiry}`);
    const response = await axios.get(
      `${base}/api/merkle/proof/${address}/${subdomain}/${expiry}`
    );
    console.log('✅ Proof response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Proof error:', error.response?.data || error.message);
    throw error;
  }
};

// ADD THIS NEW FUNCTION FOR DEBUGGING
export const getStats = async () => {
  const response = await axios.get(`${base}/api/stats`);
  return response.data;
};
