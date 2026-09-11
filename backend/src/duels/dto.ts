import { IsString, Length, Matches } from 'class-validator';

export class DuelCodeParam {
  @IsString()
  @Length(4, 64)
  @Matches(/^[a-z0-9]+$/i)
  code!: string;
}
