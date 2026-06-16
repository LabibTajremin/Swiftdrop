import { z } from 'zod';

export const PARCEL_STATUSES = [
  'registered',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'failed',
] as const;

export const CreateParcelSchema = z.object({
  tracking_number: z.string().min(1, 'Tracking number is required'),
  sender_name: z.string().min(1, 'Sender name is required'),
  sender_address: z.string().min(1, 'Sender address is required'),
  receiver_name: z.string().min(1, 'Receiver name is required'),
  receiver_address: z.string().min(1, 'Receiver address is required'),
});
export type CreateParcelDto = z.infer<typeof CreateParcelSchema>;

export const UpdateParcelStatusSchema = z.object({
  status: z.enum(PARCEL_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${PARCEL_STATUSES.join(', ')}` }),
  }),
});
export type UpdateParcelStatusDto = z.infer<typeof UpdateParcelStatusSchema>;

export const ListParcelsQuerySchema = z.object({
  status: z.enum(PARCEL_STATUSES).optional(),
  agent_id: z.string().uuid('agent_id must be a valid UUID').optional(),
  sender_name: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListParcelsQueryDto = z.infer<typeof ListParcelsQuerySchema>;
