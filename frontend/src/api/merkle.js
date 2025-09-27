import axios from "axios";

const base = process.env.REACT_APP_BACKEND_API || "http://localhost:3001";


export const uploadCSV = (file) => {
  const form = new FormData();
  form.append("file", file);
  return axios
    .post(`${base}/api/merkle/generate`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const getProof = async (address, subdomain, expiry) => {
  const response = await axios.get(
    `${base}/api/merkle/proof/${address}/${subdomain}/${expiry}`
  );
  return response.data;
};
