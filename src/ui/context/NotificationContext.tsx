import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Notification, NotificationListFilters } from '../../../main/services/notificationStoreService';
import { NotificationCentreTelemetry } from '../../../main/services/notificationCentreService';

export type NotificationPriority = 'INFO' | 'WARN' | 'CRITICAL' | 'ACTION';

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error?: string;
  telemetry?: {
    centre: NotificationCentreTelemetry;
    store: Record<string, number>;
    rateLimiter: any;
  };

  // Actions
  markRead: (notificationIds: string[]) => Promise<number>;
  markDismissed: (notificationIds: string[]) => Promise<number>;
  recordAction: (notificationId: string, action: 'VIEWED' | 'DISMISSED' | 'ACTIONED') => Promise<void>;
  refreshNotifications: (filters?: NotificationListFilters, limit?: number) => Promise<void>;
  cleanup: (days?: number) => Promise<number>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
  pollIntervalMs?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  pollIntervalMs = 5000,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [telemetry, setTelemetry] = useState<NotificationContextType['telemetry']>();

  // Check if window.api is available
  const hasApi = typeof window !== 'undefined' && (window as any).api?.notifications;

  const refreshNotifications = async (
    filters?: NotificationListFilters,
    limit: number = 50,
  ) => {
    if (!hasApi) return;

    try {
      setIsLoading(true);
      setError(undefined);

      const result = await (window as any).api.notifications.list({
        filters,
        limit,
        offset: 0,
      });

      if (result && result.items) {
        setNotifications(result.items);
      }

      const count = await (window as any).api.notifications.getUnreadCount();
      setUnreadCount(count);

      const telemetryData = await (window as any).api.notifications.getTelemetry();
      setTelemetry(telemetryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const markRead = async (notificationIds: string[]): Promise<number> => {
    if (!hasApi) return 0;

    try {
      const result = await (window as any).api.notifications.markRead({
        notificationIds,
      });

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.notificationId)
            ? { ...n, isRead: true }
            : n
        )
      );

      await refreshNotifications();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
      throw err;
    }
  };

  const markDismissed = async (notificationIds: string[]): Promise<number> => {
    if (!hasApi) return 0;

    try {
      const result = await (window as any).api.notifications.markDismissed({
        notificationIds,
      });

      // Update local state
      setNotifications(prev =>
        prev.filter(n => !notificationIds.includes(n.notificationId))
      );

      await refreshNotifications();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as dismissed');
      throw err;
    }
  };

  const recordAction = async (
    notificationId: string,
    action: 'VIEWED' | 'DISMISSED' | 'ACTIONED',
  ): Promise<void> => {
    if (!hasApi) return;

    try {
      await (window as any).api.notifications.recordAction({
        notificationId,
        action,
      });
    } catch (err) {
      console.error('Failed to record action:', err);
      throw err;
    }
  };

  const cleanup = async (days: number = 7): Promise<number> => {
    if (!hasApi) return 0;

    try {
      const result = await (window as any).api.notifications.cleanup({
        days,
      });

      await refreshNotifications();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup notifications');
      throw err;
    }
  };

  // Initial load and polling
  useEffect(() => {
    if (!hasApi) return;

    // Initial load
    refreshNotifications();

    // Setup polling
    const pollInterval = setInterval(() => {
      refreshNotifications();
    }, pollIntervalMs);

    return () => {
      clearInterval(pollInterval);
    };
  }, [hasApi, pollIntervalMs]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    error,
    telemetry,
    markRead,
    markDismissed,
    recordAction,
    refreshNotifications,
    cleanup,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
