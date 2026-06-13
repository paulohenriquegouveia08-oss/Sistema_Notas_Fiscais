import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaginatedResponse } from '../../shared/types';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    customerId?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<PaginatedResponse<Payment>> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.dataInicio && query.dataFim) {
      where.dataPagamento = Between(query.dataInicio, query.dataFim);
    } else if (query.dataInicio) {
      where.dataPagamento = MoreThanOrEqual(query.dataInicio);
    } else if (query.dataFim) {
      where.dataPagamento = LessThanOrEqual(query.dataFim);
    }

    const [data, total] = await this.paymentRepo.findAndCount({
      where,
      relations: ['customer', 'receivables'],
      skip,
      take: limit,
      order: { dataPagamento: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
