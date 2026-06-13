import { ApiProperty } from '@nestjs/swagger';

export class ImportXmlResponseDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  imported: number;

  @ApiProperty()
  duplicated: number;

  @ApiProperty()
  errors: number;

  @ApiProperty()
  details: any[];
}
