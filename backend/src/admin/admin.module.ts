import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminOpsService } from './ops.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminController, AdminSecureController } from './admin.controller';
import { AdminAuthGuard } from './admin.guard';
import { AuthModule } from '../auth/auth.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { GridModule } from '../grid/grid.module';
import { TasksService } from '../tasks/tasks.service';

/**
 * Admin panel API (SPEC §6). Imports AuthModule purely for its configured
 * JwtModule — admin sessions are a separate token type (`typ: 'admin'`)
 * checked by AdminAuthGuard, not the miner JwtAuthGuard.
 */
@Module({
  // GridModule supplies the event, weather and collective-goal services the
  // operator views read — the same instances the rigs are scored against.
  imports: [AuthModule, WithdrawalsModule, GridModule],
  controllers: [AdminController, AdminSecureController],
  providers: [
    AdminService,
    AdminOpsService,
    AdminAuthGuard,
    AdminBootstrapService,
    TasksService,
  ],
})
export class AdminModule {}
