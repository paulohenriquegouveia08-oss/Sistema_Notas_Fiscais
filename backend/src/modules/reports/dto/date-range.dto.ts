import { IsDateString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum ReportPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class DateRangeDto {
  @ApiProperty({ example: '2026-01-01', description: 'Data início (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-06-30', description: 'Data fim (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: ReportPeriod, default: ReportPeriod.MONTH })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod = ReportPeriod.MONTH;
}
