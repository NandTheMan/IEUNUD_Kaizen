'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // This logic ensures the correct connection in both dev and prod
    const socketInstance =
      process.env.NODE_ENV === 'production'
        ? io({
            path: '/socket.io/', // Use relative path for production via Nginx
            autoConnect: true,
            reconnection: true,
          })
        : io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
            autoConnect: true,
            reconnection: true,
          });

    setSocket(socketInstance);

    function onConnect() {
      console.log('Socket.IO: Connected');
      setIsConnected(true);
    }

    function onDisconnect() {
      console.log('Socket.IO: Disconnected');
      setIsConnected(false);
    }

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.disconnect();
    };
  }, []);

  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>;
};
