import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RigService } from './rig.service';
import { OverclockService } from './overclock.service';
import { SalvageService } from './salvage.service';
import { SkinsService } from './skins.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  InstallPartDto,
  OverclockDto,
  SalvagePartDto,
  SkinDto,
  UninstallPartDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller('rig')
export class RigController {
  constructor(
    private readonly rig: RigService,
    private readonly overclock: OverclockService,
    private readonly salvage: SalvageService,
    private readonly skins: SkinsService,
  ) {}

  /** GET /api/rig — chassis, grid, inventory, telemetry, live rate. */
  @Get()
  overview(@CurrentUser('id') userId: string) {
    return this.rig.overview(userId);
  }

  /** POST /api/rig/install — socket an owned part into a slot. */
  @Post('install')
  install(@CurrentUser('id') userId: string, @Body() dto: InstallPartDto) {
    return this.rig.install(userId, dto.boosterId, dto.slot);
  }

  /** POST /api/rig/uninstall — pull a part back into inventory. */
  @Post('uninstall')
  uninstall(@CurrentUser('id') userId: string, @Body() dto: UninstallPartDto) {
    return this.rig.uninstall(userId, dto.slot);
  }

  /** POST /api/rig/overclock — engage or release the overclock. */
  @Post('overclock')
  setOverclock(@CurrentUser('id') userId: string, @Body() dto: OverclockDto) {
    return this.overclock.set(userId, dto.on);
  }

  /** POST /api/rig/salvage — break a dying part down for scrap. */
  @Post('salvage')
  salvagePart(@CurrentUser('id') userId: string, @Body() dto: SalvagePartDto) {
    return this.salvage.salvage(userId, dto.boosterId);
  }

  /** POST /api/rig/craft — turn three scrap into a random part. */
  @Post('craft')
  craft(@CurrentUser('id') userId: string) {
    return this.salvage.craft(userId);
  }

  /** GET /api/rig/skins — catalogue, owned and equipped chassis skins. */
  @Get('skins')
  listSkins(@CurrentUser('id') userId: string) {
    return this.skins.list(userId);
  }

  /** POST /api/rig/skins/buy — buy a skin with VOLTS. */
  @Post('skins/buy')
  buySkin(@CurrentUser('id') userId: string, @Body() dto: SkinDto) {
    return this.skins.buy(userId, dto.skin);
  }

  /** POST /api/rig/skins/equip — put an owned skin on the chassis. */
  @Post('skins/equip')
  equipSkin(@CurrentUser('id') userId: string, @Body() dto: SkinDto) {
    return this.skins.equip(userId, dto.skin);
  }
}
