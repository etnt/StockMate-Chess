import { useState, useEffect, useMemo } from 'react';
import { OnlineUser, User } from '../../../shared/types';

export function useWebSocket(user: User | null) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

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
    ws,
    onlineUsers: memoizedOnlineUsers
  };
}
