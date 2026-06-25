import { IpcService, ServerResponse } from 'astra';
import { MarkdownLoadInput, MarkdownRawContent } from '../model/markdownViewer.types';

const ipc = new IpcService();

export const markdownViewerRepository = {
  load(input: MarkdownLoadInput): Promise<ServerResponse<MarkdownRawContent>> {
    return ipc.invoke('markdownViewer:load', input);
  }
};
