import { useState, useEffect, useCallback } from 'react';
import { User } from '../../../shared/types';
import { login, register, logout, getUserData } from '../services/api';

/**
 * Custom React hook for managing user authentication.
 * 
 * This hook encapsulates the logic for:
 * - User login
 * - User registration
 * - User logout
 * - Fetching and maintaining user data
 * 
 * @returns An object containing the user state and authentication functions.
 */
export function useAuth() {
  // The current authenticated user, or null if not authenticated
  const [user, setUser] = useState<User | null>(null);

  /**
   * Fetches the current user's data from the server.
   * 
   * This function is called when the component mounts if an access token is present,
   * and after successful login or registration.
   */
  const fetchUserData = useCallback(async () => {
    try {
      const userData = await getUserData();
      console.log('Fetched user data:', userData);
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      handleLogout();
    }
  }, []);

  /**
   * Effect hook to check for an existing authentication token and fetch user data if present.
   * 
   * This effect runs once when the component mounts.
   */
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUserData();
    }
  }, [fetchUserData]);

  /**
   * Attempts to log in a user with the provided credentials.
   * 
   * @param username - The user's username
   * @param password - The user's password
   * @throws Will throw an error if login fails
   */
  const handleLogin = async (username: string, password: string) => {
    console.log(`Attempting login for user: ${username}`);
    try {
      const data = await login(username, password);
      console.log('Login data:', data);
      if (data.success) {
        console.log('Login successful');
        setUser(data);
      } else {
        console.log('Login failed:', data.error);
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  /**
   * Attempts to register a new user with the provided credentials.
   * 
   * @param username - The desired username for the new user
   * @param password - The desired password for the new user
   * @throws Will throw an error if registration fails
   */
  const handleRegister = async (username: string, password: string) => {
    try {
      const data = await register(username, password);
      if (data.success) {
        fetchUserData();
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  /**
   * Logs out the current user.
   * 
   * This function clears the user's authentication token and resets the user state.
   */
  const handleLogout = () => {
    console.log('Logging out');
    logout(null); // Passing null as we don't have access to WebSocket here
    setUser(null);
  };

  return {
    user,            // The current authenticated user, or null if not authenticated
    handleLogin,     // Function to log in a user
    handleRegister,  // Function to register a new user
    handleLogout     // Function to log out the current user
  };
}
