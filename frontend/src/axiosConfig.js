import axios from 'axios';

const api = axios.create({
  baseURL: 'http://LOCALHOST:5000/', // Set your base URL here
  timeout: 5000, // Set your desired timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;