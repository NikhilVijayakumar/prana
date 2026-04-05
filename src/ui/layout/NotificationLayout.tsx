import React, { useState } from 'react';
import { NotificationProvider } from '../../context/NotificationContext';
import { ToastProvider } from '../../context/ToastContext';
import { ToastContainer } from '../notifications/ToastContainer';
import { NotificationBadge } from '../notifications/NotificationBadge';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { NotificationSettingsDialog } from '../notifications/NotificationSettings';
import { Box, AppBar, Toolbar, IconButton } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

interface NotificationLayoutProps {
  children: React.ReactNode;
}

/**
 * Wraps child components with all required notification providers and components
 * 
 * Includes:
 * - NotificationProvider (manages notification state and IPC)
 * - ToastProvider (manages toast notifications)
 * - ToastContainer (renders toast notifications)
 * - NotificationBadge (icon with unread count in header)
 * - NotificationPanel (drawer for full notification list)
 * - NotificationSettingsDialog (settings for hooks/preferences)
 * 
 * Usage:
 * ```tsx
 * <NotificationLayout>
 *   <YourAppComponents />
 * </NotificationLayout>
 * ```
 */
export const NotificationLayout: React.FC<NotificationLayoutProps> = ({ children }) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <NotificationProvider>
      <ToastProvider>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {/* Header with notification badge */}
          <AppBar position="fixed" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar>
              <Box sx={{ flex: 1 }} />
              {/* Notification Badge */}
              <NotificationBadge
                onClick={() => setPanelOpen(true)}
                disabled={false}
              />
              {/* Settings */}
              <IconButton
                size="small"
                color="inherit"
                onClick={() => setSettingsOpen(true)}
                title="Notification Settings"
              >
                <SettingsIcon />
              </IconButton>
            </Toolbar>
          </AppBar>

          {/* Main content area with padding for app bar */}
          <Box sx={{ flex: 1, mt: 'var(--app-bar-height, 64px)' }}>
            {children}
          </Box>

          {/* Toast Container */}
          <ToastContainer />

          {/* Notification Panel */}
          <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

          {/* Settings Dialog */}
          <NotificationSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Box>
      </ToastProvider>
    </NotificationProvider>
  );
};
