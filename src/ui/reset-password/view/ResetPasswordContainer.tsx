import { Box } from '@mui/material';
import { HeroSection } from '@astra/components/ui/HeroSection';

export const ResetPasswordContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Reset Password" 
        description="Module awaiting data and logic bindings. (PG-DHI-032)"
      />
    </Box>
  );
};
