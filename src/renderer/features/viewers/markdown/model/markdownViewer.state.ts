import { MarkdownPipelineStage } from './markdownViewer.types';

export interface MarkdownViewerState {
  rawContent: string;
  renderedHtml: string;
  path: string;
  pipelineStage: MarkdownPipelineStage;
  sanitizerRejections: number;
}
