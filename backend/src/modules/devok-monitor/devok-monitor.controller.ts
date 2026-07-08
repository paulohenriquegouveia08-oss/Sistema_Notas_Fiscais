import { Controller, Get, Res, Param, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const MONITOR_DIR = path.join(process.cwd(), 'uploads', 'devok-monitor');

@Controller('devok-monitor')
export class DevokMonitorController {
  @Get('download/:filename')
  async download(@Param('filename') filename: string, @Res() res: Response) {
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new NotFoundException('Arquivo inválido');
    }

    const filePath = path.join(MONITOR_DIR, filename);
    const resolved = path.resolve(filePath);
    const allowedBase = path.resolve(MONITOR_DIR);

    if (!resolved.startsWith(allowedBase)) {
      throw new NotFoundException('Caminho inválido');
    }

    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    const stat = fs.statSync(resolved);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (filename.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
    } else if (filename.endsWith('.py')) {
      res.setHeader('Content-Type', 'text/plain');
    } else if (filename.endsWith('.bat')) {
      res.setHeader('Content-Type', 'application/x-bat');
    } else if (filename.endsWith('.txt')) {
      res.setHeader('Content-Type', 'text/plain');
    }

    const stream = fs.createReadStream(resolved);
    stream.pipe(res);
  }
}
