import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Receivable } from '../../receivables/entities/receivable.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true, where: '"cnpj" IS NOT NULL' })
  @Column({ nullable: true })
  cnpj?: string;

  @Index({ unique: true, where: '"cpf" IS NOT NULL' })
  @Column({ nullable: true })
  cpf?: string;

  @Column()
  razaoSocial: string;

  @Column({ nullable: true })
  nomeFantasia?: string;

  @Column({ nullable: true })
  ie?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  telefone?: string;

  @Column({ nullable: true })
  cep?: string;

  @Column({ nullable: true })
  logradouro?: string;

  @Column({ nullable: true })
  numero?: string;

  @Column({ nullable: true })
  complemento?: string;

  @Column({ nullable: true })
  bairro?: string;

  @Column({ nullable: true })
  cidade?: string;

  @Column({ nullable: true })
  uf?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Invoice, (invoice) => invoice.customer)
  invoices: Invoice[];

  @OneToMany(() => Receivable, (receivable) => receivable.customer)
  receivables: Receivable[];

  @OneToMany(() => Payment, (payment) => payment.customer)
  payments: Payment[];
}
