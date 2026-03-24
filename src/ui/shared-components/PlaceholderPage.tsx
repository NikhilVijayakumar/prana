import { FC } from 'react';
import { Box } from '@mui/material';
import { HeroSection } from '@astra/components/ui/HeroSection';

interface PlaceholderPageProps {
  headline: string;
  code: string;
}

/**
 * Standard placeholder for pages awaiting implementation.
 *
 * Replaces repeated container stubs across application modules that all
 * render `<Box sx={{ p: 4 }}><HeroSection headline="..." .../></Box>`.
 */
export const PlaceholderPage: FC<PlaceholderPageProps> = ({ headline, code }) => (
  <Box sx={{ p: 4, width: '100%' }}>
    <HeroSection
      headline={headline}
      description={`Module awaiting data and logic bindings. (${code})`}
    />
  </Box>
);
