import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SystemMetrics {
  cpuUsage: string;
  cpuCores: number;
  ramTotal: string;
  ramUsed: string;
  ramUsagePercent: string;
  diskTotal: string;
  diskUsed: string;
  diskAvailable: string;
  diskUsagePercent: string;
  uptime: string;
}

export interface ContainerInfo {
  name: string;
  status: string;
  cpu: string;
  memory: string;
  image: string;
  ports: string;
  uptime?: string;
}

export interface ProjectDiskInfo {
  name: string;
  size: string;
  path: string;
}

@Injectable()
export class ServerMonitorService {
  private readonly logger = new Logger(ServerMonitorService.name);

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [memInfo, cpuInfo, uptimeSecs] = await Promise.all([
        this.readProcFile('meminfo'),
        this.readProcFile('stat'),
        this.readProcFile('uptime'),
      ]);

      const ramTotal = this.parseMemTotal(memInfo);
      const ramAvailable = this.parseMemAvailable(memInfo);
      const ramUsed = ramTotal - ramAvailable;
      const ramUsagePercent = ramTotal > 0 ? ((ramUsed / ramTotal) * 100).toFixed(1) : '0';

      const cpuCores = this.parseCpuCores(cpuInfo);
      const cpuUsage = await this.getCpuUsage(cpuInfo);

      const uptime = this.formatUptime(parseFloat(uptimeSecs.split(' ')[0] || '0'));

      let diskTotal = 'N/A';
      let diskUsed = 'N/A';
      let diskAvailable = 'N/A';
      let diskUsagePercent = 'N/A';

      try {
        const { stdout } = await execAsync('df -h / | tail -1');
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 6) {
          diskTotal = parts[1];
          diskUsed = parts[2];
          diskAvailable = parts[3];
          diskUsagePercent = parts[4];
        }
      } catch {
        const { stdout } = await execAsync('df -h /host/root 2>/dev/null | tail -1');
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 6) {
          diskTotal = parts[1];
          diskUsed = parts[2];
          diskAvailable = parts[3];
          diskUsagePercent = parts[4];
        }
      }

      return {
        cpuUsage,
        cpuCores,
        ramTotal: this.formatBytes(ramTotal * 1024),
        ramUsed: this.formatBytes(ramUsed * 1024),
        ramUsagePercent: `${ramUsagePercent}%`,
        diskTotal,
        diskUsed,
        diskAvailable,
        diskUsagePercent,
        uptime,
      };
    } catch (error: any) {
      this.logger.error(`Error getting system metrics: ${error.message}`);
      return {
        cpuUsage: 'N/A', cpuCores: 0,
        ramTotal: 'N/A', ramUsed: 'N/A', ramUsagePercent: 'N/A',
        diskTotal: 'N/A', diskUsed: 'N/A', diskAvailable: 'N/A', diskUsagePercent: 'N/A',
        uptime: 'N/A',
      };
    }
  }

  async getContainerList(): Promise<ContainerInfo[]> {
    try {
      const { stdout } = await execAsync('docker ps -a --format \'{"name":"{{.Names}}","status":"{{.Status}}","image":"{{.Image}}","ports":"{{.Ports}}"}\'');
      const lines = stdout.trim().split('\n').filter(Boolean);

      const containers: ContainerInfo[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const stats = await this.getContainerStats(parsed.name);
          containers.push({
            name: parsed.name,
            status: parsed.status,
            cpu: stats.cpu,
            memory: stats.memory,
            image: parsed.image,
            ports: parsed.ports || '—',
            uptime: parsed.status.includes('Up') ? parsed.status.replace('Up ', '').trim() : undefined,
          });
        } catch {
          containers.push({
            name: line,
            status: 'unknown',
            cpu: 'N/A',
            memory: 'N/A',
            image: 'N/A',
            ports: 'N/A',
          });
        }
      }

      return containers;
    } catch (error: any) {
      this.logger.error(`Error listing containers: ${error.message}`);
      return [];
    }
  }

  private async getContainerStats(name: string): Promise<{ cpu: string; memory: string }> {
    try {
      const { stdout } = await execAsync(`docker stats ${name} --no-stream --format '{"cpu":"{{.CPUPerc}}","mem":"{{.MemPerc}}"}'`);
      const parsed = JSON.parse(stdout.trim());
      return { cpu: parsed.cpu || '0%', memory: parsed.mem || '0%' };
    } catch {
      return { cpu: 'N/A', memory: 'N/A' };
    }
  }

  async getContainerLogs(name: string, lines = 50): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs ${name} --tail ${lines} 2>&1`);
      return stdout;
    } catch (error: any) {
      return `Erro ao buscar logs: ${error.message}`;
    }
  }

  async restartContainer(name: string): Promise<string> {
    try {
      await execAsync(`docker restart ${name}`);
      return `Container ${name} reiniciado com sucesso.`;
    } catch (error: any) {
      return `Erro ao reiniciar ${name}: ${error.message}`;
    }
  }

  async getProjectDiskUsage(): Promise<ProjectDiskInfo[]> {
    const projects = [
      { name: 'Sistema NF-e (financas)', path: '/home/ubuntu/Sistema_Financas_Loja_Baterias' },
      { name: 'PK Fit Core API', path: '/home/ubuntu/pkfit-core-api' },
      { name: 'Advocacia Backend', path: '/home/ubuntu/advocacia-backend' },
    ];

    const results: ProjectDiskInfo[] = [];

    for (const project of projects) {
      try {
        const { stdout } = await execAsync(`du -sh ${project.path} 2>/dev/null | cut -f1`);
        const size = stdout.trim() || 'N/A';
        results.push({ ...project, size });
      } catch {
        results.push({ ...project, size: 'N/A' });
      }
    }

    try {
      const { stdout } = await execAsync("docker system df 2>/dev/null | head -4");
      const dockerLine = stdout.trim().split('\n').slice(-1)[0] || '';
      const parts = dockerLine.split(/\s+/);
      if (parts.length >= 4) {
        results.push({
          name: 'Docker (imagens/containers/volumes)',
          size: `${parts[2]} usado de ${parts[3]}`,
          path: '/var/lib/docker',
        });
      }
    } catch {
      // ignore
    }

    return results;
  }

  async getTotalDiskUsage(): Promise<string> {
    try {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $3 \"/\" $2 \" (\" $5 \")\"}'");
      return stdout.trim();
    } catch {
      return 'N/A';
    }
  }

  private async readProcFile(name: string): Promise<string> {
    const paths = [`/host/proc/${name}`, `/proc/${name}`];
    for (const p of paths) {
      try {
        return await readFile(p, 'utf-8');
      } catch {
        continue;
      }
    }
    throw new Error(`Cannot read /proc/${name}`);
  }

  private parseMemTotal(memInfo: string): number {
    const match = memInfo.match(/MemTotal:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseMemAvailable(memInfo: string): number {
    const match = memInfo.match(/MemAvailable:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseCpuCores(stat: string): number {
    const matches = stat.match(/^cpu\d+/gm);
    return matches?.length || 1;
  }

  private async getCpuUsage(initialStat: string): Promise<string> {
    try {
      const userMatch = initialStat.match(/^cpu\s+(\d+)/);
      if (!userMatch) return 'N/A';
      const initialIdle = this.parseCpuIdle(initialStat);
      const initialTotal = this.parseCpuTotal(initialStat);

      await new Promise((r) => setTimeout(r, 500));
      const currentStat = await this.readProcFile('stat');
      const currentIdle = this.parseCpuIdle(currentStat);
      const currentTotal = this.parseCpuTotal(currentStat);

      const idleDiff = currentIdle - initialIdle;
      const totalDiff = currentTotal - initialTotal;
      const usage = totalDiff > 0 ? ((1 - idleDiff / totalDiff) * 100).toFixed(1) : '0';
      return `${usage}%`;
    } catch {
      return 'N/A';
    }
  }

  private parseCpuIdle(stat: string): number {
    const parts = stat.match(/^cpu\s+([\d\s]+)$/m);
    if (!parts) return 0;
    const nums = parts[1].trim().split(/\s+/).map(Number);
    return nums[3] || 0; // idle is 4th column
  }

  private parseCpuTotal(stat: string): number {
    const parts = stat.match(/^cpu\s+([\d\s]+)$/m);
    if (!parts) return 0;
    const nums = parts[1].trim().split(/\s+/).map(Number);
    return nums.reduce((a, b) => a + b, 0);
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}min`);
    return parts.join(' ');
  }

  private formatBytes(bytes: number): string {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }
}
