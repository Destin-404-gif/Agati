-- Customer chat: the public widget's conversations and the admin inbox behind them.
--
-- Additive and idempotent, like every other file in this folder, so it can be run
-- against a populated database and re-run safely:
--
--   npm run db:migrate
--
-- The runner (scripts/setup-migrations.mjs) readdir's this folder and applies
-- each file in name order, so nothing needs registering elsewhere. `db/schema.sql`
-- also creates these tables, which is what a fresh `npm run db:setup` uses.
--
-- Design notes:
--
--   * `session_id` is an opaque id the widget stores in a cookie. It is the only
--     thing tying an anonymous visitor to their thread — there is no account and
--     no sign-up, so it is deliberately not a personal identifier.
--   * `status` is a free-form VARCHAR enforced by zod in the app, matching the
--     order/quote columns. `bot` is self-serve, `needs_human` is the handoff
--     queue, `human` means a staff member has replied, `closed` is done.
--   * `last_message_at` is denormalised so the inbox can sort by activity
--     without grouping through the messages table.
--   * Nothing here stores payment details or anything else sensitive; name,
--     phone and email are asked for once, optionally, purely so a staff member
--     can reply.
--
-- Real-time delivery is Server-Sent Events. The endpoints poll this table on a
-- short interval and push changes out, which works on any plain Node host — no
-- websocket infrastructure, and no extra process to keep alive.

-- --------------------------------------------------- chat_conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
  id SERIAL PRIMARY KEY,
  -- Anonymous visitor handle from the widget's cookie. Indexed because every
  -- customer request looks a thread up by this alone.
  session_id VARCHAR(64) NOT NULL,
  -- Optional, collected only after the first message. Never required.
  customer_name VARCHAR(150),
  phone         VARCHAR(32),
  email         VARCHAR(255),
  -- 'bot' | 'needs_human' | 'human' | 'closed'  (enforced in src/lib/chat.ts)
  status        VARCHAR(20) NOT NULL DEFAULT 'bot',
  assigned_admin_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  -- Denormalised activity stamp: the inbox sorts and filters on this directly.
  last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- One live thread per visitor session. Partial, because a returning visitor who
-- closed their previous thread should be able to start a fresh one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_session
  ON chat_conversations (session_id) WHERE status <> 'closed';

-- The inbox's primary read: newest activity first, and the "needs human" queue.
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message
  ON chat_conversations (last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_status
  ON chat_conversations (status, last_message_at DESC);

-- --------------------------------------------------------- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  -- 'customer' | 'bot' | 'admin'
  sender VARCHAR(20) NOT NULL DEFAULT 'customer',
  body   TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Set when staff open the thread. Only meaningful for customer messages.
  read_at TIMESTAMP
);

-- Thread read in order, and the SSE endpoints' "everything after id N" poll.
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages (conversation_id, id);

-- Unread counts for the admin badge, without scanning every row.
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON chat_messages (conversation_id) WHERE read_at IS NULL;

-- -------------------------------------------------------------- chat_faq
-- The instant-answer layer. Each row is a keyword list and the reply to send
-- when a customer's question matches it, managed from the admin FAQ page so the
-- workshop can correct an answer without a deploy.
CREATE TABLE IF NOT EXISTS chat_faq (
  id SERIAL PRIMARY KEY,
  -- Comma-separated keywords, matched case-insensitively as whole words.
  question_keywords VARCHAR(500) NOT NULL,
  answer TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_faq_active
  ON chat_faq (active, sort_order);

-- Seed answers for the questions the workshop is actually asked. Guarded by NOT
-- EXISTS rather than ON CONFLICT so an admin's later edits to these rows are
-- never overwritten by a re-run.
INSERT INTO chat_faq (question_keywords, answer, active, sort_order)
SELECT * FROM (VALUES
  (
    'opening, open, hours, opening hours, working hours, when open, what time, close, closing time',
    'The workshop is open Monday to Saturday, 8:00am to 6:00pm. We are closed on Sundays. If you message outside those hours we will reply first thing the next morning.',
    TRUE, 10
  ),
  (
    'location, where, address, musanze, rwanda, directions, find you, located, where are you',
    'We are in Musanze, Rwanda, in the Musanze Industrial Zone. Come by during opening hours and we will show you the timber stock on the rack.',
    TRUE, 20
  ),
  (
    'delivery, deliver, shipping, transport, bring it, drop off, collect, pickup',
    'We deliver anywhere in Musanze and the wider Northern Province. Delivery is quoted per piece depending on size, weight and distance, so the workshop confirms the exact figure before any order is placed.',
    TRUE, 30
  ),
  (
    'payment, pay, payments, mobile money, cash, instal, deposit, card, bank',
    'We accept cash and mobile money for local orders, and bank transfer for larger commissions. A deposit is usually asked for on made-to-measure work before we start cutting.',
    TRUE, 40
  ),
  (
    'material, materials, timber, wood, oak, walnut, teak, mahogany, finish, species',
    'Everything is solid timber, chosen per piece: oak, walnut, ash, mahogany, iroko and teak for outdoor work. Finishes are hardwax oil or lacquer. We are happy to talk you through which suits the piece and the room.',
    TRUE, 50
  ),
  (
    'custom, custom furniture, bespoke, made to measure, made-to-measure, commission, one off',
    'Made-to-measure work is the heart of the workshop. Every piece is drawn first, then built to your dimensions, your timber and your timeline. Use Request a Quote and tell us what you have in mind.',
    TRUE, 60
  ),
  (
    'quote, quotation, request a quote, price, pricing, cost, how much, budget, estimate',
    'Pricing depends on size, timber and complexity, so the workshop quotes each piece by hand. Request a Quote and describe what you want, or Talk to a person and we will work it out with you.',
    TRUE, 70
  ),
  (
    'contact, phone, number, call, email, gmail, reach, whatsapp, telephone',
    'You can reach us on 0784088929 or email agatiwoodworks@gmail.com. WhatsApp on the same number is the quickest way to get a picture of a piece across.',
    TRUE, 80
  ),
  (
    'international, export, ship overseas, abroad, outside rwanda, country',
    'We mostly supply Rwanda and the region, but we have shipped further afield before. Message us with your country and we will tell you honestly what is realistic.',
    TRUE, 90
  ),
  (
    'repair, repairs, fix, restore, refinish, restore old, broken',
    'Yes — we restore and repair pieces, including furniture that was not made here. Bring it in or send photographs through WhatsApp and we will quote the work.',
    TRUE, 100
  )
) AS seed (question_keywords, answer, active, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM chat_faq f WHERE LOWER(f.question_keywords) = LOWER(seed.question_keywords)
);

-- ------------------------------------------------------- assistant toggle
-- The AI layer is off until a provider key is configured AND this is switched on,
-- so a fresh install never calls out to a third party by surprise.
INSERT INTO settings (key, value)
SELECT 'chat.ai_enabled', 'false'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'chat.ai_enabled');

-- --------------------------------------------------------- permissions
-- Two keys rather than borrowing `quotes.*`. A conversation is a live channel
-- with an address and a phone number on it, so it should be grantable
-- independently of the quote inbox.
--
-- Granted to the same roles that already handle quotes (Admin, Staff, Super
-- Admin) and deliberately not to Editor, who runs the storefront and has no
-- customer contact data. Matches on key so re-running cannot duplicate grants.
INSERT INTO permissions (key, description)
SELECT * FROM (VALUES
  ('chat.view',   'Read customer chat conversations in the admin inbox.'),
  ('chat.edit',   'Reply to, reassign, close and convert customer chat conversations.')
) AS p (key, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions e WHERE e.key = p.key);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.key IN ('chat.view', 'chat.edit')
 WHERE r.slug IN ('super-admin', 'admin', 'staff')
ON CONFLICT DO NOTHING;