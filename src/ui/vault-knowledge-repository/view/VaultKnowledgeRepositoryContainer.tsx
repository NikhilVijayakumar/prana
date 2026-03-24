import { Box } from '@mui/material';
import { HeroSection } from 'astra';

export const VaultKnowledgeRepositoryContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Vault Knowledge Repository" 
        description="Module awaiting data and logic bindings. (PG-DHI-039)"
      />
    </Box>
  );
};
