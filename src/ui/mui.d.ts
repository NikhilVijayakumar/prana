import type { CSSProperties } from 'react';
import '@mui/material/styles';
import '@mui/material/Typography';

declare module '@mui/material/styles' {
  interface TypographyVariants {
    micro: CSSProperties;
    body2Bold: CSSProperties;
    body2Medium: CSSProperties;
    captionBold: CSSProperties;
    monoBody: CSSProperties;
    monoCaption: CSSProperties;
    splashTitle: CSSProperties;
    splashSubtitle: CSSProperties;
  }

  interface TypographyVariantsOptions {
    micro?: CSSProperties;
    body2Bold?: CSSProperties;
    body2Medium?: CSSProperties;
    captionBold?: CSSProperties;
    monoBody?: CSSProperties;
    monoCaption?: CSSProperties;
    splashTitle?: CSSProperties;
    splashSubtitle?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    micro: true;
    body2Bold: true;
    body2Medium: true;
    captionBold: true;
    monoBody: true;
    monoCaption: true;
    splashTitle: true;
    splashSubtitle: true;
  }
}
