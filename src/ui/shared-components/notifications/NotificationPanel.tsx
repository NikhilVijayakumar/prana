import React, { useState } from 'react';
import {
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tabs,
  Tab,
  Box,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Close as CloseIcon,
  MarkEmailRead as MarkAsReadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationListFilters } from '../../../../main/services/notificationStoreService';

type TabValue = 'all' | 'unread' | 'critical' | 'warnings';

const priorityColorMap: Record<string, 'primary' | 'warning' | 'error' | 'info'> = {
  CRITICAL: 'error',
  WARN: 'warning',
  ACTION: 'primary',
  INFO: 'info',
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  open,
  onClose,
}) => {
  const { notifications, isLoading, error, markRead, markDismissed, refreshNotifications } =
    useNotifications();

  const [currentTab, setCurrentTab] = useState<TabValue>('all');
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const getFilters = (): NotificationListFilters => {
    switch (currentTab) {
      case 'unread':
        return { unreadOnly: true };
      case 'critical':
        return { priority: ['CRITICAL'] };
      case 'warnings':
        return { priority: ['CRITICAL', 'WARN'] };
      default:
        return {};
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabValue) => {
    setCurrentTab(newValue);
    setPage(0);
    refreshNotifications(getFilters());
  };

  const handleMarkAsRead = async (notificationIds: string[]) => {
    try {
      await markRead(notificationIds);
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAsDismissed = async (notificationIds: string[]) => {
    try {
      await markDismissed(notificationIds);
    } catch (err) {
      console.error('Failed to mark as dismissed:', err);
    }
  };

  const handleRefresh = async () => {
    await refreshNotifications(getFilters());
  };

  const filteredNotifications = notifications.slice(
    page * pageSize,
    (page + 1) * pageSize
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400, md: 500 },
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Notifications
          </Typography>
          <IconButton edge="end" color="inherit" onClick={handleRefresh} disabled={isLoading}>
            <RefreshIcon />
          </IconButton>
          <IconButton edge="end" color="inherit" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="All" value="all" />
        <Tab label="Unread" value="unread" />
        <Tab label="Critical" value="critical" />
        <Tab label="Warnings" value="warnings" />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {error && (
          <Alert severity="error" sx={{ m: 1 }}>
            {error}
          </Alert>
        )}

        {isLoading && notifications.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {filteredNotifications.length === 0 && !isLoading && (
          <Alert severity="info" sx={{ m: 1 }}>
            No notifications in this view
          </Alert>
        )}

        <List sx={{ width: '100%' }}>
          {filteredNotifications.map((notification) => (
            <ListItem
              key={notification.notificationId}
              sx={{
                backgroundColor: !notification.isRead ? 'action.hover' : 'transparent',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'action.selected',
                },
              }}
              onClick={() => setSelectedNotification(notification.notificationId)}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={notification.priority}
                      size="small"
                      color={priorityColorMap[notification.priority]}
                      variant="outlined"
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: !notification.isRead ? 600 : 400,
                        flex: 1,
                      }}
                    >
                      {notification.message}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="textSecondary">
                      {notification.source}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(notification.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                {!notification.isRead && (
                  <IconButton
                    edge="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead([notification.notificationId]);
                    }}
                    title="Mark as read"
                  >
                    <MarkAsReadIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsDismissed([notification.notificationId]);
                  }}
                  title="Dismiss"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Pagination */}
      {filteredNotifications.length > 0 && (
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Typography variant="caption" sx={{ alignSelf: 'center' }}>
            Page {page + 1}
          </Typography>
          <Button
            onClick={() => setPage(page + 1)}
            disabled={filteredNotifications.length < pageSize}
          >
            Next
          </Button>
        </Box>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedNotification}
        onClose={() => setSelectedNotification(null)}
        PaperProps={{ sx: { minWidth: '400px' } }}
      >
        {selectedNotification && notifications.find(n => n.notificationId === selectedNotification) && (
          <>
            <DialogTitle>
              {notifications.find(n => n.notificationId === selectedNotification)?.message}
            </DialogTitle>
            <DialogContent>
              {notifications.find(n => n.notificationId === selectedNotification) && (
                <Box sx={{ pt: 2 }}>
                  <Typography variant="caption" color="textSecondary">
                    Type: {notifications.find(n => n.notificationId === selectedNotification)?.eventType}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="textSecondary">
                    Source: {notifications.find(n => n.notificationId === selectedNotification)?.source}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="textSecondary">
                    Created: {new Date(notifications.find(n => n.notificationId === selectedNotification)?.createdAt || '').toLocaleString()}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedNotification(null)}>Close</Button>
              <Button
                onClick={() => {
                  handleMarkAsDismissed([selectedNotification]);
                  setSelectedNotification(null);
                }}
                variant="contained"
              >
                Dismiss
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Drawer>
  );
};
