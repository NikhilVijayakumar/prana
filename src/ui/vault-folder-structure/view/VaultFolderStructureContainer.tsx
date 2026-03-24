import { Box } from '@mui/material';
import { HeroSection } from '@astra/components/ui/HeroSection';

export const VaultFolderStructureContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Vault Folder Structure" 
        description="Module awaiting data and logic bindings. (PG-DHI-038)"
      />
    </Box>
  );
};
