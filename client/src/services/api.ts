import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const login = async (username: string, password: string) => {
  try {
    const response = await api.post('/login', { username, password });
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else {
      throw new Error('An error occurred during login');
    }
  }
};

export const register = async (username: string, password: string) => {
  try {
    const response = await api.post('/register', { username, password });
    if (response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else {
      throw new Error('An error occurred during registration');
    }
  }
};

export const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const getUserData = async () => {
  try {
    const response = await api.get('/user');
    console.log('User data response:', response.data);  // Add this line
    return response.data;
  } catch (error) {
    console.error('Error fetching user data:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const addGame = async (opponentId: number, result: string) => {
  const response = await api.post('/game', { opponentId, result });
  return response.data;
};

export const updateElo = async (newElo: number) => {
  const response = await api.put('/elo', { newElo });
  return response.data;
};

export default api;
