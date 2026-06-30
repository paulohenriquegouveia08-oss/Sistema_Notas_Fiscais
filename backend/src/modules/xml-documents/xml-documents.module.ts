import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XmlDocument } from './entities/xml-document.entity';
import { XmlDocumentsService } from './xml-documents.service';
import { XmlDocumentsController } from './xml-documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([XmlDocument])],
  controllers: [XmlDocumentsController],
  providers: [XmlDocumentsService],
  exports: [XmlDocumentsService],
})
export class XmlDocumentsModule {}
