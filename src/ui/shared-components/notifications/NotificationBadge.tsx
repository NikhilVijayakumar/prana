import React from 'react';
import { IconButton, Badge, Box, Tooltip } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useNotifications } from '../../context/NotificationContext';

interface NotificationBadgeProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Notification bell icon with unread count badge
 * Typically placed in app header/navbar
 */
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  onClick,
  disabled = false,
}) => {
  const { unreadCount } = useNotifications();

  return (
    <Tooltip title={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}>
      <Box>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          size="large"
          color="inherit"
          sx={{
            position: 'relative',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            overlap="circular"
            sx={{
              '& .MuiBadge-badge': {
                backgroundColor: 'error.main',
                color: 'error.main',
                boxShadow: `0 0 0 2px white`,
                '&::after': {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  animation: unreadCount > 0 ? 'ripple 1.2s infinite ease-in-out' : 'none',
                  border: '1px solid currentColor',
                  content: '""',
                },
              },
              '@keyframes ripple': {
                '0%': {
                  transform: 'scale(.8)',
                  opacity: 1,
                },
                '100%': {
                  transform: 'scale(2.4)',
                  opacity: 0,
                },
              },
            }}
          >
            <NotificationsIcon sx={{ fontSize: 24 }} />
          </Badge>
        </IconButton>
      </Box>
    </Tooltip>
  );
};
