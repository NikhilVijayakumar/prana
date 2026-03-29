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
import { PranaUiError } from './errors/pranaErrorTypes';

interface PranaModuleErrorViewProps {
  error: PranaUiError;
  onRetry?: () => void;
}

export const PranaModuleErrorView: FC<PranaModuleErrorViewProps> = ({ error, onRetry }) => {
  const muiTheme = useMuiTheme();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Box sx={{ width: '100%', minHeight: '100%', p: spacing.lg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 760, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: spacing.sm }}>
            {error.title}
          </Typography>
          <Alert severity="error" sx={{ mb: spacing.md }}>
            {error.userMessage}
          </Alert>
          <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary, display: 'block', mb: spacing.md }}>
            Error ID: {error.id}
          </Typography>
          <Box sx={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            {onRetry ? (
              <Button variant="contained" color="error" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            <Button variant="outlined" onClick={() => setShowDetails((prev) => !prev)}>
              {showDetails ? 'Hide Technical Details' : 'Show Technical Details'}
            </Button>
          </Box>
          <Collapse in={showDetails}>
            <List dense sx={{ mt: spacing.md, border: `1px solid ${muiTheme.palette.divider}`, borderRadius: '8px' }}>
              {error.technicalDetails.map((line, index) => (
                <ListItem key={`${error.id}-${index}`} disableGutters sx={{ px: spacing.sm }}>
                  <ListItemText primary={line} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
};
