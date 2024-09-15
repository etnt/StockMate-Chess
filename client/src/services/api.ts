import axios from 'axios';
import { GetMoveRequest, GetMoveResponse } from '../../shared/types';

// Define the base URL for our API. This is where all our requests will be sent.
const API_URL = 'http://localhost:3001/api';

/**
 * Create an axios instance with predefined configuration.
 * 
 * Axios is a popular HTTP client for making requests. By creating an instance,
 * we can set default configurations that will be applied to all requests made
 * with this instance. This saves us from repeating these settings for each request.
 */
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Intercept requests to add the authorization token.
 * 
 * This interceptor will run before every request made with our api instance.
 * It checks if there's an access token in local storage, and if so, adds it
 * to the request headers. This is crucial for authenticating our requests.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * Attempt to log in a user.
 * 
 * This function sends a POST request to the server with the user's credentials.
 * If successful, it stores the received tokens in local storage for future authenticated requests.
 * 
 * @param {string} username - The user's username
 * @param {string} password - The user's password
 * @returns {Promise<Object>} The login response data
 * @throws {Error} If login fails
 */
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

/**
 * Register a new user.
 * 
 * Similar to login, this function sends a POST request to create a new user account.
 * If successful, it also stores the received tokens in local storage.
 * 
 * @param {string} username - The new user's username
 * @param {string} password - The new user's password
 * @returns {Promise<Object>} The registration response data
 * @throws {Error} If registration fails
 */
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

/**
 * Log out the current user.
 * 
 * This function does three things:
 * 1. Sends a POST request to the server to invalidate the session.
 * 2. Sends a WebSocket message to notify about the logout.
 * 3. Removes the stored tokens from local storage.
 * 
 * @param {WebSocket | null} ws - The WebSocket connection, if any
 */
export const logout = async (ws: WebSocket | null) => {
  try {
    // Send logout request to the server
    const response = await fetch('http://localhost:3001/api/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }

    // If logout was successful, send WebSocket message
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'logout' }));
    }

    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    console.log('Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

/**
 * Fetch the current user's data.
 * 
 * This function sends a GET request to retrieve the user's information.
 * The authorization token is automatically included by the interceptor we set up earlier.
 * 
 * @returns {Promise<Object>} The user data
 * @throws {Error} If fetching user data fails
 */
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

/**
 * Add a new game to the user's history.
 * 
 * This function sends a POST request to record a completed game in the user's history.
 * 
 * @param {number} opponentId - The ID of the opponent
 * @param {string} result - The result of the game
 * @returns {Promise<Object>} The response data
 */
export const addGame = async (opponentId: number, result: string) => {
  const response = await api.post('/game', { opponentId, result });
  return response.data;
};

/**
 * Update the user's Elo rating.
 * 
 * This function sends a PUT request to update the user's Elo rating after a game.
 * 
 * @param {number} newElo - The new Elo rating
 * @returns {Promise<Object>} The response data
 */
export const updateElo = async (newElo: number) => {
  const response = await api.put('/elo', { newElo });
  return response.data;
};

/**
 * Request a move from the server.
 * 
 * This function is used when playing against an AI opponent. It sends the current
 * board state to the server and receives the AI's move in response.
 * 
 * @param {GetMoveRequest} request - The request object containing the board state and opponent
 * @returns {Promise<GetMoveResponse>} The server's move response
 * @throws {Error} If getting the move fails
 */
export const getMoveFromServer = async (request: GetMoveRequest): Promise<GetMoveResponse> => {
  try {
    const response = await api.post('/api/get_move', request);
    return response.data;
  } catch (error) {
    console.error('Error getting move from server:', error);
    throw error;
  }
};

// Export the api instance in case it's needed elsewhere in the application
export default api;
