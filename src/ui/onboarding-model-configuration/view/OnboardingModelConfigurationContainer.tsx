import { Box, TextField, Button } from '@mui/material';
import { HeroSection } from 'astra';
import { FormLayout } from 'astra';
import { Card } from 'astra';

export const OnboardingModelConfigurationContainer = () => {
  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <HeroSection 
        headline="Model Configuration" 
        description="Configure operation parameters, endpoints, and credentials for local or remote extraction models."
      >
        <FormLayout 
          title="Endpoint Connections" 
          actions={<Button variant="outlined" color="primary">Test All Connections</Button>}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            <Box>
              <Card title="OpenCLAW" supportingText="Primary reasoning and logical validation engine.">
                <TextField label="Endpoint URI" fullWidth size="small" placeholder="http://localhost:8080" />
                <TextField label="API Token" fullWidth type="password" size="small" />
                <TextField label="Temperature" type="number" fullWidth size="small" placeholder="0.2" />
                <TextField label="Token Limit" type="number" fullWidth size="small" placeholder="4096" />
              </Card>
            </Box>

            <Box>
              <Card title="Goose" supportingText="Specialized high-speed text structuring engine.">
                <TextField label="Endpoint URI" fullWidth size="small" />
                <TextField label="API Token" fullWidth type="password" size="small" />
                <TextField label="Temperature" type="number" fullWidth size="small" placeholder="0.1" />
                <TextField label="Token Limit" type="number" fullWidth size="small" placeholder="2048" />
              </Card>
            </Box>

            <Box>
              <Card title="NemoClaw" supportingText="Local anchoring layer.">
                <TextField label="Endpoint URI" fullWidth size="small" />
                <TextField label="API Token" fullWidth type="password" size="small" />
              </Card>
            </Box>
          </Box>
        </FormLayout>
      </HeroSection>
    </Box>
  );
};
