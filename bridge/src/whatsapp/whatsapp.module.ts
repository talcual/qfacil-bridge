import { Module } from '@nestjs/common';
import { WhatsAppSessionManager } from '../services/whatsapp-session.manager';
import { WhatsappController } from './whatsapp.controller';

@Module({
  providers: [WhatsAppSessionManager],
  exports: [WhatsAppSessionManager],
  controllers: [WhatsappController],
})
export class WhatsappModule {}
