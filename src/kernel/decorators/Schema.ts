import { z } from 'zod';

export function Schema(schema: z.ZodSchema): ClassDecorator {
  return (target: any) => {
    target.schema = schema;
  };
}

export function getSchema(target: any): z.ZodSchema | undefined {
  return target.constructor.schema;
}
