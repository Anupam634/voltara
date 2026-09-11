import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';
import { MAX_PARTS } from './daily.rules';

export class SubmitDailyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARTS)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  partCodes!: string[];
}
