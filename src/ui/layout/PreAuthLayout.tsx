import { FC, ReactNode } from 'react';
import { Box, Typography, useTheme as useMuiTheme } from '@mui/material';
import { spacing } from '@astra/theme/tokens/spacing';

interface PreAuthLayoutProps {
  children: ReactNode;
}

export const PreAuthLayout: FC<PreAuthLayoutProps> = ({ children }) => {
  const muiTheme = useMuiTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: muiTheme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Draggable titlebar */}
      <Box
        sx={{
          height: '32px',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: muiTheme.palette.background.paper,
          borderBottom: `1px solid ${muiTheme.palette.divider}`,
          WebkitAppRegion: 'drag',
          userSelect: 'none',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: muiTheme.palette.text.secondary,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontSize: '10px',
          }}
        >
          DHI — COGNITIVE MANAGEMENT SYSTEM
        </Typography>
      </Box>

      {/* Centered content area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: spacing.xl,
          overflowY: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
