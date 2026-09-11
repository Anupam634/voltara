import { IsString, Length, Matches } from 'class-validator';

export class CreateSquadDto {
  @IsString()
  @Length(3, 24)
  @Matches(/^[\p{L}\p{N} _\-.']+$/u, {
    message: 'Squad names may use letters, numbers, spaces and - _ . \'',
  })
  name!: string;
}

export class JoinSquadDto {
  @IsString()
  @Length(4, 64)
  @Matches(/^[a-z0-9]+$/i)
  code!: string;
}
