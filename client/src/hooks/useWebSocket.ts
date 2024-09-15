import { useState, useEffect, useMemo } from 'react';
import { OnlineUser, User } from '../../../shared/types';

/**
 * Custom React hook for managing WebSocket connections and online users.
 * 
 * This hook encapsulates the logic for:
 * - Establishing and managing a WebSocket connection
 * - Handling WebSocket events (open, message, error, close)
 * - Maintaining a list of online users
 * 
 * @param user - The current authenticated user, or null if not authenticated
 * @returns An object containing the WebSocket instance and a list of online users
 */
export function useWebSocket(user: User | null) {
  // The WebSocket instance
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  // The list of currently online users
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  /**
   * Effect hook to establish and manage the WebSocket connection.
   * 
   * This effect runs whenever the user state changes. It:
   * - Creates a new WebSocket connection
   * - Sets up event listeners for the WebSocket
   * - Sends a login message when the connection is established (if a user is authenticated)
   * - Cleans up the connection when the component unmounts or the user changes
   */
  useEffect(() => {
    console.log('Initializing WebSocket connection');
    const socket = new WebSocket('ws://localhost:3001');
    setWs(socket);

    socket.onopen = () => {
      console.log('WebSocket connection established');
      if (user) {
        socket.send(JSON.stringify({ type: 'login', username: user.username }));
      }
    };

    socket.onmessage = (event) => {
      console.log(`Received WebSocket message: ${event.data}`);
      const data = JSON.parse(event.data);
      if (data.type === 'onlineUsers') {
        console.log('Received online users:', data.users);
        setOnlineUsers(data.users);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      console.log('Closing WebSocket connection');
      socket.close();
    };
  }, [user]);

  /**
   * Memoized list of online users, excluding the current user.
   * 
   * This list is recalculated whenever the onlineUsers state or the user changes.
   * It filters out the current user and removes any duplicates.
   */
  const memoizedOnlineUsers = useMemo(() => {
    return onlineUsers.filter((onlineUser: OnlineUser) => 
      onlineUser.username !== user?.username
    ).reduce((acc: OnlineUser[], current: OnlineUser) => {
      const x = acc.find(item => item.username === current.username);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, []);
  }, [onlineUsers, user]);

  return {
    ws,                    // The WebSocket instance
    onlineUsers: memoizedOnlineUsers  // The filtered and deduplicated list of online users
  };
}
