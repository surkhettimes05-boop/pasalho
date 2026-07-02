import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { OrdersModule } from './orders/orders.module';
import { RepsModule } from './reps/reps.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [ChatModule, OrdersModule, RepsModule, SessionsModule],
})
export class AppModule {}
