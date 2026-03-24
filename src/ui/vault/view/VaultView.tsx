import { FC, useEffect, useState } from 'react';
import { Box, Typography, Button, useTheme as useMuiTheme } from '@mui/material';
import { useLanguage } from 'astra';
import { spacing } from '@astra/theme/tokens/spacing';
import { VaultFile } from '../repo/VaultRepo';

interface VaultViewProps {
  files: VaultFile[] | null;
  onUpload: () => void;
  onApproveAndPublish: () => void;
  isIngesting: boolean;
  isPublishing: boolean;
  lastIngestedCount: number;
  publishMessage: string;
}

const parserChars = ['/', '-', '\\', '|'];

export const VaultView: FC<VaultViewProps> = ({
  files,
  onUpload,
  onApproveAndPublish,
  isIngesting,
  isPublishing,
  lastIngestedCount,
  publishMessage,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();
  const [parserIndex, setParserIndex] = useState(0);

  useEffect(() => {
    if (!isIngesting) return;
    const timer = setInterval(() => {
      setParserIndex((prev) => (prev + 1) % parserChars.length);
    }, 500);
    return () => clearInterval(timer);
  }, [isIngesting]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CLEAN': return muiTheme.palette.success.main;
      case 'QUARANTINE': return muiTheme.palette.error.main;
      case 'SCANNING': return muiTheme.palette.warning.main;
      default: return muiTheme.palette.text.secondary;
    }
  };

  return (
    <Box sx={{ p: spacing.xl, maxWidth: '1000px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: spacing.xl }}>
        <Typography variant="h3" sx={{ color: muiTheme.palette.text.primary, flexGrow: 1 }}>
          {literal['nav.vault']}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          sx={{ mr: spacing.sm }}
          onClick={onApproveAndPublish}
          disabled={isIngesting || isPublishing}
        >
          {isPublishing ? 'Publishing...' : 'Approve & Publish'}
        </Button>
        <Button variant="contained" size="small" onClick={onUpload} disabled={isIngesting}>
          {isIngesting ? (literal['vault.uploading'] || 'Uploading...') : (literal['vault.upload'] || 'Upload Document')}
        </Button>
      </Box>

      {(isIngesting || lastIngestedCount > 0 || publishMessage.length > 0) && (
        <Box sx={{ mb: spacing.md }}>
          <Typography variant="monoCaption" sx={{ color: muiTheme.palette.text.secondary }}>
            {isIngesting
              ? `${parserChars[parserIndex]} Validating staged files...`
              : publishMessage.length > 0
                ? publishMessage
                : `[OK] Ingest complete: ${lastIngestedCount} file(s)`}
          </Typography>
        </Box>
      )}

      {/* Clinical Dropzone */}
      <Box sx={{ 
        border: `2px dashed ${muiTheme.palette.divider}`,
        borderRadius: spacing.xs,
        p: spacing.xxl,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: muiTheme.palette.background.paper,
        mb: spacing.xl,
        cursor: 'pointer',
        '&:hover': {
          borderColor: muiTheme.palette.primary.main,
          backgroundColor: muiTheme.palette.action.hover
        }
      }} onClick={onUpload}>
        <Typography variant="body1" sx={{ color: muiTheme.palette.text.primary, mb: spacing.xs }}>
          {literal['vault.dragDrop']}
        </Typography>
        <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
          {literal['vault.description']}
        </Typography>
      </Box>

      {/* Vault Contents List */}
      <Typography variant="h6" sx={{ color: muiTheme.palette.text.primary, mb: spacing.md }}>
        {literal['vault.asset']}
      </Typography>
      
      <Box sx={{ 
        border: `1px solid ${muiTheme.palette.divider}`, 
        borderRadius: spacing.xs, 
        backgroundColor: muiTheme.palette.background.paper,
        overflow: 'hidden'
      }}>
        {files?.map((file, index) => (
          <Box 
            key={file.id} 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              p: spacing.md,
              borderBottom: index === files.length - 1 ? 'none' : `1px solid ${muiTheme.palette.divider}`,
              '&:hover': { backgroundColor: muiTheme.palette.action.hover }
            }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2Medium" sx={{ color: muiTheme.palette.text.primary, mb: 0.5 }}>
                {file.filename}
              </Typography>
              <Box sx={{ display: 'flex', gap: spacing.md }}>
                <Typography variant="monoCaption" sx={{ color: muiTheme.palette.text.secondary }}>
                  {file.size}
                </Typography>
                <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
                  •
                </Typography>
                <Typography variant="monoCaption" sx={{ color: muiTheme.palette.text.secondary }}>
                  {file.classification}
                </Typography>
              </Box>
            </Box>
            
            {/* SchemaGuardian Check (Status) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Box sx={{ 
                  width: spacing.xs,
                  height: spacing.xs,
                borderRadius: '50%', 
                backgroundColor: getStatusColor(file.scanStatus) 
              }} />
              <Typography variant="caption" sx={{ color: muiTheme.palette.text.primary }}>
                {file.scanStatus}
              </Typography>
            </Box>

            {file.validationErrors && file.validationErrors.length > 0 && (
              <Box sx={{ mt: spacing.xs, width: '100%' }}>
                {file.validationErrors.map((error) => (
                  <Typography key={`${file.id}-${error}`} variant="monoCaption" sx={{ color: muiTheme.palette.error.main }}>
                    {`[X] ${error}`}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        ))}
        {(!files || files.length === 0) && (
          <Box sx={{ p: spacing.xl, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: muiTheme.palette.text.secondary }}>
              {literal['vault.empty'] || 'The vault is currently empty.'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
