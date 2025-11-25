import { Controller, UseGuards } from '@nestjs/common';
import { Post, Param, Body } from '@nestjs/common';
import { WhatsAppSessionManager } from '../services/whatsapp-session.manager';
import { FixedTokenGuard } from '../guards/fixtoken.guard';


@UseGuards(FixedTokenGuard)
@Controller('whatsapp')
export class WhatsappController {

  constructor(private sessionManager: WhatsAppSessionManager) {}

  @Post('session/:id')
  async create(@Param('id') id: string) {
    await this.sessionManager.createSession(id);
    return { message: `Sesión ${id} creada. Escanea QR en la consola.` };
  }

  @Post('send/:id')
  async sendMessage(@Param('id') sessionId: string, @Body() body: { to: string; text: string },) {
    return this.sessionManager.sendMessage(sessionId, body.to, body.text);
  }

}
