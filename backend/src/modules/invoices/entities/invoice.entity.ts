import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { Receivable } from '../../receivables/entities/receivable.entity';
import { InvoiceStatus } from '../../../shared/enums/invoice-status.enum';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  chaveAcesso: string;

  @Column()
  numero: string;

  @Column()
  serie: string;

  @Column({ type: 'timestamptz' })
  dataEmissao: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dataEntrada?: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  valorTotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  baseCalculoIcms?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorIcms?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  baseCalculoIcmsSt?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorIcmsSt?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorProdutos?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorFrete?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorDesconto?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorTotalTributos?: number;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  xmlCompleto?: string;

  @Column({ nullable: true })
  pdfPath?: string;

  @Column({ nullable: true })
  chaveAcessoReferenciada?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  tipoPagamento?: string;

  @Column({ nullable: true, default: 0 })
  qtdeParcelas?: number;

  @Column({ type: 'text', nullable: true })
  infCpl?: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.invoices, { eager: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @OneToMany(() => Receivable, (receivable) => receivable.invoice)
  receivables: Receivable[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
