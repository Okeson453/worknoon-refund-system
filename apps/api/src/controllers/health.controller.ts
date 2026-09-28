import type { Request, Response } from 'express';
import type { HealthResponse } from '@worknoon/shared-types';
import { describeAiProvider } from '../ai/ai.provider';
import { checkDatabaseConnection } from '../database/prisma';

export async function healthController(_req: Request, res: Response): Promise<void> {
  const databaseUp = await checkDatabaseConnection();
  const ai = describeAiProvider();
  const body: HealthResponse = {
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'ok' : 'down',
    ai: ai.health,
    aiProvider: ai.name,
    timestamp: new Date().toISOString(),
  };
  res.status(databaseUp ? 200 : 503).json(body);
}
