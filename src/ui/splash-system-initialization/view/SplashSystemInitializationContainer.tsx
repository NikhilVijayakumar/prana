import { Box } from '@mui/material';
import { HeroSection } from '@astra/components/ui/HeroSection';

export const SplashSystemInitializationContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Splash System Initialization" 
        description="Module awaiting data and logic bindings. (PG-DHI-035)"
      />
    </Box>
  );
};
