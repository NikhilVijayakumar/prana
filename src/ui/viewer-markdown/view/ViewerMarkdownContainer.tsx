import { Box } from '@mui/material';
import { HeroSection } from '@astra/components/ui/HeroSection';

export const ViewerMarkdownContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Viewer Markdown" 
        description="Module awaiting data and logic bindings. (PG-DHI-040)"
      />
    </Box>
  );
};
