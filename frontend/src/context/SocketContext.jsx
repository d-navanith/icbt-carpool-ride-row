import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const { user, token } = useAuth();

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    // Auto-dismiss after duration (default 5s, SOS = 12s)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    const newSocket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    // Listen for incoming booking requests (Driver)
    newSocket.on('new_booking_request', (data) => {
      const notif = {
        id: Date.now() + Math.random(),
        type: 'booking_request',
        title: 'New Booking Request',
        message: `${data.passengerName} requested ${data.seats || data.seats_booked || 1} seat${(data.seats || data.seats_booked || 1) > 1 ? 's' : ''} for ${data.origin} → ${data.destination}`,
        data,
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [notif, ...prev].slice(0, 30));
      addToast({
        type: 'info',
        title: '🔔 New Booking Request',
        message: `${data.passengerName} requested ${data.seats || data.seats_booked || 1} seat${(data.seats || data.seats_booked || 1) > 1 ? 's' : ''} for your ${data.origin} → ${data.destination} ride.`,
        duration: 8000
      });
    });

    // Listen for booking status changes (Passenger & Driver)
    newSocket.on('booking_status_updated', (data) => {
      const isConfirmed = data.status === 'confirmed';
      const isRejected = data.status === 'rejected';

      const notif = {
        id: Date.now() + Math.random(),
        type: 'booking_status',
        title: isConfirmed ? 'Booking Confirmed' : isRejected ? 'Booking Declined' : 'Booking Updated',
        message: `Booking #${data.bookingId} status is now: ${data.status.toUpperCase()}`,
        data,
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [notif, ...prev].slice(0, 30));

      addToast({
        type: isConfirmed ? 'success' : isRejected ? 'error' : 'info',
        title: isConfirmed ? '✓ Booking Confirmed!' : isRejected ? '✕ Booking Declined' : 'Booking Updated',
        message: `Your booking for Ride #${data.rideId} is now "${data.status}".`,
        duration: 6000
      });
    });

    // Listen for chat authorization errors
    newSocket.on('chat_error', (data) => {
      addToast({
        type: 'error',
        title: 'Chat Access Denied',
        message: data.message || 'You are not authorized for this carpool room.',
        duration: 6000
      });
    });

    // Listen for campus-wide SOS alerts
    newSocket.on('campus_sos_alert', (alert) => {
      setSosAlerts(prev => [alert, ...prev].slice(0, 20)); // keep last 20
      addToast({
        type: 'sos',
        title: '🚨 Emergency SOS Alert',
        message: `${alert.userName} on ride from ${alert.location}`,
        alertId: alert.alertId,
        duration: 12000
      });
    });

    // Listen for ride status broadcasts
    newSocket.on('ride_status_updated', (data) => {
      addToast({
        type: 'info',
        title: 'Ride Status Updated',
        message: `Ride #${data.rideId} is now "${data.status}" (by ${data.updatedBy})`,
        duration: 4000
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, addToast]);

  return (
    <SocketContext.Provider value={{
      socket,
      connected,
      sosAlerts,
      toasts,
      notifications,
      markAllNotificationsAsRead,
      addToast,
      dismissToast
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
