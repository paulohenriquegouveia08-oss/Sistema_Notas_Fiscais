import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { TelegramConversation } from './entities/telegram-conversation.entity';
import { AiService, AiMessage, AiTool } from '../../integrations/ai/ai.service';
import { ServerMonitorService } from '../../integrations/server-monitor/server-monitor.service';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ReceivableStatus } from '../../shared/enums/receivable-status.enum';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

interface ToolResult {
  success: boolean;
  data: string;
}

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly botToken: string;
  private readonly apiBase: string;
  private readonly systemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly serverMonitor: ServerMonitorService,
    @InjectRepository(TelegramConversation)
    private readonly conversationRepo: Repository<TelegramConversation>,
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;

    this.systemPrompt = `Você é o assistente virtual do Sistema de Gestão Financeira (SisFin) e também um assistente de infraestrutura do servidor.
Você tem acesso a dados reais do sistema através de ferramentas (tools).

Você pode:
- Consultar dados financeiros (recebíveis, notas fiscais, clientes)
- Monitorar o servidor (CPU, RAM, disco, containers Docker)
- Gerenciar serviços (ver logs, reiniciar containers)
- Ver armazenamento dos projetos

Regras:
- Responda em português brasileiro, de forma clara e objetiva.
- Use formatação simples (sem markdown complexo).
- Quando mostrar valores monetários, use o formato R$ X.XXX,XX.
- Quando mostrar datas, use formato brasileiro (dd/mm/aaaa).
- Se não souber algo, use as tools disponíveis para buscar a informação.
- Se a tool retornar erro, informe o usuário de forma amigável.
- Mantenha um tom profissional mas amigável.
- Você pode usar tools múltiplas vezes se precisar de mais dados.
- Ao executar ações que modifiquem o estado do servidor, SEMPRE confirme com o usuário antes.

As ferramentas restart_docker_service e exec_docker_command SÓ podem ser executadas após o usuário confirmar explicitamente que deseja prosseguir.`;
  }

  private get tools(): AiTool[] {
    return [
      {
        name: 'get_summary',
        description: 'Obtém um resumo financeiro completo do sistema: total a receber, total recebido no mês, total em atraso, total pendente, inadimplência, número de clientes e notas fiscais.',
        parameters: {},
      },
      {
        name: 'get_receivables',
        description: 'Lista recebíveis com filtros opcionais.',
        parameters: {
          status: {
            type: 'string',
            description: 'Filtrar por status: PENDING, PAID, OVERDUE, CANCELLED',
            enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
          },
          limit: {
            type: 'number',
            description: 'Quantidade máxima de resultados (padrão 10)',
          },
        },
      },
      {
        name: 'get_invoices',
        description: 'Busca notas fiscais por termo (número, cliente, chave de acesso).',
        parameters: {
          search: { type: 'string', description: 'Termo para busca (número, cliente, chave)' },
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão 5)' },
        },
        required: ['search'],
      },
      {
        name: 'get_customers',
        description: 'Busca clientes por termo (razão social, CNPJ, CPF).',
        parameters: {
          search: { type: 'string', description: 'Termo para busca' },
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão 5)' },
        },
        required: ['search'],
      },
      {
        name: 'get_overdue_list',
        description: 'Lista os maiores devedores (clientes com mais valor em atraso).',
        parameters: {
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão 5)' },
        },
      },
      {
        name: 'get_upcoming',
        description: 'Lista recebíveis a vencer nos próximos dias.',
        parameters: {
          days: { type: 'number', description: 'Quantidade de dias para frente (padrão 30)' },
          limit: { type: 'number', description: 'Quantidade máxima de resultados (padrão 5)' },
        },
      },
      {
        name: 'get_system_metrics',
        description: 'Obtém métricas do servidor: uso de CPU, RAM, disco, uptime.',
        parameters: {},
      },
      {
        name: 'get_service_status',
        description: 'Lista todos os serviços Docker rodando no servidor com status, CPU e memória de cada um.',
        parameters: {},
      },
      {
        name: 'get_storage_by_project',
        description: 'Mostra o uso de armazenamento de cada projeto no servidor (Sistema NF-e, PK Fit, Advocacia) e do Docker.',
        parameters: {},
      },
      {
        name: 'get_container_logs',
        description: 'Obtém logs de um container específico.',
        parameters: {
          name: { type: 'string', description: 'Nome do container (ex: financas-api, financas-db, financas-redis)' },
          lines: { type: 'number', description: 'Quantidade de linhas (padrão 50)' },
        },
        required: ['name'],
      },
      {
        name: 'restart_docker_service',
        description: 'Reinicia um container Docker. REQUER CONFIRMAÇÃO DO USUÁRIO antes de executar.',
        parameters: {
          name: { type: 'string', description: 'Nome do container para reiniciar' },
          confirm: { type: 'boolean', description: 'Confirmação do usuário (deve ser true)' },
        },
        required: ['name', 'confirm'],
      },
    ];
  }

  async handleUpdate(update: any): Promise<void> {
    try {
      const message = update.message || update.edited_message;
      if (!message || !message.text) return;

      const chatId = message.chat.id;
      const text = message.text.trim();
      const fromName = message.from?.first_name || 'Usuário';
      const messageId = message.message_id;

      this.logger.log(`Telegram message from ${fromName} (${chatId}): ${text}`);

      const isCommand = text.startsWith('/');

      const conv = this.conversationRepo.create({ chatId, messageId, text, fromName, isCommand });
      await this.conversationRepo.save(conv);

      if (isCommand) {
        await this.handleCommand(chatId, text, conv);
      } else {
        await this.handleAiMessage(chatId, text, conv, messageId);
      }
    } catch (error: any) {
      this.logger.error(`Error handling update: ${error.message}`);
    }
  }

  private async handleCommand(chatId: number, text: string, conv: TelegramConversation): Promise<void> {
    let reply = '';

    switch (text.toLowerCase()) {
      case '/start':
      case '/ajuda':
        reply = this.getHelpText();
        break;
      case '/status':
        reply = await this.getStatusText();
        break;
      case '/recebiveis':
        reply = await this.getReceivablesListText();
        break;
      case '/relatorio':
        reply = await this.getReportText();
        break;
      case '/servidor':
        reply = await this.getServerMetricsText();
        break;
      case '/servicos':
        reply = await this.getServiceStatusText();
        break;
      case '/discos':
        reply = await this.getStorageText();
        break;
      default:
        reply = `Comando não reconhecido: ${text}\n\nUse /ajuda para ver os comandos disponíveis.`;
    }

    conv.replyText = reply;
    conv.answered = true;
    await this.conversationRepo.save(conv);
    await this.sendMessage(chatId, reply);
  }

  private async handleAiMessage(
    chatId: number,
    text: string,
    conv: TelegramConversation,
    messageId: number,
  ): Promise<void> {
    const history = await this.conversationRepo.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
      take: 20,
    });

    const messages: AiMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...history.map((h) => {
        if (h.replyText) {
          return [
            { role: 'user' as const, content: h.text || '' },
            { role: 'assistant' as const, content: h.replyText },
          ];
        }
        return { role: 'user' as const, content: h.text || '' };
      }).flat(),
      { role: 'user', content: text },
    ];

    await this.sendChatAction(chatId);

    const tools = this.tools;
    let result = await this.aiService.chat(messages, tools);
    let finalContent = '';

    while (result.toolCalls.length > 0) {
      messages.push(result.message);

      for (const toolCall of result.toolCalls) {
        const toolResult = await this.executeTool(toolCall.function.name, toolCall.function.arguments);
        messages.push({
          role: 'tool',
          content: toolResult.data,
          tool_call_id: toolCall.id,
        });
      }

      result = await this.aiService.chat(messages, tools);
    }

    finalContent = result.message.content || 'Desculpe, não consegui processar sua solicitação.';

    conv.replyText = finalContent;
    conv.answered = true;
    await this.conversationRepo.save(conv);
    await this.sendMessage(chatId, finalContent);
  }

  private async executeTool(name: string, argsJson: string): Promise<ToolResult> {
    try {
      const args = JSON.parse(argsJson);
      switch (name) {
        case 'get_summary': return await this.execGetSummary();
        case 'get_receivables': return await this.execGetReceivables(args);
        case 'get_invoices': return await this.execGetInvoices(args);
        case 'get_customers': return await this.execGetCustomers(args);
        case 'get_overdue_list': return await this.execGetOverdueList(args);
        case 'get_upcoming': return await this.execGetUpcoming(args);
        case 'get_system_metrics': return await this.execGetSystemMetrics();
        case 'get_service_status': return await this.execGetServiceStatus();
        case 'get_storage_by_project': return await this.execGetStorageByProject();
        case 'get_container_logs': return await this.execGetContainerLogs(args);
        case 'restart_docker_service': return await this.execRestartContainer(args);
        default:
          return { success: false, data: `Tool desconhecida: ${name}` };
      }
    } catch (error: any) {
      this.logger.error(`Error executing tool ${name}: ${error.message}`);
      return { success: false, data: `Erro ao executar ${name}: ${error.message}` };
    }
  }

  private async execGetSystemMetrics(): Promise<ToolResult> {
    const metrics = await this.serverMonitor.getSystemMetrics();
    return { success: true, data: JSON.stringify(metrics) };
  }

  private async execGetServiceStatus(): Promise<ToolResult> {
    const containers = await this.serverMonitor.getContainerList();
    return { success: true, data: JSON.stringify(containers) };
  }

  private async execGetStorageByProject(): Promise<ToolResult> {
    const [projects, totalDisk] = await Promise.all([
      this.serverMonitor.getProjectDiskUsage(),
      this.serverMonitor.getTotalDiskUsage(),
    ]);
    return { success: true, data: JSON.stringify({ projects, totalDisk }) };
  }

  private async execGetContainerLogs(args: any): Promise<ToolResult> {
    const name = args.name;
    const lines = args.lines || 50;
    const logs = await this.serverMonitor.getContainerLogs(name, lines);
    return { success: true, data: JSON.stringify({ container: name, logs }) };
  }

  private async execRestartContainer(args: any): Promise<ToolResult> {
    if (!args.confirm) {
      return { success: false, data: 'Confirmação necessária. Defina confirm=true para reiniciar.' };
    }
    const result = await this.serverMonitor.restartContainer(args.name);
    return { success: true, data: result };
  }

  private async execGetSummary(): Promise<ToolResult> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = getTodayStr();

    const [
      totalAReceber, totalAtrasado, totalPendente, totalRecebidoMes, proximos30,
      totalClientes, totalNfes,
    ] = await Promise.all([
      this.receivableRepo.createQueryBuilder('r')
        .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
        .where('r.status IN (:...statuses)', { statuses: ['PENDING', 'OVERDUE'] })
        .getRawOne().then(r => parseFloat(r?.total || '0')),
      this.receivableRepo.createQueryBuilder('r')
        .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
        .where('r.status = :status', { status: 'OVERDUE' })
        .getRawOne().then(r => parseFloat(r?.total || '0')),
      this.receivableRepo.createQueryBuilder('r')
        .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
        .where('r.status = :status', { status: 'PENDING' })
        .getRawOne().then(r => parseFloat(r?.total || '0')),
      this.receivableRepo.createQueryBuilder('r')
        .select('COALESCE(SUM(r.valorPago), 0)', 'total')
        .where('r.status = :status', { status: 'PAID' })
        .andWhere('r.dataPagamento >= :start', { start: startOfMonth.toISOString().split('T')[0] })
        .andWhere('r.dataPagamento <= :end', { end: endOfMonth.toISOString().split('T')[0] })
        .getRawOne().then(r => parseFloat(r?.total || '0')),
      this.receivableRepo.createQueryBuilder('r')
        .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
        .where('r.status = :status', { status: 'PENDING' })
        .andWhere('r.dataVencimento >= :now', { now: today })
        .andWhere('r.dataVencimento <= :future', { future: thirtyDaysFromNow.toISOString().split('T')[0] })
        .getRawOne().then(r => parseFloat(r?.total || '0')),
      this.customerRepo.count(),
      this.invoiceRepo.count(),
    ]);

    const inadimplencia = totalAReceber > 0 ? ((totalAtrasado / totalAReceber) * 100).toFixed(1) : '0.0';

    return {
      success: true,
      data: JSON.stringify({
        totalAReceber: formatBRL(totalAReceber),
        totalRecebidoMes: formatBRL(totalRecebidoMes),
        totalAtrasado: formatBRL(totalAtrasado),
        totalPendente: formatBRL(totalPendente),
        inadimplencia: `${inadimplencia}%`,
        recebimentoProximos30Dias: formatBRL(proximos30),
        totalClientes,
        totalNfes,
      }),
    };
  }

  private async execGetReceivables(args: any): Promise<ToolResult> {
    const limit = args.limit || 10;
    const where: any = {};
    if (args.status) where.status = args.status;

    const [data, total] = await this.receivableRepo.findAndCount({
      where, relations: ['customer', 'invoice'], take: limit, order: { dataVencimento: 'ASC' },
    });

    return {
      success: true,
      data: JSON.stringify({
        total,
        items: data.map(r => ({
          cliente: r.customer?.razaoSocial || '—',
          valor: formatBRL(r.valorReceber),
          vencimento: formatDate(r.dataVencimento),
          status: r.status,
          nf: r.invoice ? `${r.invoice.numero}/${r.invoice.serie}` : '—',
        })),
      }),
    };
  }

  private async execGetInvoices(args: any): Promise<ToolResult> {
    const search = args.search || '';
    const limit = args.limit || 5;

    const qb = this.invoiceRepo.createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'cust')
      .take(limit)
      .orderBy('inv.dataEmissao', 'DESC');

    if (search) {
      qb.where('CAST(inv.numero AS TEXT) ILIKE :search', { search: `%${search}%` })
        .orWhere('cust.razaoSocial ILIKE :search', { search: `%${search}%` })
        .orWhere('inv.chaveAcesso ILIKE :search', { search: `%${search}%` });
    }

    const data = await qb.getMany();

    return {
      success: true,
      data: JSON.stringify({
        total: data.length,
        items: data.map(inv => ({
          numero: `${inv.numero}/${inv.serie}`,
          cliente: inv.customer?.razaoSocial || '—',
          valor: formatBRL(inv.valorTotal),
          data: formatDate(inv.dataEmissao.toISOString().split('T')[0]),
        })),
      }),
    };
  }

  private async execGetCustomers(args: any): Promise<ToolResult> {
    const search = args.search || '';
    const limit = args.limit || 5;

    const qb = this.customerRepo.createQueryBuilder('c')
      .take(limit)
      .orderBy('c.razaoSocial', 'ASC');

    if (search) {
      qb.where('c.razaoSocial ILIKE :search', { search: `%${search}%` })
        .orWhere('c.cnpj ILIKE :search', { search: `%${search}%` })
        .orWhere('c.cpf ILIKE :search', { search: `%${search}%` });
    }

    const data = await qb.getMany();

    return {
      success: true,
      data: JSON.stringify({
        total: data.length,
        items: data.map(c => ({
          razaoSocial: c.razaoSocial,
          documento: c.cnpj || c.cpf || '—',
          cidade: c.cidade || '—',
          uf: c.uf || '—',
        })),
      }),
    };
  }

  private async execGetOverdueList(args: any): Promise<ToolResult> {
    const limit = args.limit || 5;

    const data = await this.receivableRepo
      .createQueryBuilder('r')
      .select('r.customerId', 'customerId')
      .addSelect('c.razaoSocial', 'razaoSocial')
      .addSelect('COALESCE(SUM(r.valorReceber), 0)', 'totalValorAtrasado')
      .addSelect('COUNT(r.id)', 'totalParcelasAtrasadas')
      .leftJoin(Customer, 'c', 'c.id = r.customerId')
      .where('r.status = :status', { status: 'OVERDUE' })
      .groupBy('r.customerId')
      .addGroupBy('c.razaoSocial')
      .orderBy('"totalValorAtrasado"', 'DESC')
      .limit(limit)
      .getRawMany();

    return {
      success: true,
      data: JSON.stringify({
        items: data.map((r: any) => ({
          cliente: r.razaoSocial,
          valor: formatBRL(parseFloat(r.totalValorAtrasado || '0')),
          parcelas: parseInt(r.totalParcelasAtrasadas || '0', 10),
        })),
      }),
    };
  }

  private async execGetUpcoming(args: any): Promise<ToolResult> {
    const days = args.days || 30;
    const limit = args.limit || 5;
    const today = getTodayStr();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;

    const [data, total] = await this.receivableRepo.findAndCount({
      where: { status: 'PENDING' as ReceivableStatus, dataVencimento: Between(today, futureStr) },
      relations: ['customer', 'invoice'],
      take: limit,
      order: { dataVencimento: 'ASC' },
    });

    return {
      success: true,
      data: JSON.stringify({
        total,
        items: data.map(r => ({
          cliente: r.customer?.razaoSocial || '—',
          valor: formatBRL(r.valorReceber),
          vencimento: formatDate(r.dataVencimento),
          nf: r.invoice ? `${r.invoice.numero}/${r.invoice.serie}` : '—',
        })),
      }),
    };
  }

  private async getServerMetricsText(): Promise<string> {
    const m = await this.serverMonitor.getSystemMetrics();
    return [
      '🖥️ *Status do Servidor*',
      '',
      `⏰ Uptime: ${m.uptime}`,
      `🧠 CPU: ${m.cpuUsage} (${m.cpuCores} cores)`,
      `💾 RAM: ${m.ramUsed} / ${m.ramTotal} (${m.ramUsagePercent})`,
      `💿 Disco: ${m.diskUsed} / ${m.diskTotal} (${m.diskUsagePercent})`,
    ].join('\n');
  }

  private async getServiceStatusText(): Promise<string> {
    const containers = await this.serverMonitor.getContainerList();
    if (containers.length === 0) return 'Nenhum container encontrado.';

    const lines = containers.map((c) =>
      `• *${c.name}* — ${c.status.includes('Up') ? '✅ Online' : '❌ Offline'}\n` +
      `  ${c.status}\n` +
      `  CPU: ${c.cpu} | RAM: ${c.memory}\n` +
      `  Portas: ${c.ports}`
    );

    return ['📦 *Serviços Docker*', '', ...lines].join('\n');
  }

  private async getStorageText(): Promise<string> {
    const [projects, totalDisk] = await Promise.all([
      this.serverMonitor.getProjectDiskUsage(),
      this.serverMonitor.getTotalDiskUsage(),
    ]);

    const lines = projects.map((p) => `• *${p.name}*: ${p.size}`);

    return [
      '💿 *Armazenamento*',
      '',
      `Total do disco: ${totalDisk}`,
      '',
      '*Por projeto:*',
      ...lines,
    ].join('\n');
  }

  private async getStatusText(): Promise<string> {
    const result = await this.execGetSummary();
    if (!result.success) return 'Erro ao buscar status.';
    const d = JSON.parse(result.data);

    return [
      '📊 *Resumo Financeiro*',
      '',
      `💰 Total a Receber: ${d.totalAReceber}`,
      `✅ Recebido no Mês: ${d.totalRecebidoMes}`,
      `🔴 Em Atraso: ${d.totalAtrasado}`,
      `🟡 Pendente: ${d.totalPendente}`,
      `📈 Inadimplência: ${d.inadimplencia}`,
      `📅 Próximos 30 dias: ${d.recebimentoProximos30Dias}`,
      '',
      `👥 Clientes: ${d.totalClientes}`,
      `📄 Notas Fiscais: ${d.totalNfes}`,
    ].join('\n');
  }

  private async getReceivablesListText(): Promise<string> {
    const result = await this.execGetReceivables({ limit: 10 });
    if (!result.success) return 'Erro ao buscar recebíveis.';
    const d = JSON.parse(result.data);
    if (d.items.length === 0) return 'Nenhum recebível encontrado.';

    const lines = d.items.map((item: any, i: number) =>
      `${i + 1}. ${item.cliente} — ${item.valor} (vence ${item.vencimento}) — ${item.status}`
    );

    return [`📋 *Últimos Recebíveis (${d.total} total)*`, '', ...lines, '', 'Use /ajuda para mais comandos.'].join('\n');
  }

  private async getReportText(): Promise<string> {
    const status = await this.execGetSummary();
    if (!status.success) return 'Erro ao gerar relatório.';
    const s = JSON.parse(status.data);

    const overdue = await this.execGetOverdueList({ limit: 3 });
    const overdueData = JSON.parse(overdue.data);
    const overdueLines = overdueData.items?.length
      ? overdueData.items.map((item: any, i: number) => `${i + 1}. ${item.cliente} — ${item.valor} (${item.parcelas} parcelas)`)
      : ['Nenhum cliente em atraso.'];

    const upcoming = await this.execGetUpcoming({ days: 30, limit: 3 });
    const upcomingData = JSON.parse(upcoming.data);
    const upcomingLines = upcomingData.items?.length
      ? upcomingData.items.map((item: any, i: number) => `${i + 1}. ${item.cliente} — ${item.valor} (vence ${item.vencimento})`)
      : ['Nenhum recebível a vencer.'];

    return [
      '📑 *Relatório Financeiro*', '',
      '*Resumo:*',
      `💰 Total a Receber: ${s.totalAReceber}`,
      `✅ Recebido no Mês: ${s.totalRecebidoMes}`,
      `🔴 Em Atraso: ${s.totalAtrasado}`,
      `📈 Inadimplência: ${s.inadimplencia}`, '',
      '*🔴 Maiores Devedores:*', ...overdueLines, '',
      '*📅 Próximos Vencimentos (30 dias):*', ...upcomingLines, '',
      '_Relatório gerado automaticamente pelo SisFin._',
    ].join('\n');
  }

  private getHelpText(): string {
    return [
      '🤖 *SisFin Bot — Ajuda*', '',
      '💳 *Financeiro:*',
      '📊 /status — Resumo financeiro',
      '📋 /recebiveis — Lista recebíveis',
      '📑 /relatorio — Relatório completo', '',
      '🖥️ *Servidor:*',
      '/servidor — CPU, RAM, disco, uptime',
      '/servicos — Status dos containers Docker',
      '/discos — Armazenamento por projeto', '',
      '🧠 *Ou pergunte em texto livre!*',
      '• "Quanto está em atraso?"',
      '• "O servidor está pesado?"',
      '• "Reinicia o financas-api"',
      '• "Mostra logs do banco"',
      '• "Qual o total a receber?"',
    ].join('\n');
  }

  async setCommands(): Promise<void> {
    try {
      const commands = [
        { command: 'start', description: 'Mostrar ajuda e comandos disponíveis' },
        { command: 'status', description: 'Resumo financeiro do sistema' },
        { command: 'recebiveis', description: 'Listar recebíveis recentes' },
        { command: 'relatorio', description: 'Relatório financeiro completo' },
        { command: 'servidor', description: 'Status do servidor (CPU, RAM, disco)' },
        { command: 'servicos', description: 'Status dos containers Docker' },
        { command: 'discos', description: 'Armazenamento por projeto' },
      ];
      await axios.post(`${this.apiBase}/setMyCommands`, { commands }, { timeout: 10000 });
      this.logger.log('Telegram commands registered successfully');
    } catch (error: any) {
      this.logger.error(`Failed to register Telegram commands: ${error.message}`);
    }
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    try {
      await axios.post(`${this.apiBase}/sendMessage`, {
        chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true,
      }, { timeout: 15000 });
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram message: ${error.message}`);
    }
  }

  private async sendChatAction(chatId: number): Promise<void> {
    try {
      await axios.post(`${this.apiBase}/sendChatAction`, {
        chat_id: chatId, action: 'typing',
      }, { timeout: 5000 });
    } catch { /* ignore */ }
  }
}
