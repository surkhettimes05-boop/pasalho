import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  providers: [UserService, RoleService],
  controllers: [UserController, RoleController],
  exports: [UserService],
})
export class IdentityModule {}
