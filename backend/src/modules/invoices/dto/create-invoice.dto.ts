import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '../../../shared/enums/invoice-status.enum';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Chave de acesso da NF-e (44 dígitos)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(44)
  chaveAcesso: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  numero: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(5)
  serie: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  dataEmissao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataEntrada?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  valorTotal: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseCalculoIcms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorIcms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseCalculoIcmsSt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorIcmsSt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorProdutos?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorFrete?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorDesconto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorTotalTributos?: number;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  xmlCompleto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(44)
  chaveAcessoReferenciada?: string;

  @ApiProperty({ description: 'ID do cliente' })
  @IsNotEmpty()
  @IsString()
  customerId: string;
}
