import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { Receivable } from '../../receivables/entities/receivable.entity';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  valorPago: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'date' })
  dataPagamento: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  juros?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  multa?: number;

  @Column({ nullable: true })
  observacao?: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.payments, { eager: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @OneToMany(() => Receivable, (receivable) => receivable.payment)
  receivables: Receivable[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
