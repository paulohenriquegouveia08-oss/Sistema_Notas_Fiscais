import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company_settings')
export class CompanySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  razaoSocial?: string;

  @Column({ nullable: true })
  nomeFantasia?: string;

  @Column({ nullable: true })
  cnpj?: string;

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

  @Column({ type: 'text', nullable: true })
  certificateB64?: string;

  @Column({ nullable: true })
  certificatePassword?: string;

  @Column({ nullable: true })
  sefazAmbiente?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
