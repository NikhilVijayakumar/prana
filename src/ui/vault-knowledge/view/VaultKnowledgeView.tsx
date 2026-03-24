import { FC } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  useTheme as useMuiTheme,
} from '@mui/material';
import { spacing } from '@astra/theme/tokens/spacing';
import { FileViewerRouter } from '@astra/components/file-viewers/FileViewerRouter';
import {
  VaultFileContent,
  VaultPayload,
  VaultNode,
  MemorySearchPayload,
  MemoryHealthPayload,
} from '../repo/VaultKnowledgeRepo';

interface VaultKnowledgeProps {
  payload: VaultPayload | null;
  preview: VaultFileContent | null;
  isLoading: boolean;
  isPreviewLoading: boolean;
  memoryResults: MemorySearchPayload | null;
  memoryHealth: MemoryHealthPayload | null;
  isMemorySearching: boolean;
  memoryQuery: string;
  selectedPath: string | null;
  isApplyingAction: boolean;
  isReindexingMemory: boolean;
  onRefresh: () => void;
  onPreviewFile: (relativePath: string) => void;
  onApprovePending: (relativePath: string) => void;
  onRejectPending: (relativePath: string) => void;
  onSearchMemory: (query: string) => void;
  onMemoryQueryChange: (query: string) => void;
  onReindexMemory: () => void;
}

export const VaultKnowledgeView: FC<VaultKnowledgeProps> = ({
  payload,
  preview,
  isLoading,
  isPreviewLoading,
  memoryResults,
  memoryHealth,
  isMemorySearching,
  memoryQuery,
  selectedPath,
  isApplyingAction,
  isReindexingMemory,
  onRefresh,
  onPreviewFile,
  onApprovePending,
  onRejectPending,
  onSearchMemory,
  onMemoryQueryChange,
  onReindexMemory,
}) => {
  const muiTheme = useMuiTheme();

  const renderTree = (nodes: VaultNode[], padding = 0) => {
    return nodes.map(node => (
      <Box key={node.id}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: spacing.sm, 
          pl: `${padding + spacing.md * 8}px`,
          '&:hover': { backgroundColor: muiTheme.palette.action.hover },
          cursor: 'pointer',
          backgroundColor: selectedPath === node.relativePath ? muiTheme.palette.action.selected : 'transparent',
        }}>
          <Typography
            variant={node.type === 'directory' ? 'body2Bold' : 'body2'}
            sx={{ color: muiTheme.palette.text.primary, flexGrow: 1 }}
            onClick={() => node.type === 'file' && onPreviewFile(node.relativePath)}
          >
            {node.type === 'directory' ? '📁 ' : '📄 '}{node.name}
          </Typography>
          {node.size && (
            <Typography variant="monoBody" sx={{ color: muiTheme.palette.text.secondary }}>
              {node.size}
            </Typography>
          )}
        </Box>
        {node.children && renderTree(node.children, padding + spacing.md * 8)}
      </Box>
    ));
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', animation: 'fadeIn 0.4s ease-out' }}>
      {/* File Explorer Sidebar */}
      <Box sx={{ 
        width: 300, 
        borderRight: `1px solid ${muiTheme.palette.divider}`, 
        backgroundColor: muiTheme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ p: spacing.lg, borderBottom: `1px solid ${muiTheme.palette.divider}` }}>
           <Typography variant="h6" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
             Vault Explorer
           </Typography>
           {payload && (
             <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
               <Box sx={{ 
                   width: spacing.xs,
                   height: spacing.xs,
                 borderRadius: '50%', 
                 backgroundColor: payload.status === 'LOCKED' ? muiTheme.palette.error.main : muiTheme.palette.success.main 
               }} />
               <Typography variant="micro" sx={{ color: muiTheme.palette.text.secondary }}>
                 {payload.status} • Last Sync: {new Date(payload.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </Typography>
             </Box>
           )}
        </Box>
        
        <Box sx={{ flexGrow: 1, overflowY: 'auto', py: spacing.md }}>
          {isLoading && !payload ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: spacing.xl }}>
              <CircularProgress size={24} />
            </Box>
          ) : payload ? (
            renderTree(payload.directoryTree)
          ) : null}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, p: spacing.xl, overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: spacing.xl }}>
          <Box>
             <Typography variant="h3" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
               Agent Temp Staging
             </Typography>
             <Typography variant="body1" sx={{ color: muiTheme.palette.text.secondary }}>
               Review and approve pending agent outputs before committing to the Vault.
             </Typography>
          </Box>
          <Button variant="outlined" size="small" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? 'Scanning...' : 'Scan Temp'}
          </Button>
        </Box>

        <Box
          sx={{
            mb: spacing.xl,
            p: spacing.md,
            border: `1px solid ${muiTheme.palette.divider}`,
            borderRadius: spacing.xs,
            backgroundColor: muiTheme.palette.background.paper,
          }}
        >
          <Box sx={{ display: 'flex', gap: spacing.sm, alignItems: 'center', mb: spacing.sm }}>
            <TextField
              value={memoryQuery}
              onChange={(event) => onMemoryQueryChange(event.target.value)}
              size="small"
              fullWidth
              placeholder="Search memory across vault and agent-temp"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSearchMemory(memoryQuery);
                }
              }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={isMemorySearching || !memoryQuery.trim()}
              onClick={() => onSearchMemory(memoryQuery)}
            >
              Search
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={isReindexingMemory}
              onClick={onReindexMemory}
            >
              {isReindexingMemory ? 'Reindexing...' : 'Reindex'}
            </Button>
          </Box>

          {memoryHealth && (
            <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
              Index: {memoryHealth.status.toUpperCase()} | Docs {memoryHealth.stats.documentCount} | Chunks {memoryHealth.stats.chunkCount} | Avg tokens {memoryHealth.stats.averageChunkTokens}
            </Typography>
          )}

          {!!memoryResults && (
            <Box sx={{ mt: spacing.sm, maxHeight: 220, overflowY: 'auto' }}>
              {memoryResults.results.length === 0 ? (
                <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
                  No memory matches found.
                </Typography>
              ) : (
                memoryResults.results.map((hit) => (
                  <Box
                    key={hit.chunkId}
                    sx={{
                      py: spacing.xs,
                      borderTop: `1px solid ${muiTheme.palette.divider}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => onPreviewFile(hit.relativePath)}
                  >
                    <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
                      {hit.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
                      {hit.relativePath} | {hit.classification} | score {hit.score.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary, display: 'block' }}>
                      {hit.excerpt}
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          )}
        </Box>

        {payload && (
          <Box sx={{ 
            backgroundColor: muiTheme.palette.background.paper, 
            border: `1px solid ${muiTheme.palette.divider}`,
            borderRadius: spacing.xs,
            overflow: 'hidden'
          }}>
            {payload.pendingFiles.length === 0 ? (
              <Box sx={{ p: spacing.xl, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: muiTheme.palette.text.secondary }}>No pending files.</Typography>
              </Box>
            ) : (
              payload.pendingFiles.map((file, idx) => (
                 <Box key={file.id} sx={{ 
                   display: 'flex', 
                   alignItems: 'center', 
                   p: spacing.md,
                   borderTop: idx > 0 ? `1px solid ${muiTheme.palette.divider}` : 'none'
                 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography
                        variant="body2Bold"
                        sx={{ color: muiTheme.palette.text.primary, cursor: 'pointer' }}
                        onClick={() => onPreviewFile(file.relativePath)}
                      >
                        {file.filename}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: spacing.md, mt: spacing.internal }}>
                        <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>Agent: {file.agent}</Typography>
                        <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>Size: {file.size}</Typography>
                        <Typography variant="captionBold" sx={{ color: muiTheme.palette.warning.main }}>{file.classification}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: spacing.sm }}>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ borderColor: muiTheme.palette.error.main, color: muiTheme.palette.error.main }}
                        disabled={isApplyingAction}
                        onClick={() => onRejectPending(file.relativePath)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{ backgroundColor: muiTheme.palette.primary.main, color: muiTheme.palette.common.black }}
                        disabled={isApplyingAction}
                        onClick={() => onApprovePending(file.relativePath)}
                      >
                        Approve & Commit
                      </Button>
                    </Box>
                 </Box>
              ))
            )}
          </Box>
        )}

        <Box sx={{ mt: spacing.xl }}>
          <Typography variant="h6" sx={{ color: muiTheme.palette.text.primary, mb: spacing.md }}>
            File Preview
          </Typography>
          <Box
            sx={{
              height: '420px',
              border: `1px solid ${muiTheme.palette.divider}`,
              borderRadius: spacing.xs,
              backgroundColor: muiTheme.palette.background.paper,
              overflow: 'hidden',
            }}
          >
            {isPreviewLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={24} />
              </Box>
            ) : preview ? (
              <FileViewerRouter
                fileName={preview.fileName}
                fileContent={preview.content}
                fileEncoding={preview.encoding}
                mimeType={preview.mimeType}
              />
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
                  Select a file from explorer or agent-temp panel to preview.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
