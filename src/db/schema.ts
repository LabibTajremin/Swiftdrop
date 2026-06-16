import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const parcelStatusEnum = pgEnum('parcel_status', [
  'registered',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'failed',
]);

export const deliveryEventTypeEnum = pgEnum('delivery_event_type', [
  'registered',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'failed_attempt',
  'requeued',
]);

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const parcels = pgTable(
  'parcels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackingNumber: text('tracking_number').notNull().unique(),
    senderName: text('sender_name').notNull(),
    senderAddress: text('sender_address').notNull(),
    receiverName: text('receiver_name').notNull(),
    receiverAddress: text('receiver_address').notNull(),
    status: parcelStatusEnum('status').default('registered').notNull(),
    assignedAgentId: uuid('assigned_agent_id').references(() => agents.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('parcels_tracking_number_idx').on(table.trackingNumber),
    index('parcels_status_idx').on(table.status),
    index('parcels_assigned_agent_id_idx').on(table.assignedAgentId),
  ],
);

export const deliveryEvents = pgTable(
  'delivery_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parcelId: uuid('parcel_id')
      .notNull()
      .references(() => parcels.id),
    eventType: deliveryEventTypeEnum('event_type').notNull(),
    notes: text('notes'),
    occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  },
  (table) => [
    index('delivery_events_parcel_id_idx').on(table.parcelId),
  ],
);
