import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface HealthCheckResponse {
  status: 'up' | 'down';
  details: {
    fastapi: {
      status: string;
      latency_ms: number;
      error?: string;
    };
  };
}

@Injectable()
export class FastAPIHealthIndicator {
  private readonly logger = new Logger(FastAPIHealthIndicator.name);

  constructor(private readonly configService: ConfigService) {}

  async check(): Promise<HealthCheckResponse> {
    const start = Date.now();
    const enabled = this.configService.get<boolean>('health.fastapiEnabled', false);
    if (!enabled) {
      return { status: 'up', details: { fastapi: { status: 'disabled', latency_ms: 0 } } };
    }
    const url = this.configService.get<string>('health.fastapi');
    
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      const latencyMs = Date.now() - start;
      
      return {
        status: 'up',
        details: {
          fastapi: {
            status: latencyMs > 500 ? 'degraded' : 'up',
            latency_ms: latencyMs,
          },
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.logger.error(`FastAPI health check failed: ${(error as Error).message}`);
      return {
        status: 'down',
        details: {
          fastapi: {
            status: 'down',
            latency_ms: latencyMs,
            error: (error as Error).message,
          },
        },
      };
    }
  }
}
