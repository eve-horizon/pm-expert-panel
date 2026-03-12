import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGatewayService } from './chat-gateway.service';

@Module({
  controllers: [ChatController],
  providers: [ChatGatewayService],
  exports: [ChatGatewayService],
})
export class ChatModule {}
