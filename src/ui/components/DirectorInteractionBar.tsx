import { FC, useMemo, useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  useTheme as useMuiTheme,
} from '@mui/material';
import { useLanguage } from 'astra';
import {
  EMPLOYEE_DIRECTORY,
  EMPLOYEE_LIST,
  getEmployeeAvatarPath,
  type EmployeeDirectoryEntry,
} from '../constants/employeeDirectory';
import { getDirectorSenderEmail, getDirectorSenderName } from '../constants/appBranding';
import { spacing } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';

interface DirectorInteractionBarProps {
  moduleRoute: string;
  moduleNameKey: string;
  ownerId: string;
  secretaryId: string;
  onOpenProfile: (employeeId: string) => void;
}

interface LocalMessage {
  id: string;
  targetEmployeeId: string;
  text: string;
  responseText?: string;
  queueAccepted: boolean;
  queueReason: 'ok' | 'queue_full' | 'crisis_reserve' | 'unknown' | 'accepted' | 'blocked' | 'escalated' | 'rejected' | 'failed';
}

const EmployeeCard: FC<{
  title: string;
  employee: EmployeeDirectoryEntry;
  onOpenProfile: (employeeId: string) => void;
}> = ({ title, employee, onOpenProfile }) => {
  const muiTheme = useMuiTheme();

  return (
    <Box
      sx={{
        p: spacing.sm,
        borderRadius: '8px',
        border: `1px solid ${muiTheme.palette.divider}`,
        minWidth: '210px',
        backgroundColor: muiTheme.palette.background.paper,
      }}
    >
      <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary, display: 'block', mb: spacing.xs }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <Avatar
          src={getEmployeeAvatarPath(employee.id)}
          alt={employee.name}
          sx={{ width: 32, height: 32, cursor: 'pointer' }}
          onClick={() => onOpenProfile(employee.id)}
        >
          {employee.name.charAt(0)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2Bold"
            sx={{ color: muiTheme.palette.text.primary, cursor: 'pointer' }}
            onClick={() => onOpenProfile(employee.id)}
          >
            {employee.name}
          </Typography>
          <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
            {employee.role}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export const DirectorInteractionBar: FC<DirectorInteractionBarProps> = ({
  moduleRoute,
  moduleNameKey,
  ownerId,
  secretaryId,
  onOpenProfile,
}) => {
  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const [targetEmployeeId, setTargetEmployeeId] = useState<string>(secretaryId);
  const [messageText, setMessageText] = useState('');
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [channelMode, setChannelMode] = useState<'internal' | 'telegram'>('internal');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const directorSenderEmail = getDirectorSenderEmail();
  const directorSenderName = getDirectorSenderName();

  const owner = EMPLOYEE_DIRECTORY[ownerId] ?? EMPLOYEE_DIRECTORY.mira;
  const secretary = EMPLOYEE_DIRECTORY[secretaryId] ?? EMPLOYEE_DIRECTORY.mira;

  const mentionList = useMemo(() => EMPLOYEE_LIST, []);

  const sendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      let message: LocalMessage;

      if (channelMode === 'telegram') {
        const telegramResult = await safeIpcCall(
          'channels.routeTelegramMessage',
          () =>
            window.api.channels.routeTelegramMessage({
              message: trimmed,
              senderId: directorSenderEmail,
              senderName: directorSenderName,
              isDirector: true,
              explicitTargetPersonaId: targetEmployeeId,
              timestampIso: new Date().toISOString(),
              metadata: { moduleRoute },
            }),
          (value) => typeof value === 'object' && value !== null,
        );

        message = {
          id: (telegramResult as { workOrderId?: string }).workOrderId ?? `${Date.now()}`,
          targetEmployeeId,
          text: trimmed,
          responseText: (telegramResult as { message?: string }).message,
          queueAccepted: Boolean((telegramResult as { accepted?: boolean }).accepted),
          queueReason:
            ((telegramResult as { status?: LocalMessage['queueReason'] }).status as LocalMessage['queueReason']) ??
            'unknown',
        };
      } else {
        const result = await safeIpcCall(
          'workOrders.submitDirectorRequest',
          () =>
            window.api.workOrders.submitDirectorRequest({
              moduleRoute,
              targetEmployeeId,
              message: trimmed,
              timestampIso: new Date().toISOString(),
            }),
          (value) => typeof value === 'object' && value !== null,
        );

        message = {
          id: (result as { workOrder?: { id?: string } }).workOrder?.id ?? `${Date.now()}`,
          targetEmployeeId,
          text: trimmed,
          queueAccepted: Boolean((result as { queueAccepted?: boolean }).queueAccepted),
          queueReason:
            ((result as { queueReason?: LocalMessage['queueReason'] }).queueReason as LocalMessage['queueReason']) ??
            'unknown',
        };
      }

      setLocalMessages((prev) => [message, ...prev].slice(0, 4));
      setMessageText('');
    } catch {
      setSendError(literal['interaction.sendFailed']);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Box
      sx={{
        p: spacing.md,
        borderBottom: `1px solid ${muiTheme.palette.divider}`,
        backgroundColor: muiTheme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.sm,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: spacing.sm }}>
        <Box>
          <Typography variant="body2Bold" sx={{ color: muiTheme.palette.text.primary }}>
            {literal['interaction.title']}
          </Typography>
          <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
            {literal[moduleNameKey] ?? literal['interaction.module.workspace']}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <EmployeeCard
            title={literal['interaction.owner']}
            employee={owner}
            onOpenProfile={onOpenProfile}
          />
          <EmployeeCard
            title={literal['interaction.secretary']}
            employee={secretary}
            onOpenProfile={onOpenProfile}
          />
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: spacing.sm }}>
        <Box sx={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
            {literal['interaction.to']}
          </Typography>
          <TextField
            select
            size="small"
            value={targetEmployeeId}
            onChange={(event) => setTargetEmployeeId(event.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: '190px' }}
          >
            {mentionList.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {`${employee.triggerName} (${employee.name})`}
              </option>
            ))}
          </TextField>
        </Box>

        <TextField
          size="small"
          fullWidth
          value={messageText}
          placeholder={literal['interaction.placeholder']}
          onChange={(event) => setMessageText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
        />

        <Button variant="contained" onClick={sendMessage} disabled={isSending || messageText.trim().length === 0}>
          {isSending ? literal['interaction.sending'] : literal['interaction.send']}
        </Button>

        <Button
          variant={channelMode === 'telegram' ? 'contained' : 'outlined'}
          onClick={() => setChannelMode((prev) => (prev === 'internal' ? 'telegram' : 'internal'))}
        >
          {channelMode === 'telegram' ? literal['interaction.channelTelegram'] : literal['interaction.channelInternal']}
        </Button>

        <Button
          variant="outlined"
          onClick={() => setTargetEmployeeId(owner.id)}
        >
          {literal['interaction.askOwner']}
        </Button>

        <Button
          variant="outlined"
          onClick={() => setTargetEmployeeId(secretary.id)}
        >
          {literal['interaction.askSecretary']}
        </Button>
      </Box>

      {localMessages.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {localMessages.map((msg) => {
            const target = EMPLOYEE_DIRECTORY[msg.targetEmployeeId] ?? EMPLOYEE_DIRECTORY.mira;
            const statusText = msg.queueAccepted
              ? literal['interaction.stateQueued']
              : `${literal['interaction.stateBlocked']} (${msg.queueReason})`;
            return (
              <Chip
                key={msg.id}
                label={`${target.triggerName}: ${msg.responseText ?? msg.text} - ${statusText}`}
                size="small"
                sx={{ maxWidth: '100%' }}
              />
            );
          })}
        </Stack>
      )}

      {sendError && (
        <Typography variant="caption" sx={{ color: muiTheme.palette.error.main }}>
          {sendError}
        </Typography>
      )}
    </Box>
  );
};
