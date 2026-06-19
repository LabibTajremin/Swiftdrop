import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Clearing existing demo data...');
    await client.query(`
      DELETE FROM delivery_events
      WHERE parcel_id IN (
        SELECT id FROM parcels WHERE tracking_number LIKE 'TRK-2026-0%'
      )
    `);
    await client.query(`DELETE FROM parcels WHERE tracking_number LIKE 'TRK-2026-0%'`);
    await client.query(`DELETE FROM agents WHERE phone LIKE '+44-demo-%'`);

    console.log('Inserting agents...');
    await client.query(`
      INSERT INTO agents (id, name, phone, is_available, created_at, updated_at) VALUES
        ('a1000000-0000-0000-0000-000000000001', 'Marcus Webb',   '+44-demo-0001', false, '2026-06-01T08:00:00Z', '2026-06-18T09:30:00Z'),
        ('a2000000-0000-0000-0000-000000000002', 'Sofia Patel',   '+44-demo-0002', true,  '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z'),
        ('a3000000-0000-0000-0000-000000000003', 'Jordan Okafor', '+44-demo-0003', false, '2026-06-01T08:00:00Z', '2026-06-20T07:00:00Z'),
        ('a4000000-0000-0000-0000-000000000004', 'Priya Nair',    '+44-demo-0004', true,  '2026-06-01T08:00:00Z', '2026-06-17T11:45:00Z'),
        ('a5000000-0000-0000-0000-000000000005', 'Elias Frost',   '+44-demo-0005', true,  '2026-06-05T10:00:00Z', '2026-06-05T10:00:00Z')
    `);

    console.log('Inserting parcels...');
    await client.query(`
      INSERT INTO parcels (id, tracking_number, sender_name, sender_address, receiver_name, receiver_address, status, assigned_agent_id, created_at, updated_at) VALUES
        ('b1000000-0000-0000-0000-000000000001', 'TRK-2026-0001', 'Acme Corp',      '10 Commercial St, London E1 6RF',      'James Hooper',  '47 Maple Ave, Manchester M1 2AB',     'registered',       NULL,                                    '2026-06-20T07:00:00Z', '2026-06-20T07:00:00Z'),
        ('b2000000-0000-0000-0000-000000000002', 'TRK-2026-0002', 'BlueSky Ltd',    '5 Tech Park, Birmingham B1 1AA',       'Emma Clarke',   '22 Rose Lane, Leeds LS1 3BN',         'registered',       NULL,                                    '2026-06-20T08:00:00Z', '2026-06-20T08:00:00Z'),
        ('b3000000-0000-0000-0000-000000000003', 'TRK-2026-0003', 'Northern Goods', '88 Warehouse Rd, Sheffield S1 4EL',    'Daniel Kim',    '9 Birch Close, Liverpool L1 5TX',     'picked_up',        'a1000000-0000-0000-0000-000000000001', '2026-06-18T08:00:00Z', '2026-06-18T09:30:00Z'),
        ('b4000000-0000-0000-0000-000000000004', 'TRK-2026-0004', 'Swift Supplies', '3 Industrial Way, Bristol BS1 2CD',    'Aisha Rahman',  '14 Oak Street, Nottingham NG1 1JX',   'out_for_delivery', 'a1000000-0000-0000-0000-000000000001', '2026-06-18T07:00:00Z', '2026-06-18T10:00:00Z'),
        ('b5000000-0000-0000-0000-000000000005', 'TRK-2026-0005', 'Metro Traders',  '1 Market Place, Leeds LS1 6HJ',        'Tom Hendricks', '31 Pine Road, Edinburgh EH1 2AB',     'delivered',        'a4000000-0000-0000-0000-000000000004', '2026-06-17T06:00:00Z', '2026-06-17T11:45:00Z'),
        ('b6000000-0000-0000-0000-000000000006', 'TRK-2026-0006', 'Global Freight', '20 Export Dock, Southampton SO14 1AB', 'Lucy Wang',     '7 Elm Grove, Glasgow G1 3SZ',         'delivered',        'a4000000-0000-0000-0000-000000000004', '2026-06-16T08:00:00Z', '2026-06-16T13:00:00Z'),
        ('b7000000-0000-0000-0000-000000000007', 'TRK-2026-0007', 'Peak Parcel Co', '45 Summit St, Newcastle NE1 4DF',      'Sam Foster',    '88 Willow Way, Brighton BN1 2CD',     'failed',           'a1000000-0000-0000-0000-000000000001', '2026-06-19T10:00:00Z', '2026-06-19T14:00:00Z'),
        ('b8000000-0000-0000-0000-000000000008', 'TRK-2026-0008', 'Delta Dispatch', '12 Depot Lane, Cardiff CF10 1AB',      'Nina Osei',     '60 Cedar Blvd, Bristol BS1 5TH',      'failed',           NULL,                                    '2026-06-19T09:00:00Z', '2026-06-19T15:00:00Z')
    `);

    console.log('Inserting delivery events...');
    await client.query(`
      INSERT INTO delivery_events (id, parcel_id, event_type, notes, occurred_at) VALUES
        -- TRK-2026-0001 (registered)
        ('e1000000-0001-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'registered', NULL, '2026-06-20T07:00:00Z'),
        -- TRK-2026-0002 (registered)
        ('e2000000-0002-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'registered', NULL, '2026-06-20T08:00:00Z'),
        -- TRK-2026-0003 (picked_up)
        ('e3000000-0003-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000003', 'registered', NULL, '2026-06-18T08:00:00Z'),
        ('e3000000-0003-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000003', 'picked_up',  NULL, '2026-06-18T09:30:00Z'),
        -- TRK-2026-0004 (out_for_delivery)
        ('e4000000-0004-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000004', 'registered',      NULL, '2026-06-18T07:00:00Z'),
        ('e4000000-0004-0000-0000-000000000002', 'b4000000-0000-0000-0000-000000000004', 'picked_up',        NULL, '2026-06-18T08:15:00Z'),
        ('e4000000-0004-0000-0000-000000000003', 'b4000000-0000-0000-0000-000000000004', 'out_for_delivery', NULL, '2026-06-18T10:00:00Z'),
        -- TRK-2026-0005 (delivered — full lifecycle, used for history/reporting)
        ('e5000000-0005-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000005', 'registered',      NULL, '2026-06-17T06:00:00Z'),
        ('e5000000-0005-0000-0000-000000000002', 'b5000000-0000-0000-0000-000000000005', 'picked_up',        NULL, '2026-06-17T07:30:00Z'),
        ('e5000000-0005-0000-0000-000000000003', 'b5000000-0000-0000-0000-000000000005', 'out_for_delivery', NULL, '2026-06-17T09:00:00Z'),
        ('e5000000-0005-0000-0000-000000000004', 'b5000000-0000-0000-0000-000000000005', 'delivered',        NULL, '2026-06-17T11:45:00Z'),
        -- TRK-2026-0006 (delivered — second delivery for Priya Nair reporting)
        ('e6000000-0006-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000006', 'registered',      NULL, '2026-06-16T08:00:00Z'),
        ('e6000000-0006-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000006', 'picked_up',        NULL, '2026-06-16T09:00:00Z'),
        ('e6000000-0006-0000-0000-000000000003', 'b6000000-0000-0000-0000-000000000006', 'out_for_delivery', NULL, '2026-06-16T10:30:00Z'),
        ('e6000000-0006-0000-0000-000000000004', 'b6000000-0000-0000-0000-000000000006', 'delivered',        NULL, '2026-06-16T13:00:00Z'),
        -- TRK-2026-0007 (failed — for retry without reassign)
        ('e7000000-0007-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000007', 'registered',    NULL,                             '2026-06-19T10:00:00Z'),
        ('e7000000-0007-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000007', 'picked_up',      NULL,                             '2026-06-19T11:30:00Z'),
        ('e7000000-0007-0000-0000-000000000003', 'b7000000-0000-0000-0000-000000000007', 'failed_attempt', 'Customer not home, door locked', '2026-06-19T14:00:00Z'),
        -- TRK-2026-0008 (failed — for retry with reassign to Sofia Patel)
        ('e8000000-0008-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000008', 'registered',      NULL,                         '2026-06-19T09:00:00Z'),
        ('e8000000-0008-0000-0000-000000000002', 'b8000000-0000-0000-0000-000000000008', 'picked_up',        NULL,                         '2026-06-19T10:00:00Z'),
        ('e8000000-0008-0000-0000-000000000003', 'b8000000-0000-0000-0000-000000000008', 'out_for_delivery', NULL,                         '2026-06-19T11:30:00Z'),
        ('e8000000-0008-0000-0000-000000000004', 'b8000000-0000-0000-0000-000000000008', 'failed_attempt',   'Incorrect address provided', '2026-06-19T15:00:00Z')
    `);

    await client.query('COMMIT');

    console.log('\n✓ Demo data seeded successfully!\n');
    console.log('AGENTS');
    console.log('  a1..001  Marcus Webb    +44-demo-0001  UNAVAILABLE  (active: parcel3, parcel4, parcel7)');
    console.log('  a2..002  Sofia Patel    +44-demo-0002  available');
    console.log('  a3..003  Jordan Okafor  +44-demo-0003  UNAVAILABLE  (off duty)');
    console.log('  a4..004  Priya Nair     +44-demo-0004  available    (completed: parcel5, parcel6)');
    console.log('  a5..005  Elias Frost    +44-demo-0005  available    (no deliveries)');
    console.log('\nPARCELS');
    console.log('  b1..001  TRK-2026-0001  registered       no agent     (ready to assign)');
    console.log('  b2..002  TRK-2026-0002  registered       no agent     (ready to assign)');
    console.log('  b3..003  TRK-2026-0003  picked_up        Marcus Webb');
    console.log('  b4..004  TRK-2026-0004  out_for_delivery Marcus Webb');
    console.log('  b5..005  TRK-2026-0005  delivered        Priya Nair   (4 events in history)');
    console.log('  b6..006  TRK-2026-0006  delivered        Priya Nair   (4 events in history)');
    console.log('  b7..007  TRK-2026-0007  failed           Marcus Webb  (retry without reassign)');
    console.log('  b8..008  TRK-2026-0008  failed           no agent     (retry with Sofia Patel)');
    console.log('\nRe-run this script to reset state after mutating Postman requests.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
