import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: API_BASE });

export function setAccessToken(token: string) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export async function fetchProfile() {
  const res = await api.get('/api/users/me');
  return res.data;
}

export async function fetchData() {
  const res = await api.get('/api/data');
  return res.data;
}

export default api;
