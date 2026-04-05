import { FC, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { spacing } from 'astra';
import { CronEditorErrors, CronEditorState } from '../viewmodel/useCronManagementViewModel';
import { CronJobRecord, CronProposalRecord, CronTelemetry } from '../repo/CronManagementRepo';

interface CronManagementViewProps {
  jobs: CronJobRecord[];
  telemetry: CronTelemetry | null;
  proposals: CronProposalRecord[];
  proposalStatusFilter: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' | 'ALL';
  onProposalStatusFilterChange: (value: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' | 'ALL') => void;
  isLoading: boolean;
  isSaving: boolean;
  editorOpen: boolean;
  editorState: CronEditorState;
  editorErrors: CronEditorErrors;
  editorMessage: string | null;
  setEditorState: (value: CronEditorState) => void;
  proposalJobId: string;
  setProposalJobId: (value: string) => void;
  onOpenCreateEditor: () => void;
  onOpenEditEditor: (job: CronJobRecord) => void;
  onCloseEditor: () => void;
  onSaveEditor: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRunNow: (id: string) => void;
  onRemove: (id: string) => void;
  onReload: () => void;
  onSubmitProposal: (jobId: string) => void;
  onReviewProposal: (proposalId: string, status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN') => void;
}

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
};

const StatusChip: FC<{ enabled: boolean }> = ({ enabled }) => (
  <Chip
    label={enabled ? 'Active' : 'Paused'}
    color={enabled ? 'success' : 'default'}
    size="small"
    variant={enabled ? 'filled' : 'outlined'}
  />
);

const LastRunStatusChip: FC<{ status: CronJobRecord['lastRunStatus'] }> = ({ status }) => {
  if (!status) {
    return <Chip label="No Runs" size="small" variant="outlined" />;
  }

  if (status === 'SUCCESS') {
    return <Chip label="Success" size="small" color="success" variant="outlined" />;
  }

  if (status === 'FAILED') {
    return <Chip label="Failed" size="small" color="error" variant="outlined" />;
  }

  return <Chip label="Skipped" size="small" color="warning" variant="outlined" />;
};

export const CronManagementView: FC<CronManagementViewProps> = ({
  jobs,
  telemetry,
  proposals,
  proposalStatusFilter,
  onProposalStatusFilterChange,
  isLoading,
  isSaving,
  editorOpen,
  editorState,
  editorErrors,
  editorMessage,
  setEditorState,
  proposalJobId,
  setProposalJobId,
  onOpenCreateEditor,
  onOpenEditEditor,
  onCloseEditor,
  onSaveEditor,
  onPause,
  onResume,
  onRunNow,
  onRemove,
  onReload,
  onSubmitProposal,
  onReviewProposal,
}) => {
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [jobRecoveryFilter, setJobRecoveryFilter] = useState<'ALL' | 'SKIP' | 'RUN_ONCE' | 'CATCH_UP'>('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredJobs = useMemo(() => {
    const term = jobSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      if (jobStatusFilter === 'ACTIVE' && !job.enabled) {
        return false;
      }
      if (jobStatusFilter === 'PAUSED' && job.enabled) {
        return false;
      }
      if (jobRecoveryFilter !== 'ALL' && job.recoveryPolicy !== jobRecoveryFilter) {
        return false;
      }
      if (!term) {
        return true;
      }

      return (
        job.name.toLowerCase().includes(term) ||
        job.id.toLowerCase().includes(term) ||
        job.target.toLowerCase().includes(term) ||
        job.expression.toLowerCase().includes(term)
      );
    });
  }, [jobs, jobSearch, jobStatusFilter, jobRecoveryFilter]);

  useEffect(() => {
    setPage(0);
  }, [jobSearch, jobStatusFilter, jobRecoveryFilter]);

  const visibleJobs = filteredJobs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ mt: spacing.xl }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: spacing.md, gap: spacing.md, flexWrap: 'wrap' }}>
        <Typography variant="h5">Cron Management</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onReload} disabled={isLoading}>Refresh</Button>
          <Button variant="contained" onClick={onOpenCreateEditor}>New Job</Button>
        </Stack>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: spacing.md }}>
        <Chip label={`Total ${telemetry?.totalJobs ?? 0}`} />
        <Chip label={`Enabled ${telemetry?.enabledJobs ?? 0}`} color="success" variant="outlined" />
        <Chip label={`Running ${telemetry?.runningJobs ?? 0}`} color="info" variant="outlined" />
        <Chip label={`Failed ${telemetry?.failedRuns ?? 0}`} color="error" variant="outlined" />
        <Chip label={`Recovery Missed ${telemetry?.recovery.missedJobsDetected ?? 0}`} color="warning" variant="outlined" />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: spacing.md }}>
        <TextField
          size="small"
          label="Search jobs"
          value={jobSearch}
          onChange={(event) => setJobSearch(event.target.value)}
          sx={{ minWidth: 240 }}
          placeholder="name, id, target, expression"
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="cron-job-status-filter-label">Status</InputLabel>
          <Select
            labelId="cron-job-status-filter-label"
            label="Status"
            value={jobStatusFilter}
            onChange={(event) => setJobStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'PAUSED')}
          >
            <MenuItem value="ALL">ALL</MenuItem>
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="PAUSED">PAUSED</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="cron-job-recovery-filter-label">Recovery</InputLabel>
          <Select
            labelId="cron-job-recovery-filter-label"
            label="Recovery"
            value={jobRecoveryFilter}
            onChange={(event) =>
              setJobRecoveryFilter(event.target.value as 'ALL' | 'SKIP' | 'RUN_ONCE' | 'CATCH_UP')
            }
          >
            <MenuItem value="ALL">ALL</MenuItem>
            <MenuItem value="SKIP">SKIP</MenuItem>
            <MenuItem value="RUN_ONCE">RUN_ONCE</MenuItem>
            <MenuItem value="CATCH_UP">CATCH_UP</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="text"
          onClick={() => {
            setJobSearch('');
            setJobStatusFilter('ALL');
            setJobRecoveryFilter('ALL');
          }}
        >
          Clear Filters
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expression</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Recovery</TableCell>
              <TableCell>Last Status</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleJobs.map((job) => (
              <TableRow key={job.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{job.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{job.id}</Typography>
                </TableCell>
                <TableCell><StatusChip enabled={job.enabled} /></TableCell>
                <TableCell>{job.expression}</TableCell>
                <TableCell>{job.target}</TableCell>
                <TableCell>{job.recoveryPolicy}</TableCell>
                <TableCell><LastRunStatusChip status={job.lastRunStatus} /></TableCell>
                <TableCell>{formatDateTime(job.lastRunAt)}</TableCell>
                <TableCell>{formatDateTime(job.nextRunAt)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                    <Button size="small" onClick={() => onOpenEditEditor(job)}>Edit</Button>
                    <Button size="small" onClick={() => onRunNow(job.id)}>Run</Button>
                    {job.enabled ? (
                      <Button size="small" onClick={() => onPause(job.id)}>Pause</Button>
                    ) : (
                      <Button size="small" onClick={() => onResume(job.id)}>Resume</Button>
                    )}
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        if (window.confirm(`Delete cron job ${job.name}?`)) {
                          onRemove(job.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {visibleJobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary">No jobs match the current filters.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filteredJobs.length}
        page={page}
        onPageChange={(_event, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />

      <Box sx={{ mt: spacing.lg }}>
        <Typography variant="h6" sx={{ mb: spacing.sm }}>Governance Proposals</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: spacing.sm }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="cron-proposal-status-filter-label">Status Filter</InputLabel>
            <Select
              labelId="cron-proposal-status-filter-label"
              label="Status Filter"
              value={proposalStatusFilter}
              onChange={(event) => onProposalStatusFilterChange(event.target.value as 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' | 'ALL')}
            >
              <MenuItem value="ALL">ALL</MenuItem>
              <MenuItem value="PENDING">PENDING</MenuItem>
              <MenuItem value="APPROVED">APPROVED</MenuItem>
              <MenuItem value="REJECTED">REJECTED</MenuItem>
              <MenuItem value="OVERRIDDEN">OVERRIDDEN</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel id="cron-proposal-job-label">Select Job</InputLabel>
            <Select
              labelId="cron-proposal-job-label"
              label="Select Job"
              value={proposalJobId}
              onChange={(event) => setProposalJobId(event.target.value)}
            >
              {jobs.map((job) => (
                <MenuItem key={job.id} value={job.id}>{job.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" disabled={!proposalJobId} onClick={() => onSubmitProposal(proposalJobId)}>
            Submit Proposal
          </Button>
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Expression</TableCell>
                <TableCell>Reviewed By</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.proposalId} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{proposal.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{proposal.jobId}</Typography>
                  </TableCell>
                  <TableCell>{proposal.status}</TableCell>
                  <TableCell>{proposal.expression}</TableCell>
                  <TableCell>{proposal.reviewer ?? '-'}</TableCell>
                  <TableCell>{formatDateTime(proposal.updatedAt)}</TableCell>
                  <TableCell>
                    {proposal.status === 'PENDING' ? (
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" color="success" onClick={() => onReviewProposal(proposal.proposalId, 'APPROVED')}>Approve</Button>
                        <Button size="small" color="warning" onClick={() => onReviewProposal(proposal.proposalId, 'REJECTED')}>Reject</Button>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">No actions</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {proposals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">No proposals found.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={editorOpen} onClose={onCloseEditor} maxWidth="sm" fullWidth>
        <DialogTitle>Cron Job Editor</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editorMessage && <Alert severity="warning">{editorMessage}</Alert>}
            <TextField
              label="Job ID"
              value={editorState.id}
              onChange={(event) => setEditorState({ ...editorState, id: event.target.value })}
              error={Boolean(editorErrors.id)}
              helperText={editorErrors.id}
              fullWidth
            />
            <TextField
              label="Name"
              value={editorState.name}
              onChange={(event) => setEditorState({ ...editorState, name: event.target.value })}
              error={Boolean(editorErrors.name)}
              helperText={editorErrors.name}
              fullWidth
            />
            <TextField
              label="Cron Expression"
              value={editorState.expression}
              onChange={(event) => setEditorState({ ...editorState, expression: event.target.value })}
              error={Boolean(editorErrors.expression)}
              helperText={editorErrors.expression ?? 'Full cron syntax is supported by backend parser.'}
              fullWidth
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                label="Every 15 min"
                variant="outlined"
                onClick={() => setEditorState({ ...editorState, expression: '*/15 * * * *' })}
              />
              <Chip
                label="Daily 08:00"
                variant="outlined"
                onClick={() => setEditorState({ ...editorState, expression: '0 8 * * *' })}
              />
              <Chip
                label="Weekdays 09:00"
                variant="outlined"
                onClick={() => setEditorState({ ...editorState, expression: '0 9 * * 1-5' })}
              />
            </Stack>
            <TextField
              label="Target Executor"
              value={editorState.target}
              onChange={(event) => setEditorState({ ...editorState, target: event.target.value })}
              error={Boolean(editorErrors.target)}
              helperText={editorErrors.target ?? 'Use a registered executor target key (falls back to job id if omitted).'}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="cron-recovery-policy-label">Recovery Policy</InputLabel>
              <Select
                labelId="cron-recovery-policy-label"
                label="Recovery Policy"
                value={editorState.recoveryPolicy}
                onChange={(event) =>
                  setEditorState({
                    ...editorState,
                    recoveryPolicy: event.target.value as 'SKIP' | 'RUN_ONCE' | 'CATCH_UP',
                  })
                }
              >
                <MenuItem value="SKIP">SKIP</MenuItem>
                <MenuItem value="RUN_ONCE">RUN_ONCE</MenuItem>
                <MenuItem value="CATCH_UP">CATCH_UP</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Retention Days"
                type="number"
                value={editorState.retentionDays}
                onChange={(event) =>
                  setEditorState({ ...editorState, retentionDays: Number(event.target.value || 30) })
                }
                error={Boolean(editorErrors.retentionDays)}
                helperText={editorErrors.retentionDays}
                fullWidth
              />
              <TextField
                label="Max Runtime (ms)"
                type="number"
                value={editorState.maxRuntimeMs}
                onChange={(event) =>
                  setEditorState({ ...editorState, maxRuntimeMs: Number(event.target.value || 5000) })
                }
                error={Boolean(editorErrors.maxRuntimeMs)}
                helperText={editorErrors.maxRuntimeMs}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={editorState.enabled}
                onChange={(event) => setEditorState({ ...editorState, enabled: event.target.checked })}
              />
              <Typography variant="body2">Enabled</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseEditor}>Cancel</Button>
          <Button variant="contained" onClick={onSaveEditor} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
