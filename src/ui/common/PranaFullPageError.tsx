import { FC, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';
import { spacing } from 'astra';

interface PranaFullPageErrorProps {
  title?: string;
  errors: string[];
  onRetry?: () => void;
}

export const PranaFullPageError: FC<PranaFullPageErrorProps> = ({
  title = 'Prana Error',
  errors,
  onRetry,
}) => {
  const muiTheme = useMuiTheme();
  const [openDetails, setOpenDetails] = useState(false);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: muiTheme.palette.background.default,
        p: spacing.lg,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 760, borderRadius: 2 }}>
        <CardContent sx={{ p: spacing.xl }}>
          <Typography variant="h5" sx={{ mb: spacing.sm, color: muiTheme.palette.text.primary }}>
            {title}
          </Typography>

          <Alert severity="error" sx={{ mb: spacing.md }}>
            Prana could not continue due to one or more errors.
          </Alert>

          <List dense sx={{ border: `1px solid ${muiTheme.palette.divider}`, borderRadius: '8px', mb: spacing.md }}>
            {errors.map((error, index) => (
              <ListItem key={`${error}-${index}`} disableGutters sx={{ px: spacing.md }}>
                <ListItemText
                  primary={error}
                  primaryTypographyProps={{ color: muiTheme.palette.text.secondary, variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>

          <Box sx={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            {onRetry ? (
              <Button variant="contained" color="error" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            <Button variant="outlined" onClick={() => setOpenDetails((prev) => !prev)}>
              {openDetails ? 'Hide Technical Details' : 'Show Technical Details'}
            </Button>
          </Box>

          <Collapse in={openDetails}>
            <Box
              sx={{
                mt: spacing.md,
                p: spacing.md,
                borderRadius: '8px',
                border: `1px solid ${muiTheme.palette.divider}`,
                backgroundColor: muiTheme.palette.background.paper,
              }}
            >
              <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
                {errors.join('\n')}
              </Typography>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
};
