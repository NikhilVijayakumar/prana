import { Box } from '@mui/material';
import { HeroSection } from '@astra/components/ui/HeroSection';

export const LoginContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Login" 
        description="Module awaiting data and logic bindings. (PG-DHI-015)"
      />
    </Box>
  );
};
