import type { Request, Response } from 'express';
import { getCustomer, getCustomers } from '../services/customer/getCustomers';
import { getCustomerOrders } from '../services/customer/getCustomerOrders';
import { validationError } from '../utils/errors';
import { customerIdParamSchema } from '../validation/customer.schemas';
import { toFieldErrors } from '../validation/common.schemas';

function parseCustomerId(req: Request): string {
  const parsed = customerIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw validationError('Invalid customer id.', toFieldErrors(parsed.error));
  }
  return parsed.data.id;
}

export async function getCustomersController(_req: Request, res: Response): Promise<void> {
  res.json(await getCustomers());
}

export async function getCustomerController(req: Request, res: Response): Promise<void> {
  res.json(await getCustomer(parseCustomerId(req)));
}

export async function getCustomerOrdersController(req: Request, res: Response): Promise<void> {
  res.json(await getCustomerOrders(parseCustomerId(req)));
}
