import fs from 'fs';
import path from 'path';

interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    text: string;
    textMuted: string;
    background: string;
    semantic: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  spacing: {
    base: number;
    margins: Record<string, string>;
    padding: Record<string, string>;
    borderRadius: Record<string, string>;
  };
}

interface TypographyConfig {
  fonts: {
    display: string;
    body: string;
    monospace: string;
  };
  scale: Record<string, {
    size: number;
    weight: number;
    letterSpacing: number;
  }>;
  lineHeight: Record<string, number>;
}

export class ThemeManagerService {
  private static instance: ThemeManagerService;
  private themeConfig: ThemeConfig | null = null;
  private typographyConfig: TypographyConfig | null = null;

  private constructor() {}

  public static getInstance(): ThemeManagerService {
    if (!ThemeManagerService.instance) {
      ThemeManagerService.instance = new ThemeManagerService();
    }
    return ThemeManagerService.instance;
  }

  public async initialize(registryPath: string): Promise<void> {
    try {
      const themePath = path.join(registryPath, 'branding', 'theme.json');
      const typographyPath = path.join(registryPath, 'branding', 'typography.json');
      
      const themeRaw = await fs.promises.readFile(themePath, 'utf-8');
      const typographyRaw = await fs.promises.readFile(typographyPath, 'utf-8');
      
      this.themeConfig = JSON.parse(themeRaw);
      this.typographyConfig = JSON.parse(typographyRaw);
    } catch (error) {
      console.error('Failed to initialize ThemeManagerService', error);
      // Construct safe defaults if files are missing
      this.constructDefaults();
    }
  }

  private constructDefaults() {
    this.themeConfig = {
      colors: {
        primary: '#000000',
        secondary: '#EEEEEE',
        text: '#333333',
        textMuted: '#666666',
        background: '#FFFFFF',
        semantic: {
          success: '#00FF00',
          warning: '#FFFF00',
          error: '#FF0000',
          info: '#0000FF'
        }
      },
      spacing: {
        base: 16,
        margins: { small: '8px', medium: '16px', large: '32px', xl: '64px' },
        padding: { small: '8px', medium: '16px', large: '32px', card: '24px' },
        borderRadius: { small: '4px', medium: '8px', large: '12px' }
      }
    };
    this.typographyConfig = {
      fonts: { display: 'Arial', body: 'Arial', monospace: 'monospace' },
      scale: {
        h1: { size: 32, weight: 700, letterSpacing: 0 },
        h2: { size: 24, weight: 600, letterSpacing: 0 },
        h3: { size: 20, weight: 600, letterSpacing: 0 },
        h4: { size: 16, weight: 600, letterSpacing: 0 },
        body: { size: 12, weight: 400, letterSpacing: 0 }
      },
      lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 }
    };
  }

  public getThemeConfig(): ThemeConfig {
    if (!this.themeConfig) throw new Error("ThemeManager not initialized");
    return this.themeConfig;
  }

  public getTypographyConfig(): TypographyConfig {
    if (!this.typographyConfig) throw new Error("ThemeManager not initialized");
    return this.typographyConfig;
  }

  /**
   * Translates a CSS variable (e.g. var(--color-primary)) to its actual value,
   * enabling robust HTML to API conversions.
   */
  public resolveCssVariable(variableName: string): string | number | undefined {
    if (!this.themeConfig || !this.typographyConfig) return undefined;

    const match = variableName.match(/(--[\w-]+)/);
    if (!match) return undefined;
    const name = match[1];

    switch(name) {
      case '--color-primary': return this.themeConfig.colors.primary;
      case '--color-secondary': return this.themeConfig.colors.secondary;
      case '--color-text': return this.themeConfig.colors.text;
      case '--color-textMuted': return this.themeConfig.colors.textMuted;
      case '--color-background': return this.themeConfig.colors.background;
      case '--semantic-success': return this.themeConfig.colors.semantic.success;
      case '--semantic-warning': return this.themeConfig.colors.semantic.warning;
      case '--semantic-error': return this.themeConfig.colors.semantic.error;
      case '--semantic-info': return this.themeConfig.colors.semantic.info;
      
      case '--font-display': return this.typographyConfig.fonts.display;
      case '--font-body': return this.typographyConfig.fonts.body;
      case '--font-monospace': return this.typographyConfig.fonts.monospace;

      case '--scale-h1-size': return this.typographyConfig.scale.h1.size;
      case '--scale-h2-size': return this.typographyConfig.scale.h2.size;
      case '--scale-h3-size': return this.typographyConfig.scale.h3.size;
      case '--scale-h4-size': return this.typographyConfig.scale.h4.size;
      case '--scale-body-size': return this.typographyConfig.scale.body.size;
      case '--scale-small-size': return this.typographyConfig.scale.small?.size || 10;
      
      case '--line-height-tight': return this.typographyConfig.lineHeight.tight;
      case '--line-height-normal': return this.typographyConfig.lineHeight.normal;
      case '--line-height-relaxed': return this.typographyConfig.lineHeight.relaxed;

      case '--spacing-margins-small': return this.themeConfig.spacing.margins.small;
      case '--spacing-margins-medium': return this.themeConfig.spacing.margins.medium;
      case '--spacing-margins-large': return this.themeConfig.spacing.margins.large;
      case '--spacing-margins-xl': return this.themeConfig.spacing.margins.xl;

      case '--spacing-padding-small': return this.themeConfig.spacing.padding.small;
      case '--spacing-padding-medium': return this.themeConfig.spacing.padding.medium;
      case '--spacing-padding-large': return this.themeConfig.spacing.padding.large;

      default: return undefined;
    }
  }

  /**
   * Utility to convert hex to google's RGB normalized float structure
   */
  public hexToGoogleRgb(hex: string) {
    let rawHex = hex.replace('#', '');
    if (rawHex.length === 3) {
      rawHex = rawHex[0] + rawHex[0] + rawHex[1] + rawHex[1] + rawHex[2] + rawHex[2];
    }
    const color = parseInt(rawHex, 16);
    return {
      red: ((color >> 16) & 255) / 255.0,
      green: ((color >> 8) & 255) / 255.0,
      blue: (color & 255) / 255.0
    };
  }
}
