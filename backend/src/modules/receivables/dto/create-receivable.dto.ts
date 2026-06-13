import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReceivableStatus } from '../../../shared/enums/receivable-status.enum';

export class CreateReceivableDto {
  @ApiProperty({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  parcela?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  valorOriginal: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  valorReceber: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  dataVencimento: string;

  @ApiPropertyOptional({ enum: ReceivableStatus })
  @IsOptional()
  @IsEnum(ReceivableStatus)
  status?: ReceivableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  formaPagamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  invoiceId: string;
}
