import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  async chat(
    @Body() body: { sessionId: string; repId: string; message: string },
  ) {
    const result = await this.chatService.chat(
      body.sessionId,
      body.repId,
      body.message,
    );
    return result;
  }
}
