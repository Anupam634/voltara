import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { MAX_PRICE_VOLTS, MIN_PRICE_VOLTS } from './market.rules';

export class ListPartDto {
  @IsString()
  @MinLength(1)
  boosterId!: string;

  @IsInt()
  @Min(MIN_PRICE_VOLTS)
  @Max(MAX_PRICE_VOLTS)
  priceVolts!: number;
}

export class MarketQueryDto {
  @IsOptional()
  @IsIn(['CORE', 'COOLER', 'PSU', 'MODULE'])
  kind?: 'CORE' | 'COOLER' | 'PSU' | 'MODULE';
}
