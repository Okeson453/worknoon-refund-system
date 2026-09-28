import type { Request, Response } from 'express';
import { getDashboardSummary } from '../services/dashboard/getDashboardSummary';

export async function getDashboardSummaryController(_req: Request, res: Response): Promise<void> {
  res.json(await getDashboardSummary());
}
