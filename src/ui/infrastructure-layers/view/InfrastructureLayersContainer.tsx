import { Box } from '@mui/material';
import { HeroSection } from '@astra/components/ui/HeroSection';

export const InfrastructureLayersContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Infrastructure Layers" 
        description="Module awaiting data and logic bindings. (PG-DHI-012)"
      />
    </Box>
  );
};
