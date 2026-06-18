import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('pdf_documents')
export class PdfDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column({ unique: true })
  fileName: string;

  @Column()
  filePath: string;

  @Column({ type: 'int' })
  fileSize: number;

  @Column({ nullable: true })
  observacao?: string;

  @Index()
  @Column({ nullable: true })
  invoiceId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
