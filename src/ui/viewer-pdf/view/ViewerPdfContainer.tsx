import { Box } from '@mui/material';
import { HeroSection } from 'astra';

export const ViewerPdfContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Viewer Pdf" 
        description="Module awaiting data and logic bindings. (PG-DHI-041)"
      />
    </Box>
  );
};
