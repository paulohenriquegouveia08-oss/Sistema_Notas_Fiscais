import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('telegram_conversations')
@Index(['chatId', 'createdAt'])
export class TelegramConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  chatId: number;

  @Column({ nullable: true })
  messageId?: number;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @Column({ nullable: true })
  fromName?: string;

  @Column({ default: false })
  isCommand: boolean;

  @Column({ type: 'text', nullable: true })
  replyText?: string;

  @Column({ default: false })
  answered: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
