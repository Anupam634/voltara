import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';
import { MAX_PARTS } from './challenge.rules';

export class SubmitBlueprintDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARTS)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  partCodes!: string[];
}
