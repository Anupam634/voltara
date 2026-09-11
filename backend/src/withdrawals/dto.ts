import { IsNumber, IsString, Min } from 'class-validator';

export class RequestWithdrawalDto {
  /** Amount in whole/decimal VOLTS (min 100 — SPEC §4). */
  @IsNumber()
  @Min(100, { message: 'Minimum withdrawal is 100 points.' })
  points!: number;

  /** BNB Chain address that receives the $VLTR payout. */
  @IsString()
  toAddress!: string;
}
