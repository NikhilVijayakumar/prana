import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

interface NotificationSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface HookConfig {
  id: string;
  enabled: boolean;
}

/**
 * Settings dialog for managing notification preferences
 * Allows users to enable/disable individual hooks and set priority filters
 */
export const NotificationSettingsDialog: React.FC<NotificationSettingsDialogProps> = ({
  open,
  onClose,
}) => {
  const [hooks, setHooks] = useState<HookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [priorityFilters, setPriorityFilters] = useState<Record<string, boolean>>({
    CRITICAL: true,
    WARN: true,
    ACTION: true,
    INFO: true,
  });

  // Load hooks from API
  useEffect(() => {
    if (!open) return;

    const loadHooks = async () => {
      try {
        setIsLoading(true);
        setError(undefined);

        const api = (window as any).api?.hooks;
        if (!api?.list) {
          throw new Error('Hooks API not available');
        }

        const hooksList = await api.list();
        setHooks(
          hooksList.map((hook: any) => ({
            id: hook.id,
            enabled: hook.enabled,
          }))
        );

        // Load saved priority filters from localStorage
        const saved = localStorage.getItem('notificationPriorityFilters');
        if (saved) {
          setPriorityFilters(JSON.parse(saved));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hooks');
        console.error('Error loading hooks:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHooks();
  }, [open]);

  const handleHookToggle = async (hookId: string, enabled: boolean) => {
    try {
      const api = (window as any).api?.hooks;
      if (!api?.setEnabled) {
        throw new Error('Hooks API not available');
      }

      await api.setEnabled({
        hookId,
        enabled,
      });

      setHooks(prev =>
        prev.map(h =>
          h.id === hookId ? { ...h, enabled } : h
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hook');
      console.error('Error updating hook:', err);
    }
  };

  const handlePriorityFilterChange = (priority: string, checked: boolean) => {
    const updated = { ...priorityFilters, [priority]: checked };
    setPriorityFilters(updated);
    localStorage.setItem('notificationPriorityFilters', JSON.stringify(updated));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle>Notification Settings</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!isLoading && (
          <>
            {/* Priority Filters */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Show Notifications By Priority</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {Object.entries(priorityFilters).map(([priority, checked]) => (
                    <FormControlLabel
                      key={priority}
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={(e) => handlePriorityFilterChange(priority, e.target.checked)}
                        />
                      }
                      label={priority}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>

            {/* Hooks */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Enable/Disable Notifications</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {hooks.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No hooks configured
                  </Typography>
                ) : (
                  <List sx={{ width: '100%' }}>
                    {hooks.map((hook) => (
                      <ListItem key={hook.id} disablePadding>
                        <ListItemText
                          primary={hook.id}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: { fontFamily: 'monospace' },
                          }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            edge="end"
                            checked={hook.enabled}
                            onChange={(e) =>
                              handleHookToggle(hook.id, e.target.checked)
                            }
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Future Options */}
            <Accordion disabled>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2" color="textSecondary">
                  Email Forwarding (Coming Soon)
                </Typography>
              </AccordionSummary>
            </Accordion>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
