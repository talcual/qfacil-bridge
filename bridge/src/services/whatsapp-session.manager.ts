

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import Pino from "pino";
import { promises as fs } from 'fs';
import * as path from 'path';

const logger = Pino({
  level: "error",
});

@Injectable()
export class WhatsAppSessionManager implements OnModuleInit {
  private logger = new Logger(WhatsAppSessionManager.name);
  private sessions: Map<string, any> = new Map();

  async onModuleInit() {
    this.logger.log('🔄 Iniciando reconexión de sesiones guardadas...');
    await this.reconnectAllSessions();
  }

  /** Reconectar todas las sesiones guardadas */
  private async reconnectAllSessions() {
    try {
      const authDir = './auth';
      const entries = await fs.readdir(authDir, { withFileTypes: true });
      
      // Obtener carpetas únicas de sesiones (filtra archivos y busca carpetas)
      const sessionDirs = new Set<string>();
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Las carpetas de sesiones son directorios
          sessionDirs.add(entry.name);
        } else {
          // Los archivos de sesión tienen formato: creds.json, session-*.json, etc.
          // Ignoramos archivos sueltos y buscamos solo directorios
          continue;
        }
      }

      if (sessionDirs.size === 0) {
        this.logger.log('✓ No hay sesiones guardadas para reconectar.');
        return;
      }

      this.logger.log(`🔗 Encontradas ${sessionDirs.size} sesiones. Reconectando...`);
      
      for (const sessionId of sessionDirs) {
        try {
          await this.createSession(sessionId);
          this.logger.log(`✓ Sesión ${sessionId} reconectada.`);
        } catch (error) {
          this.logger.error(`✗ Error reconectando sesión ${sessionId}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error durante reconexión de sesiones: ${error.message}`);
    }
  }

  async createSession(sessionId: string) {
    if (this.sessions.has(sessionId)) {
      this.logger.warn(`La sesión ${sessionId} ya está activa.`);
      return this.sessions.get(sessionId);
    }

    const authFolder = `./auth/${sessionId}`;
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      version,
      browser: ['Chrome', 'Linux', '10.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      logger
    });

    /** Guardamos la sesión */
    this.sessions.set(sessionId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        const qrString = await QRCode.toString(qr, { type: 'terminal' });
        this.logger.log(`🟡 Nueva sesión: ${sessionId}\n${qrString}`);
      }

      if (connection === 'open') {
        this.logger.log(`🟢 Sesión ${sessionId} conectada.`);
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        this.logger.warn(`🔴 Sesión ${sessionId} desconectada: ${code}`);

        if (code !== DisconnectReason.loggedOut) {
          this.logger.log(`🔄 Reintentando sesión ${sessionId}...`);
          await this.createSession(sessionId);
        } else {
          this.logger.error(`❌ Sesión ${sessionId} expirada. Borra /auth/${sessionId}`);
        }
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      const msg = messages[0];
      if (!msg.message) return;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null;

      this.logger.log(
        `📩 (${sessionId}) Mensaje de ${msg.key.remoteJid}: ${text}`
      );
    });

    return sock;
  }

  /** Enviar mensaje por sesión */
  async sendMessage(sessionId: string, to: string, text: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sesión ${sessionId} no existe.`);
    return session.sendMessage(to, { text });
  }

  /** Listar sesiones */
  getActiveSessions() {
    return [...this.sessions.keys()];
  }
}
