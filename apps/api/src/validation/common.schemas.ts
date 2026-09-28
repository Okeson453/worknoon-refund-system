import { z } from 'zod';
import { ID_MAX_LENGTH } from '../config/constants';

/** Identifiers are opaque strings from the CRM (CUST-001, ORD-1001, ITM-1001-1). */
export const identifierSchema = z
  .string({ required_error: 'Identifier is required.' })
  .trim()
  .min(1, 'Identifier must not be empty.')
  .max(ID_MAX_LENGTH, `Identifier must be at most ${ID_MAX_LENGTH} characters.`)
  .regex(/^[A-Za-z0-9_-]+$/, 'Identifier contains unsupported characters.');

export const idParamSchema = z.object({ id: identifierSchema });

export interface FieldError {
  path: string;
  message: string;
}

export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}
