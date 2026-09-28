import { z } from 'zod';
import { identifierSchema } from './common.schemas';

export const customerIdParamSchema = z.object({ id: identifierSchema });
