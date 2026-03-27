import { FC, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage, useTheme, ThemeToggle } from 'astra';
import { spacing } from 'astra';
import { DirectorInteractionBar } from '@prana/ui/components/DirectorInteractionBar';
import { APP_BRAND_NAME, APP_TITLEBAR_TAGLINE } from '@prana/ui/constants/appBranding';
import { getInteractionContextForPath } from '@prana/ui/constants/employeeDirectory';
import { getEnabledPrimaryNavItems, getFirstEnabledMainRoute } from '@prana/ui/constants/moduleRegistry';
import { useVolatileSessionStore } from '@prana/ui/state/volatileSessionStore';

interface MainLayoutProps {
  children?: ReactNode;
}

export const MainLayout: FC<MainLayoutProps> = ({ children }) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const themeContext = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const interactionContext = getInteractionContextForPath(location.pathname);
  const session = useVolatileSessionStore();
  const routeStackRef = useRef<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const primaryNavItems = useMemo(() => getEnabledPrimaryNavItems(), []);
  const defaultHomePath = useMemo(() => getFirstEnabledMainRoute(), []);

  const topLevelPaths = useMemo(() => new Set(primaryNavItems.map((item) => item.path)), [primaryNavItems]);
  const isOnboardingPhase = location.pathname.startsWith('/onboarding');

  useEffect(() => {
    const stack = routeStackRef.current;
    const last = stack[stack.length - 1];
    if (last !== location.pathname) {
      stack.push(location.pathname);
      if (stack.length > 100) {
        stack.shift();
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  const isLevel0Path = (path: string): boolean => topLevelPaths.has(path);

  const getCurrentDepth = (): number => {
    if (isOnboardingPhase || isLevel0Path(location.pathname)) {
      return 0;
    }

    const stack = routeStackRef.current;
    let depth = 1;
    for (let index = stack.length - 2; index >= 0; index -= 1) {
      if (isLevel0Path(stack[index])) {
        break;
      }
      depth += 1;
    }

    return depth;
  };

  const currentDepth = getCurrentDepth();

  const getActiveTopLevelPath = (): string | null => {
    if (isLevel0Path(location.pathname)) {
      return location.pathname;
    }

    const stack = routeStackRef.current;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (isLevel0Path(stack[index])) {
        return stack[index];
      }
    }

    return null;
  };

  const activeTopLevelPath = getActiveTopLevelPath();

  const handleHome = () => {
    navigate(defaultHomePath);
  };

  const handleBack = () => {
    const stack = routeStackRef.current;
    if (stack.length <= 1) {
      navigate(defaultHomePath);
      return;
    }

    stack.pop();
    const previous = stack[stack.length - 1] ?? defaultHomePath;
    navigate(previous);
  };

  const handlePrimaryNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh', 
      width: '100vw',
      backgroundColor: muiTheme.palette.background.default,
      overflow: 'hidden'
    }}>
      <CssBaseline />
      
      {/* Electron Draggable Titlebar (32px) */}
      <Box sx={{ 
        height: '32px', 
        minHeight: '32px',
        WebkitAppRegion: 'drag', // Electron specific
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: `1px solid ${muiTheme.palette.divider}`,
        backgroundColor: muiTheme.palette.background.paper,
        zIndex: muiTheme.zIndex.appBar,
      }}>
        <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
          {`${APP_BRAND_NAME} | ${APP_TITLEBAR_TAGLINE}`}
        </Typography>
      </Box>

      {/* Main Body Area */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Dynamic Content Area */}
        <Box component="main" sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          backgroundColor: muiTheme.palette.background.default,
          position: 'relative'
        }}>
          {!isOnboardingPhase && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: spacing.md,
                py: spacing.sm,
                borderBottom: `1px solid ${muiTheme.palette.divider}`,
                backgroundColor: muiTheme.palette.background.paper,
                position: 'sticky',
                top: 0,
                zIndex: muiTheme.zIndex.appBar,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                {currentDepth === 0 && (
                  <Tooltip title={literal['nav.menu']}>
                    <IconButton size="small" onClick={() => setIsDrawerOpen(true)}>
                      <MenuIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}

                {currentDepth >= 1 && (
                  <Tooltip title={literal['nav.back']}>
                    <IconButton size="small" onClick={handleBack}>
                      <ArrowBackIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}

                {currentDepth >= 2 && (
                  <Tooltip title={literal['nav.home']}>
                    <IconButton size="small" onClick={handleHome}>
                      <HomeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
                {location.pathname}
              </Typography>
            </Box>
          )}

          {!isOnboardingPhase && session.onboardingStatus !== 'COMPLETED' && (
            <Alert
              severity="info"
              sx={{
                mx: spacing.md,
                mt: spacing.sm,
              }}
              action={
                <Button color="inherit" size="small" onClick={() => navigate('/onboarding')}>
                  {literal['preview.banner.resumeOnboarding']}
                </Button>
              }
            >
              {literal['preview.banner.body']}
            </Alert>
          )}

          {!isOnboardingPhase && (
            <DirectorInteractionBar
              moduleRoute={location.pathname}
              moduleNameKey={interactionContext.moduleNameKey}
              ownerId={interactionContext.ownerId}
              secretaryId={interactionContext.secretaryId}
              onOpenProfile={(employeeId) => navigate(`/profile/${employeeId}`)}
            />
          )}
          {children}
        </Box>
      </Box>

      {!isOnboardingPhase && (
        <Drawer
          anchor="left"
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: 280,
              borderRight: `1px solid ${muiTheme.palette.divider}`,
              backgroundColor: muiTheme.palette.background.paper,
              p: spacing.md,
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.sm }}>
            <Typography variant="body2Bold">{literal['nav.menu']}</Typography>
            <IconButton size="small" onClick={() => setIsDrawerOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <List sx={{ p: 0 }}>
            {session.onboardingStatus !== 'COMPLETED' && (
              <ListItemButton
                selected={location.pathname.startsWith('/onboarding')}
                onClick={() => handlePrimaryNavigate('/onboarding')}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemText primary={literal['nav.backToOnboarding']} />
              </ListItemButton>
            )}

            {primaryNavItems.map((item) => (
              <ListItemButton
                key={item.path}
                selected={activeTopLevelPath === item.path}
                onClick={() => handlePrimaryNavigate(item.path)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemText primary={literal[item.labelKey]} />
              </ListItemButton>
            ))}
          </List>

          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <ThemeToggle themeContext={themeContext} />
          </Box>
        </Drawer>
      )}

      {/* Persistent Footer */}
      <Box sx={{ 
        height: '28px', 
        minHeight: '28px',
        borderTop: `1px solid ${muiTheme.palette.divider}`,
        backgroundColor: muiTheme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        px: spacing.md,
        zIndex: muiTheme.zIndex.drawer + 1,
      }}>
        <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
          Dharma Registry Active | Prana Engine Secure
        </Typography>
      </Box>
    </Box>
  );
};
