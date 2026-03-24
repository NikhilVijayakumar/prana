import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Stack,
} from '@mui/material';
import { useLanguage } from 'astra';

export interface ReviewActionModalProps {
  isOpen: boolean;
  title?: string;
  entityType: string; // e.g., 'Schedule Proposal', 'Lifecycle Draft'
  entityName?: string;
  entitySummary?: string; // Optional JSON or detailed summary
  onApprove: (reviewNote?: string) => void;
  onReject: (reviewNote: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * ReviewActionModal
 *
 * Centralized modal for governance review actions (approve/reject/override).
 * - Approve: Optional reviewer note allowed
 * - Reject: Mandatory reviewer note (min 4 chars) to enforce feedback for improvement
 *
 * @see docs/module/management-suite.md#reviewactionmodal-component
 */
export const ReviewActionModal: React.FC<ReviewActionModalProps> = ({
  isOpen,
  title,
  entityType,
  entityName,
  entitySummary,
  onApprove,
  onReject,
  onCancel,
  isLoading = false,
}) => {
  const { literal } = useLanguage();
  const [approveNote, setApproveNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [actionMode, setActionMode] = useState<'idle' | 'approve' | 'reject'>('idle');

  // Reset state when modal closes
  const handleClose = () => {
    setApproveNote('');
    setRejectNote('');
    setActionMode('idle');
    onCancel();
  };

  const handleApproveClick = () => {
    // Approve allows empty note
    onApprove(approveNote);
    handleClose();
  };

  const handleRejectClick = () => {
    // Reject requires note (UI enforces minLength >= 4)
    if (rejectNote.trim().length >= 4) {
      onReject(rejectNote);
      handleClose();
    }
  };

  const isRejectNoteFilled = rejectNote.trim().length >= 4;
  const isRejectMode = actionMode === 'reject';
  const isApproveMode = actionMode === 'approve';

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="review-action-dialog"
    >
      <DialogTitle id="review-action-dialog">
        {title || literal['settings.review.modal.title'] || 'Review Governance Action'}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 2 }}>
          {/* Entity Summary */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {entityType}
            </Typography>
            {entityName && (
              <Typography variant="body2" color="textSecondary">
                <strong>Name:</strong> {entityName}
              </Typography>
            )}
            {entitySummary && (
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  maxHeight: 200,
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                }}
              >
                <Typography variant="body2" component="pre" sx={{ m: 0 }}>
                  {entitySummary}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Action Selection or Note Input */}
          {actionMode === 'idle' && (
            <Typography variant="body2" color="textSecondary">
              {literal['settings.review.modal.selectAction'] || 'Choose an action below.'}
            </Typography>
          )}

          {isApproveMode && (
            <TextField
              label={literal['settings.review.modal.approveNote'] || 'Approval Note (Optional)'}
              placeholder={literal['settings.review.modal.approveNotePlaceholder'] || 'Record optional feedback...'}
              multiline
              rows={3}
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              fullWidth
              disabled={isLoading}
              variant="outlined"
              size="small"
            />
          )}

          {isRejectMode && (
            <Box>
              <TextField
                label={literal['settings.review.modal.rejectNote'] || 'Rejection Reason (Required)'}
                placeholder={literal['settings.review.modal.rejectNotePlaceholder'] || 'Explain why this is rejected so the system can improve...'}
                multiline
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                fullWidth
                disabled={isLoading}
                variant="outlined"
                size="small"
                error={isRejectMode && rejectNote.trim().length > 0 && rejectNote.trim().length < 4}
                helperText={
                  isRejectMode && rejectNote.trim().length > 0 && rejectNote.trim().length < 4
                    ? literal['settings.review.modal.noteMinLength'] || 'Minimum 4 characters required'
                    : literal['settings.review.modal.noteRequired'] || 'Required: provide feedback for improvement'
                }
              />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {/* First-level action selection */}
        {actionMode === 'idle' && (
          <>
            <Button onClick={handleClose} disabled={isLoading}>
              {literal['common.cancel'] || 'Cancel'}
            </Button>
            <Button
              onClick={() => setActionMode('approve')}
              variant="contained"
              color="success"
              disabled={isLoading}
            >
              {literal['settings.review.modal.approveLabel'] || 'Approve'}
            </Button>
            <Button
              onClick={() => setActionMode('reject')}
              variant="contained"
              color="error"
              disabled={isLoading}
            >
              {literal['settings.review.modal.rejectLabel'] || 'Reject'}
            </Button>
          </>
        )}

        {/* Approve confirmation */}
        {isApproveMode && (
          <>
            <Button onClick={() => setActionMode('idle')} disabled={isLoading}>
              {literal['common.back'] || 'Back'}
            </Button>
            <Button
              onClick={handleApproveClick}
              variant="contained"
              color="success"
              disabled={isLoading}
            >
              {literal['settings.review.modal.confirmApprove'] || 'Confirm Approve'}
            </Button>
          </>
        )}

        {/* Reject confirmation */}
        {isRejectMode && (
          <>
            <Button onClick={() => setActionMode('idle')} disabled={isLoading}>
              {literal['common.back'] || 'Back'}
            </Button>
            <Button
              onClick={handleRejectClick}
              variant="contained"
              color="error"
              disabled={isLoading || !isRejectNoteFilled}
            >
              {literal['settings.review.modal.confirmReject'] || 'Confirm Reject'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ReviewActionModal;
