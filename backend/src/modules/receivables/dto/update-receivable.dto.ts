import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateReceivableDto } from './create-receivable.dto';

export class UpdateReceivableDto extends PartialType(
  OmitType(CreateReceivableDto, ['customerId', 'invoiceId'] as const),
) {}
