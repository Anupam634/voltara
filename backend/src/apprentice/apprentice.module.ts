import { Module, forwardRef } from '@nestjs/common';
import { ApprenticeService } from './apprentice.service';
import { ApprenticeController } from './apprentice.controller';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';

@Module({
  imports: [
    // AuthModule provides JwtAuthGuard; RigModule provides autoInstall for
    // gifted parts and the context service for a live stability read.
    forwardRef(() => AuthModule),
    RigModule,
  ],
  controllers: [ApprenticeController],
  providers: [ApprenticeService],
  exports: [ApprenticeService],
})
export class ApprenticeModule {}
