import { ThemeManagerService } from './ThemeManagerService';

export interface RenderOptions {
  documentId?: string; // If updating an existing doc
  presentationId?: string; // If updating an existing slide deck
  title?: string; // For new ones
}

export class WorkspaceRendererService {
  private themeManager: ThemeManagerService;
  
  constructor() {
    this.themeManager = ThemeManagerService.getInstance();
  }

  /**
   * HTML to Google Docs BatchUpdate conversion
   * Note: This is an architectural stub mapping logic as requested.
   * Full implementation would parse HTML string and emit specific InsertTextRequests 
   * and UpdateTextStyleRequests.
   */
  public generateDocsRequests(htmlTemplate: string, injectedData: Record<string, string>): any[] {
    // 1. Template variable substitution
    let finalHtml = htmlTemplate;
    for (const [key, value] of Object.entries(injectedData)) {
      finalHtml = finalHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    // 2. Mocking HTML parsing for BatchUpdate requests
    const batchUpdates: any[] = [];
    let currentIndex = 1; // Google docs start at index 1

    // Simulation of parsing:
    // This engine would use standard regex or a tiny parser to find <h1>, <p>, etc.
    const h1Match = finalHtml.match(/<h1>(.*?)<\/h1>/);
    if (h1Match) {
      const text = h1Match[1] + '\n';
      const scale = this.themeManager.getTypographyConfig().scale.h1;
      const primaryColorHex = this.themeManager.getThemeConfig().colors.primary;
      const rgb = this.themeManager.hexToGoogleRgb(primaryColorHex);
      
      batchUpdates.push({
        insertText: {
          location: { index: currentIndex },
          text: text
        }
      });
      
      batchUpdates.push({
        updateTextStyle: {
          range: { startIndex: currentIndex, endIndex: currentIndex + text.length },
          textStyle: {
            fontSize: { magnitude: scale.size, unit: 'PT' },
            bold: scale.weight >= 600,
            foregroundColor: { color: { rgbColor: rgb } }
          },
          fields: 'fontSize,bold,foregroundColor'
        }
      });
      currentIndex += text.length;
    }
    
    // Add logic for <p>, <ul>, etc...
    // Space spacing constants would map to updateParagraphStyle spaceAbove/spaceBelow.
    
    return batchUpdates;
  }

  /**
   * HTML to Google Slides conversion
   */
  public generateSlidesRequests(htmlTemplate: string, injectedData: Record<string, string>): any[] {
    // 1. Variable injection
    let finalHtml = htmlTemplate;
    for (const [key, value] of Object.entries(injectedData)) {
      finalHtml = finalHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    const batchUpdates: any[] = [];
    // 2. Slides Object Injection logic
    // A `<section>` maps to a CreateSlideRequest
    
    const sections = finalHtml.split('<section').filter(Boolean); // extremely crude tokenizer for concept
    sections.forEach((sectionData, index) => {
      const slideId = `slide_${index}`;
      batchUpdates.push({
        createSlide: {
          objectId: slideId,
          slideLayoutReference: { predefinedLayout: 'BLANK' }
        }
      });

      // Find h1 for title injection
      const h1Match = sectionData.match(/<h1>(.*?)<\/h1>/);
      if (h1Match) {
        const titleText = h1Match[1];
        const textBoxId = `textbox_${index}_title`;
        batchUpdates.push({
          createShape: {
            objectId: textBoxId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: slideId,
              size: { width: { magnitude: 900, unit: 'PT' }, height: { magnitude: 100, unit: 'PT' } },
              transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
            }
          }
        });
        batchUpdates.push({
          insertText: {
            objectId: textBoxId,
            insertionIndex: 0,
            text: titleText
          }
        });
        // apply Typography tokens
        const h1Config = this.themeManager.getTypographyConfig().scale.h1;
        batchUpdates.push({
          updateTextStyle: {
            objectId: textBoxId,
            style: {
              fontSize: { magnitude: h1Config.size, unit: 'PT' },
              bold: h1Config.weight >= 600
            },
            fields: 'fontSize,bold'
          }
        });
      }
    });

    return batchUpdates;
  }
}
