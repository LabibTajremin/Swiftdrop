import { z } from 'zod';

export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
});
export type CreateAgentDto = z.infer<typeof CreateAgentSchema>;

export const UpdateAvailabilitySchema = z.object({
  is_available: z.boolean({ required_error: 'is_available is required', invalid_type_error: 'is_available must be a boolean' }),
});
export type UpdateAvailabilityDto = z.infer<typeof UpdateAvailabilitySchema>;

export const AssignParcelBodySchema = z.object({
  parcel_id: z.string().uuid('parcel_id must be a valid UUID'),
});
export type AssignParcelBodyDto = z.infer<typeof AssignParcelBodySchema>;
