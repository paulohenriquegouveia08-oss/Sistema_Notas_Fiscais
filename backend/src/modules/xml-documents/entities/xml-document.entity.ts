import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { XmlDocumentStatus } from './xml-document-status.enum';

@Entity('xml_documents')
export class XmlDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  chaveAcesso: string;

  @Column({ nullable: true })
  invoiceId?: string;

  @ManyToOne(() => Invoice, { nullable: true, eager: false })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: Invoice;

  @Column({ nullable: true })
  customerId?: string;

  @ManyToOne(() => Customer, { nullable: true, eager: false })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column()
  nomeCliente: string;

  @Column()
  numeroNota: string;

  @Column()
  serie: string;

  @Column({ type: 'date' })
  dataEmissao: string;

  @Column()
  nomeArquivoOriginal: string;

  @Column()
  nomeArquivoSistema: string;

  @Column()
  caminhoArquivo: string;

  @Column({ type: 'int' })
  tamanhoArquivo: number;

  @Column({ type: 'enum', enum: XmlDocumentStatus, default: XmlDocumentStatus.SEM_NOTA })
  status: XmlDocumentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
