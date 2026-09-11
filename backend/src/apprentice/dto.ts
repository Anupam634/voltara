import { IsString, Length, Matches } from 'class-validator';

export class OfferApprenticeshipDto {
  /** The newcomer's referral code — the same code their share links carry. */
  @IsString()
  @Length(1, 64)
  apprenticeCode!: string;
}

export class ApprenticeshipIdDto {
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Not an apprenticeship id.' })
  id!: string;
}

export class GiftPartDto {
  @IsString()
  @Length(1, 64)
  apprenticeshipId!: string;

  @IsString()
  @Length(1, 64)
  boosterId!: string;
}
