import { Module, forwardRef } from '@nestjs/common';
import { RigService } from './rig.service';
import { LoanerService } from './loaner.service';
import { RigContextService } from './rig-context.service';
import { OverclockService } from './overclock.service';
import { SalvageService } from './salvage.service';
import { SkinsService } from './skins.service';
import { RigController } from './rig.controller';
import { PublicRigController } from './public-rig.controller';
import { AuthModule } from '../auth/auth.module';
import { GridModule } from '../grid/grid.module';

@Module({
  imports: [
    // AuthModule provides JwtAuthGuard. It is circular because AuthModule
    // now needs the loaner grant at signup, so both sides defer.
    forwardRef(() => AuthModule),
    // Weather and the collective goal are modifiers on every rig, read by
    // RigContextService. GridModule imports nothing, so this is not circular.
    GridModule,
  ],
  // The public card controller is listed first so its concrete
  // `card/:code` path is matched before anything guarded.
  controllers: [PublicRigController, RigController],
  providers: [
    RigService,
    RigContextService,
    OverclockService,
    SalvageService,
    SkinsService,
    LoanerService,
  ],
  exports: [RigService, RigContextService, LoanerService],
})
export class RigModule {}
