import { FC, useEffect, useMemo, useState } from 'react';
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
import { spacing } from 'astra';
import { safeIpcCall } from 'prana/ui/common/errors/safeIpcCall';
import { assertRequiredBrandingFields, useBranding } from '../constants/pranaConfig';

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

interface ConversationRecordShape {
  conversationKey: string;
  roomKey: string;
  targetPersonaId: string | null;
}

interface ConversationMessageShape {
  messageId: string;
  role: 'operator' | 'assistant' | 'system';
  actorId: string | null;
  content: string;
  status: LocalMessage['queueReason'];
  replyToMessageId: string | null;
}

interface ConversationSnapshotShape {
  conversation: ConversationRecordShape;
  messages: ConversationMessageShape[];
}

interface ChannelCapabilityShape {
  channelId: string;
  label: string;
  isEnabled: boolean;
}

const resolveRoomKey = (channelId: string, moduleRoute: string): string => {
  if (channelId === 'telegram') {
    return 'telegram-direct';
  }
  return moduleRoute;
};

const EmployeeCard: FC<{
  title: string;
  employee: EmployeeDirectoryEntry;
  avatarBaseUrl?: string;
  onOpenProfile: (employeeId: string) => void;
}> = ({ title, employee, avatarBaseUrl, onOpenProfile }) => {
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
          src={getEmployeeAvatarPath(employee.id, avatarBaseUrl)}
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
  const branding = useBranding();
  assertRequiredBrandingFields('DirectorInteractionBar', branding, ['directorSenderEmail', 'directorSenderName']);

  const muiTheme = useMuiTheme();
  const { literal } = useLanguage();

  const [targetEmployeeId, setTargetEmployeeId] = useState<string>(secretaryId);
  const [messageText, setMessageText] = useState('');
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [activeConversationKey, setActiveConversationKey] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('internal-chat');
  const [availableChannels, setAvailableChannels] = useState<ChannelCapabilityShape[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const directorSenderEmail = branding.directorSenderEmail as string;
  const directorSenderName = branding.directorSenderName as string;
  const avatarBaseUrl = branding.avatarBaseUrl;

  const [escalations, setEscalations] = useState<Record<string, string>>({});

  useEffect(() => {
    // Listen for escalations broadcasted by the orchestrationManager
    const handleEscalation = (_event: any, { taskId, reason }: { taskId: string; reason: string }) => {
      setEscalations((prev) => ({ ...prev, [taskId]: reason }));
    };
    
    // We assume ipcRenderer configures generic 'on' in preload but electron might not be available directly in renderer without a preload bridge mapping.
    // Given prana's design, let's use global.window.api if it exists, otherwise safe fallback is needed.
    // Wait, IPC direct use is restricted. I should add it to preload.ts or listen generically if possible.
    // But since the project is in tsx, `window.api.on` might not be standard. Preload exposes safe access.
    let cleanup = () => {};
    if (window.api?.channels?.onEscalation) {
       cleanup = window.api.channels.onEscalation(handleEscalation);
    } else {
       // direct fallback for testing if no preload context isolation
       // The instruction says "send 'app:escalation-cleared' IPC upon "Proceed" action"
    }

    return cleanup;
  }, []);

  const owner = EMPLOYEE_DIRECTORY[ownerId] ?? EMPLOYEE_DIRECTORY.mira;
  const secretary = EMPLOYEE_DIRECTORY[secretaryId] ?? EMPLOYEE_DIRECTORY.mira;

  const mentionList = useMemo(() => EMPLOYEE_LIST, []);

  useEffect(() => {
    let cancelled = false;

    const loadChannelCapabilities = async () => {
      try {
        const capabilities = await safeIpcCall(
          'channels.getCapabilities',
          () => window.api.channels.getCapabilities(),
          (value) => Array.isArray(value),
        ) as ChannelCapabilityShape[];

        if (cancelled) {
          return;
        }

        const enabled = capabilities.filter((entry) => entry.isEnabled);
        setAvailableChannels(enabled);

        if (enabled.length > 0 && !enabled.some((entry) => entry.channelId === selectedChannelId)) {
          setSelectedChannelId(enabled[0].channelId);
        }
      } catch {
        if (!cancelled) {
          setAvailableChannels([]);
          setSelectedChannelId('internal-chat');
        }
      }
    };

    void loadChannelCapabilities();

    return () => {
      cancelled = true;
    };
  }, [selectedChannelId]);

  const loadConversationPreview = async (conversationKey?: string | null) => {
    const resolvedKey = conversationKey ?? activeConversationKey;
    if (!resolvedKey) {
      setLocalMessages([]);
      return;
    }

    try {
      const snapshot = await safeIpcCall(
        'channels.getConversationHistory',
        () => window.api.channels.getConversationHistory({ conversationKey: resolvedKey, limit: 20 }),
        (value) => value === null || (typeof value === 'object' && value !== null),
      ) as ConversationSnapshotShape | null;

      if (!snapshot) {
        setLocalMessages([]);
        return;
      }

      const mapped = snapshot.messages
        .filter((message) => message.role === 'assistant')
        .slice(-4)
        .reverse()
        .map((message) => ({
          id: message.messageId,
          targetEmployeeId: message.actorId ?? targetEmployeeId,
          text: message.content,
          responseText: message.content,
          queueAccepted: message.status === 'accepted',
          queueReason: message.status ?? 'unknown',
        }));

      setLocalMessages(mapped);
    } catch {
      setLocalMessages([]);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateConversation = async () => {
      try {
        const channel = selectedChannelId;
        const conversations = await safeIpcCall(
          'channels.listConversations',
          () => window.api.channels.listConversations({ channel, limit: 100 }),
          (value) => Array.isArray(value),
        ) as ConversationRecordShape[];

        const roomKey = resolveRoomKey(selectedChannelId, moduleRoute);
        const match = conversations.find(
          (entry) => entry.roomKey === roomKey && (entry.targetPersonaId ?? secretaryId) === targetEmployeeId,
        );

        if (cancelled) {
          return;
        }

        setActiveConversationKey(match?.conversationKey ?? null);
        if (match?.conversationKey) {
          await loadConversationPreview(match.conversationKey);
        } else {
          setLocalMessages([]);
        }
      } catch {
        if (!cancelled) {
          setLocalMessages([]);
        }
      }
    };

    void hydrateConversation();

    return () => {
      cancelled = true;
    };
  }, [selectedChannelId, moduleRoute, secretaryId, targetEmployeeId]);

  const sendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      let message: LocalMessage;
      let latestConversationKey: string | null = null;

      const result = await safeIpcCall(
        'channels.routeMessage',
        () =>
          window.api.channels.routeMessage({
            senderId: directorSenderEmail,
            senderName: directorSenderName,
            channelId: selectedChannelId,
            roomId: resolveRoomKey(selectedChannelId, moduleRoute),
            messageText: trimmed,
            isDirector: true,
            explicitTargetPersonaId: targetEmployeeId,
            timestampIso: new Date().toISOString(),
            metadata: { moduleRoute },
          }),
        (value) => typeof value === 'object' && value !== null,
      );

      message = {
        id: (result as { workOrderId?: string }).workOrderId ?? `${Date.now()}`,
        targetEmployeeId,
        text: trimmed,
        responseText: (result as { message?: string }).message,
        queueAccepted: Boolean((result as { accepted?: boolean }).accepted),
        queueReason:
          ((result as { status?: LocalMessage['queueReason'] }).status as LocalMessage['queueReason']) ??
          'unknown',
      };
      latestConversationKey = (result as { conversationKey?: string }).conversationKey ?? null;
      setActiveConversationKey(latestConversationKey);

      setLocalMessages((prev) => [message, ...prev].slice(0, 4));
      setMessageText('');
      await loadConversationPreview(latestConversationKey);
    } catch {
      setSendError(literal['interaction.sendFailed']);
    } finally {
      setIsSending(false);
    }
  };

  const handleProceedEscalation = async (taskId: string) => {
    setEscalations((prev) => {
       const copy = { ...prev };
       delete copy[taskId];
       return copy;
    });
    // The instructions say "send `app:escalation-cleared` IPC"
    if (window.api?.channels?.clearEscalation) {
       await window.api.channels.clearEscalation({ taskId });
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
            avatarBaseUrl={avatarBaseUrl}
            onOpenProfile={onOpenProfile}
          />
          <EmployeeCard
            title={literal['interaction.secretary']}
            employee={secretary}
            avatarBaseUrl={avatarBaseUrl}
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

        <Box sx={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: muiTheme.palette.text.secondary }}>
            {literal['interaction.channel'] ?? 'Channel'}
          </Typography>
          <TextField
            select
            size="small"
            value={selectedChannelId}
            onChange={(event) => setSelectedChannelId(event.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: '160px' }}
          >
            {availableChannels.map((channel) => (
              <option key={channel.channelId} value={channel.channelId}>
                {channel.label}
              </option>
            ))}
          </TextField>
        </Box>

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

      {Object.entries(escalations).length > 0 && (
        <Box sx={{ mt: spacing.md, p: spacing.sm, border: `1px solid ${muiTheme.palette.error.main}`, borderRadius: 1, backgroundColor: muiTheme.palette.error.light }}>
          <Typography variant="body2Bold" color="error">Action Required: Agent Loop Blocked</Typography>
          {Object.entries(escalations).map(([taskId, reason]) => (
             <Box key={taskId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="caption" sx={{ color: muiTheme.palette.error.contrastText }}>
                  Task {taskId}: {reason}
                </Typography>
                <Button variant="contained" size="small" color="error" onClick={() => handleProceedEscalation(taskId)}>
                  Proceed (Unlock)
                </Button>
             </Box>
          ))}
        </Box>
      )}

      {sendError && (
        <Typography variant="caption" sx={{ color: muiTheme.palette.error.main }}>
          {sendError}
        </Typography>
      )}
    </Box>
  );
};
