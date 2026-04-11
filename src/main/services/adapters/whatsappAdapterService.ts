/**
 * WhatsApp Adapter Service - "Linked Device" Protocol (Baileys)
 *
 * Implements WhatsApp Multi-Device connection by scraping Web Sockets, bridging natively
 * into the channel router and loop protection service.
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, AnyMessageContent } from '@whiskeysockets/baileys';
import { join } from 'path';
import { Boom } from '@hapi/boom';
import { channelRouterService, WhatsAppIngressPayload } from '../channelRouterService';
import { loopProtectionService, EscalationRequiredError } from '../loopProtectionService';
import { getAppDataRoot } from '../governanceRepoService';
import { orchestrationManager } from '../orchestrationManager';

export class WhatsappAdapterService {
  private sock: any | null = null;
  private readonly sessionDir: string;
  
  constructor() {
    // Isolate session persistence securely in vault/planning path
    this.sessionDir = join(getAppDataRoot(), 'baileys_auth_info');
  }

  /**
   * Initializes the Baileys socket lifecycle.
   */
  public async initialize(): Promise<void> {
    console.log("[WhatsappAdapterService] Initializing Baileys connection state...");
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true, // Output QR to console or log for operator
      syncFullHistory: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('[WhatsappAdapterService] connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
        if (shouldReconnect) {
          this.initialize(); // Attempt reconnect
        }
      } else if (connection === 'open') {
        console.log('[WhatsappAdapterService] WhatsApp connected successfully');
      }
    });

    // Handle inbound messages
    this.sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue;

          await this.processInboundMessage(msg);
        }
      }
    });
  }

  /**
   * Translates Baileys format to standard intent format and relays it
   */
  private async processInboundMessage(msg: any): Promise<void> {
    const senderRaw = msg.key.remoteJid;
    const participant = msg.key.participant || msg.key.remoteJid; // For groups, participant is the user
    
    // Extract text content reliably
    const messageContent = msg.message?.conversation 
      || msg.message?.extendedTextMessage?.text 
      || '';

    if (!messageContent.trim()) return;

    // Remove suffix domain tags (@s.whatsapp.net / @g.us)
    const senderPhoneId = participant.split('@')[0];
    const chatId = senderRaw.split('@')[0];
    const isGroup = senderRaw.endsWith('@g.us');

    const payload: WhatsAppIngressPayload = {
      message: messageContent,
      senderId: senderPhoneId,
      senderName: msg.pushName,
      chatId: isGroup ? chatId : "direct",
      timestampIso: new Date(msg.messageTimestamp * 1000).toISOString(),
      sessionId: `whatsapp-${isGroup ? chatId : senderPhoneId}`,
    };

    console.log(`[WhatsappAdapterService] Received message: ${messageContent.substring(0, 50)}`);

    try {
      // Dispatch immediately to ChannelRouter
      const routingResult = await channelRouterService.routeWhatsAppMessage(payload);
      
      if (routingResult.accepted) {
        // Optional: Send acknowledgment back via WhatsApp if configured
        console.log(`[WhatsappAdapterService] Successfully routed message to task ${routingResult.workOrderId}`);
      }
    } catch (e) {
      console.error("[WhatsappAdapterService] Validation or Routing error:", e);
    }
  }

  /**
   * Outbound communication routing handler.
   */
  public async sendMessage(to: string, content: AnyMessageContent, workOrderId: string, recentMessages: string[]): Promise<void> {
    if (!this.sock) {
      throw new Error("WhatsApp socket not initialized.");
    }

    // INTERLACE: LoopProtectionService check prior to sending out bounds
    try {
      await loopProtectionService.intercept(workOrderId, recentMessages);
      await this.sock.sendMessage(to, content);
    } catch (error) {
      if (error instanceof EscalationRequiredError) {
        console.warn(`[WhatsappAdapterService] LoopProtectionService cutoff triggered for Task ${workOrderId}. Escalating.`);
        // Emit Escalation IPC flag here so UI overrides can intervene
        orchestrationManager.broadcastEscalation(workOrderId, error.message);
      } else {
        throw error;
      }
    }
  }
}

export const whatsappAdapterService = new WhatsappAdapterService();
