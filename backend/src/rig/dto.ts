import {
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_SLOTS } from '../mining/rig.engine';

export class InstallPartDto {
  /** The owned part (a `Booster` row) to socket. */
  @IsString()
  @MinLength(1)
  boosterId!: string;

  /** 0-based slot position. Bounded again against the miner's own chassis. */
  @IsInt()
  @Min(0)
  @Max(MAX_SLOTS - 1)
  slot!: number;
}

export class UninstallPartDto {
  @IsInt()
  @Min(0)
  @Max(MAX_SLOTS - 1)
  slot!: number;
}

export class OverclockDto {
  @IsBoolean()
  on!: boolean;
}

export class SalvagePartDto {
  @IsString()
  @MinLength(1)
  boosterId!: string;
}

export class SkinDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  skin!: string;
}
