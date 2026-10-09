import { query } from "./db";
import {
  CHAT_STATUSES,
  sanitizeChatText,
  type ChatSender,
  type ChatStatus,
} from "./chat-shared";

/**
 * Server-only data access for the customer chat.
 *
 * Imports `./db`, so nothing here may reach a client component. The rules the
 * widget also needs (limits, statuses, sanitiser) live in `./chat-shared` and are
 * re-exported at the bottom, so a route has one import to reach for.
 */

export * from "./chat-shared";

export interface ChatConversation {
  id: number;
  session_id: string;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  status: ChatStatus;
  assigned_admin_id: number | null;
  assigned_name: string | null;
  last_message_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender: ChatSender;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** A row in the admin inbox list, with the bits the sidebar needs pre-joined. */
export interface ConversationSummary extends ChatConversation {
  last_body: string | null;
  last_sender: ChatSender | null;
  unread_count: number;
  message_count: number;
}

export interface FaqRow {
  id: number;
  question_keywords: string;
  answer: string;
  active: boolean;
  sort_order: number;
}

const CONVERSATION_COLUMNS = `
  c.id, c.session_id, c.customer_name, c.phone, c.email, c.status,
  c.assigned_admin_id, c.last_message_at, c.created_at,
  s.full_name AS assigned_name`;

const FROM_CONVERSATION = `
  FROM chat_conversations c
  LEFT JOIN staff_users s ON s.id = c.assigned_admin_id`;

/* ------------------------------------------------------- conversations */

/** The visitor's live thread, if they still have one. */
export async function getOpenConversationBySession(
  sessionId: string,
): Promise<ChatConversation | null> {
  const rows = await query<ChatConversation>(
    `SELECT ${CONVERSATION_COLUMNS} ${FROM_CONVERSATION}
      WHERE c.session_id = $1 AND c.status <> 'closed'
      ORDER BY c.id DESC LIMIT 1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

/** Any thread for this session, open or closed. Used when rehydrating the panel. */
export async function getLatestConversationBySession(
  sessionId: string,
): Promise<ChatConversation | null> {
  const rows = await query<ChatConversation>(
    `SELECT ${CONVERSATION_COLUMNS} ${FROM_CONVERSATION}
      WHERE c.session_id = $1 ORDER BY c.id DESC LIMIT 1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function createConversation(sessionId: string): Promise<ChatConversation> {
  const rows = await query<ChatConversation>(
    `INSERT INTO chat_conversations (session_id) VALUES ($1)
     RETURNING id, session_id, customer_name, phone, email, status,
               assigned_admin_id, last_message_at, created_at`,
    [sessionId],
  );
  return rows[0];
}

/**
 * The thread for this session, opening a new one if the visitor has none or the
 * last one was closed. One call so the widget never has to branch on "exists".
 */
export async function getOrCreateConversation(
  sessionId: string,
): Promise<ChatConversation> {
  const existing = await getOpenConversationBySession(sessionId);
  if (existing) return existing;
  return createConversation(sessionId);
}

export async function getConversationById(
  id: number,
): Promise<ChatConversation | null> {
  const rows = await query<ChatConversation>(
    `SELECT ${CONVERSATION_COLUMNS} ${FROM_CONVERSATION} WHERE c.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Move a thread on. `needs_human` and `human` are sticky in one direction: a
 * visitor asking for a person again must not be answered by the assistant once a
 * staff member has already taken the thread, so nothing downgrades out of them.
 */
export async function setConversationStatus(
  id: number,
  status: ChatStatus,
  assignedAdminId?: number | null,
): Promise<ChatConversation | null> {
  if (!CHAT_STATUSES.includes(status)) return null;

  const sticky = status === "bot";
  const rows = await query<ChatConversation>(
    `UPDATE chat_conversations
        SET status = CASE
              WHEN $2 = 'bot' AND c.status IN ('needs_human','human') THEN c.status
              ELSE $2 END,
            assigned_admin_id = COALESCE($3, c.assigned_admin_id)
      WHERE id = $1
      RETURNING id, session_id, customer_name, phone, email, status,
                assigned_admin_id, last_message_at, created_at`,
    [id, sticky ? "bot" : status, assignedAdminId ?? null],
  );
  return rows[0] ?? null;
}

/** Name / phone / email, collected once and optional throughout. */
export async function saveConversationContact(
  id: number,
  contact: { name?: string | null; phone?: string | null; email?: string | null },
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `UPDATE chat_conversations
        SET customer_name = COALESCE(NULLIF($2, ''), customer_name),
            phone         = COALESCE(NULLIF($3, ''), phone),
            email         = COALESCE(NULLIF($4, ''), email)
      WHERE id = $1 RETURNING id`,
    [
      id,
      contact.name ? sanitizeChatText(contact.name, 150) : "",
      contact.phone ? sanitizeChatText(contact.phone, 32) : "",
      contact.email ? sanitizeChatText(contact.email, 255) : "",
    ],
  );
  return rows.length > 0;
}

/* ------------------------------------------------------------ messages */

/** Append a message and bump the thread's activity stamp in one statement pair. */
export async function addMessage(
  conversationId: number,
  sender: ChatSender,
  body: string,
): Promise<ChatMessage> {
  const rows = await query<ChatMessage>(
    `INSERT INTO chat_messages (conversation_id, sender, body)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, sender, body, created_at, read_at`,
    [conversationId, sender, body],
  );

  await query(
    `UPDATE chat_conversations SET last_message_at = NOW() WHERE id = $1`,
    [conversationId],
  );

  return rows[0];
}

export async function listMessages(
  conversationId: number,
  afterId = 0,
  limit = 200,
): Promise<ChatMessage[]> {
  return query<ChatMessage>(
    `SELECT id, conversation_id, sender, body, created_at, read_at
       FROM chat_messages
      WHERE conversation_id = $1 AND id > $2
      ORDER BY id ASC
      LIMIT $3`,
    [conversationId, afterId, Math.min(Math.max(limit, 1), 500)],
  );
}

/** The most recent turns, oldest-first, for the assistant's own context window. */
export async function recentMessages(
  conversationId: number,
  limit = 12,
): Promise<ChatMessage[]> {
  const rows = await query<ChatMessage>(
    `SELECT id, conversation_id, sender, body, created_at, read_at
       FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY id DESC
      LIMIT $2`,
    [conversationId, Math.min(Math.max(limit, 1), 50)],
  );
  return rows.reverse();
}

/** Mark everything currently unread as read, for the admin inbox. */
export async function markConversationRead(conversationId: number): Promise<void> {
  await query(
    `UPDATE chat_messages SET read_at = NOW()
      WHERE conversation_id = $1 AND read_at IS NULL`,
    [conversationId],
  );
}

/** Unread customer messages across all open threads: the sidebar badge. */
export async function countUnreadMessages(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM chat_messages m
       JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.read_at IS NULL AND m.sender = 'customer' AND c.status <> 'closed'`,
  );
  return Number(rows[0]?.count ?? 0);
}

/** How many conversations are waiting on a person. Shown on the Messages page. */
export async function countNeedsHuman(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM chat_conversations WHERE status = 'needs_human'`,
  );
  return Number(rows[0]?.count ?? 0);
}

/* ------------------------------------------------------- admin listing */

export interface ListConversationsParams {
  status?: string;
  q?: string;
  page?: number;
  perPage?: number;
}

export async function listConversations(
  params: ListConversationsParams,
): Promise<{ rows: ConversationSummary[]; total: number; page: number; perPage: number; pageCount: number }> {
  const perPage = Math.min(Math.max(params.perPage ?? 30, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * perPage;

  const where: string[] = [];
  const args: unknown[] = [];

  if (params.status && CHAT_STATUSES.includes(params.status as ChatStatus)) {
    args.push(params.status);
    where.push(`c.status = $${args.length}`);
  }

  const q = params.q?.trim();
  if (q) {
    args.push(`%${q}%`);
    const i = args.length;
    where.push(
      `(c.customer_name ILIKE $${i} OR c.phone ILIKE $${i} OR c.email ILIKE $${i}` +
        ` OR EXISTS (SELECT 1 FROM chat_messages sm
                      WHERE sm.conversation_id = c.id AND sm.body ILIKE $${i}))`,
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM chat_conversations c ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.count ?? 0);

  args.push(perPage, offset);
  const rows = await query<ConversationSummary>(
    `SELECT ${CONVERSATION_COLUMNS},
            lm.body AS last_body,
            lm.sender AS last_sender,
            (SELECT COUNT(*)::int FROM chat_messages um
              WHERE um.conversation_id = c.id
                AND um.read_at IS NULL AND um.sender = 'customer') AS unread_count,
            (SELECT COUNT(*)::int FROM chat_messages tm
              WHERE tm.conversation_id = c.id) AS message_count
       ${FROM_CONVERSATION}
       LEFT JOIN LATERAL (
         SELECT body, sender FROM chat_messages
          WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
       ) lm ON TRUE
       ${whereSql}
      ORDER BY c.last_message_at DESC, c.id DESC
      LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    rows,
    total,
    page,
    perPage,
    pageCount: Math.max(Math.ceil(total / perPage), 1),
  };
}

/* ----------------------------------------------------------------- faq */

/** Active answers, best keyword-hit first. This is the sub-second reply layer. */
export async function listActiveFaq(): Promise<FaqRow[]> {
  return query<FaqRow>(
    `SELECT id, question_keywords, answer, active, sort_order
       FROM chat_faq
      WHERE active = TRUE
      ORDER BY sort_order ASC, id ASC`,
  );
}

export async function listAllFaq(): Promise<FaqRow[]> {
  return query<FaqRow>(
    `SELECT id, question_keywords, answer, active, sort_order
       FROM chat_faq
      ORDER BY sort_order ASC, id ASC`,
  );
}

export async function upsertFaq(input: {
  id?: number | null;
  questionKeywords: string;
  answer: string;
  active: boolean;
  sortOrder: number;
}): Promise<FaqRow | null> {
  const keywords = sanitizeChatText(input.questionKeywords, 500);
  const answer = sanitizeChatText(input.answer, 4000);
  if (!keywords || !answer) return null;

  if (input.id) {
    const rows = await query<FaqRow>(
      `UPDATE chat_faq
          SET question_keywords = $2, answer = $3, active = $4,
              sort_order = $5, updated_at = NOW()
        WHERE id = $1
      RETURNING id, question_keywords, answer, active, sort_order`,
      [input.id, keywords, answer, input.active, input.sortOrder],
    );
    return rows[0] ?? null;
  }

  const rows = await query<FaqRow>(
    `INSERT INTO chat_faq (question_keywords, answer, active, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, question_keywords, answer, active, sort_order`,
    [keywords, answer, input.active, input.sortOrder],
  );
  return rows[0] ?? null;
}

export async function deleteFaq(id: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `DELETE FROM chat_faq WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

/* ------------------------------------------------------------- settings */

/**
 * Whether the assistant layer may run at all. Needs both the admin switch and a
 * configured provider key, so turning it on before setting the key is a no-op
 * rather than an error in the visitor's face.
 */
export async function isAiEnabled(): Promise<boolean> {
  try {
    const rows = await query<{ value: unknown }>(
      `SELECT value FROM settings WHERE key = 'chat.ai_enabled'`,
    );
    if (rows.length === 0) return false;
    const on = rows[0].value;
    if (on === false || on === "false") return false;
  } catch {
    return false;
  }
  return Boolean(process.env.AI_API_KEY);
}

export async function setAiEnabled(enabled: boolean): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('chat.ai_enabled', $1::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(enabled)],
  );
}