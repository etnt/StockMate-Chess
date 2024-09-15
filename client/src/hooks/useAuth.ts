import { useState, useEffect } from 'react';
import { User } from '../../../shared/types';
import { login, register, logout, getUserData } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUserData();
    }
  }, []);

  const fetchUserData = async () => {
    try {
      const userData = await getUserData();
      console.log('Fetched user data:', userData);
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      handleLogout();
    }
  };

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
      console.error('Login error:', error.message);
      throw error;
    }
  };

  const handleRegister = async (username: string, password: string) => {
    try {
      const data = await register(username, password);
      if (data.success) {
        fetchUserData();
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration failed:', error.message);
      throw error;
    }
  };

  const handleLogout = () => {
    console.log('Logging out');
    logout();
    setUser(null);
  };

  return {
    user,
    handleLogin,
    handleRegister,
    handleLogout
  };
}
