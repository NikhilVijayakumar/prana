import { Box } from '@mui/material';
import { HeroSection } from 'astra';

export const ForgotPasswordContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Forgot Password" 
        description="Module awaiting data and logic bindings. (PG-DHI-009)"
      />
    </Box>
  );
};
