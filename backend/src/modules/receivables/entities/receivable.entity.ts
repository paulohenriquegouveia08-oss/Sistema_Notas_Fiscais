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
import { Customer } from '../../customers/entities/customer.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { ReceivableStatus } from '../../../shared/enums/receivable-status.enum';

@Entity('receivables')
@Index(['customerId', 'status'])
@Index(['dataVencimento', 'status'])
export class Receivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 1 })
  parcela: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  valorOriginal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  valorReceber: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorPago?: number;

  @Column({ type: 'date' })
  dataVencimento: string;

  @Column({ type: 'date', nullable: true })
  dataPagamento?: string;

  @Column({ type: 'date', nullable: true })
  dataCancelamento?: string;

  @Column({ type: 'enum', enum: ReceivableStatus, default: ReceivableStatus.PENDING })
  status: ReceivableStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  juros?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  multa?: number;

  @Column({ nullable: true })
  observacao?: string;

  @Column({ nullable: true })
  formaPagamento?: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.receivables, { eager: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column()
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.receivables)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ nullable: true })
  paymentId?: string;

  @ManyToOne(() => Payment, (payment) => payment.receivables)
  @JoinColumn({ name: 'paymentId' })
  payment?: Payment;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
