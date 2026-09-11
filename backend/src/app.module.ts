import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { AntiabuseModule } from './antiabuse/antiabuse.module';
import { MiningModule } from './mining/mining.module';
import { RigModule } from './rig/rig.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { AdminModule } from './admin/admin.module';
import { TasksModule } from './tasks/tasks.module';
import { KycModule } from './kyc/kyc.module';
import { BoostersModule } from './boosters/boosters.module';
import { SupportModule } from './support/support.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './email/email.module';
import { ReferralsModule } from './referrals/referrals.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { GridModule } from './grid/grid.module';
import { DuelsModule } from './duels/duels.module';
import { SquadsModule } from './squads/squads.module';
import { PartMarketModule } from './part-market/part-market.module';
import { ChallengesModule } from './challenges/challenges.module';
import { DailyModule } from './daily/daily.module';
import { ApprenticeModule } from './apprentice/apprentice.module';
import { SeasonsModule } from './seasons/seasons.module';

/**
 * Root module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ScheduleModule.forRoot(),
    // A blanket per-IP ceiling. Deliberately generous — the dashboard polls
    // mining status, and this is a backstop against scripted abuse, not a
    // per-endpoint budget. The routes that need a real limit (anything that
    // sends mail) are capped per email address in EmailService, which holds
    // even if the proxy hides the client IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    EmailModule,
    AuthModule,
    AntiabuseModule,
    MiningModule,
    RigModule,
    WithdrawalsModule,
    AdminModule,
    TasksModule,
    KycModule,
    SupportModule,
    HealthModule,
    BoostersModule,
    ReferralsModule,
    LeaderboardModule,
    GridModule,
    DuelsModule,
    SquadsModule,
    PartMarketModule,
    ChallengesModule,
    DailyModule,
    ApprenticeModule,
    SeasonsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
