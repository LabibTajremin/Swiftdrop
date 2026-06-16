import { z } from 'zod';

export const DELIVERY_EVENT_TYPES = [
  'registered',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'failed_attempt',
  'requeued',
] as const;

export const CreateEventSchema = z.object({
  parcel_id: z.string().uuid({ message: 'parcel_id must be a valid UUID' }),
  event_type: z.enum(DELIVERY_EVENT_TYPES, {
    errorMap: () => ({ message: `event_type must be one of: ${DELIVERY_EVENT_TYPES.join(', ')}` }),
  }),
  notes: z.string().min(1).optional(),
  occurred_at: z.string().datetime({ message: 'occurred_at must be a valid ISO 8601 datetime' }).optional(),
});
export type CreateEventDto = z.infer<typeof CreateEventSchema>;
