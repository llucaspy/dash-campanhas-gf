import { getGmailIntelligenceSecrets, getGmailIntelligenceSettings, type GmailIntelligenceSettings } from "../appSettings";
import { db } from "../db";

interface GmailTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GmailMessageListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailProfileResponse {
  emailAddress?: string;
  historyId?: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    data?: string;
    size?: number;
    attachmentId?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

interface GmailMailboxRow {
  id: string;
}

interface ClassifiedAlert {
  matchedTargets: string[];
  reasons: { label: string; weight: number }[];
  priority: "low" | "normal" | "high" | "critical";
  score: number;
}

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TARGETED_SYNC_MAX_RESULTS = 100;
const RECENT_FALLBACK_MAX_RESULTS = 40;
const SEARCH_WINDOW_DAYS = 14;
const BODY_SEARCH_LIMIT = 12_000;

function normalize(value?: string | null) {
  return String(value || "").trim();
}

function lower(value?: string | null) {
  return normalize(value).toLowerCase();
}

function searchLower(value?: string | null) {
  return lower(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => normalize(item)).filter(Boolean)));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesSearchTerm(haystack: string, term: string) {
  const needle = searchLower(term);
  if (!needle) return false;

  if (needle.includes("@")) return haystack.includes(needle);
  if (/\s/.test(needle)) return haystack.includes(needle);

  return new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, "i").test(haystack);
}

function getHeader(message: GmailMessageResponse, name: string) {
  const target = lower(name);
  return message.payload?.headers?.find((header) => lower(header.name) === target)?.value || "";
}

function getAllHeadersText(message: GmailMessageResponse) {
  return (message.payload?.headers || []).map((header) => `${header.name}: ${header.value}`).join("\n");
}

function decodeBase64Url(value?: string) {
  if (!value) return "";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function collectBodyText(part?: GmailMessagePart, output: string[] = []) {
  if (!part) return output;

  const mimeType = lower(part.mimeType);
  const decoded = decodeBase64Url(part.body?.data);

  if (decoded) {
    if (mimeType.includes("text/html")) {
      output.push(stripHtml(decoded));
    } else if (mimeType.includes("text/plain") || !mimeType) {
      output.push(decoded);
    }
  }

  for (const child of part.parts || []) {
    collectBodyText(child, output);
  }

  return output;
}

function getMessageBodyText(message: GmailMessageResponse) {
  return collectBodyText(message.payload).join("\n").replace(/\s+/g, " ").trim().slice(0, BODY_SEARCH_LIMIT);
}

function buildSnippet(message: GmailMessageResponse, bodyText: string) {
  const source = normalize(message.snippet) || normalize(bodyText);
  return source.replace(/\s+/g, " ").trim().slice(0, 240);
}

function parseSender(value: string) {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) return { senderName: "", senderEmail: normalize(value) };

  return {
    senderName: normalize(match[1]).replace(/^"|"$/g, ""),
    senderEmail: normalize(match[2]).toLowerCase(),
  };
}

function matchImportantSender(from: string, settings: GmailIntelligenceSettings) {
  const senderEmail = lower(parseSender(from).senderEmail);
  const fromText = lower(from);

  return settings.importantSenders.find((sender) => {
    const importantSender = lower(sender);
    if (!importantSender) return false;
    return senderEmail === importantSender || fromText.includes(importantSender);
  });
}

function getReceivedAt(message: GmailMessageResponse) {
  const internalDate = Number(message.internalDate || 0);
  if (Number.isFinite(internalDate) && internalDate > 0) return new Date(internalDate).toISOString();

  const dateHeader = getHeader(message, "Date");
  const parsed = Date.parse(dateHeader);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function buildGmailUrl(message: GmailMessageResponse) {
  const threadId = message.threadId || message.id;
  return `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(threadId)}`;
}

function classifyMessage(message: GmailMessageResponse, settings: GmailIntelligenceSettings, bodyText = ""): ClassifiedAlert | null {
  const from = getHeader(message, "From");
  const subject = getHeader(message, "Subject");
  const to = getHeader(message, "To");
  const cc = getHeader(message, "Cc");
  const bcc = getHeader(message, "Bcc");
  const deliveredTo = getHeader(message, "Delivered-To");
  const originalTo = getHeader(message, "X-Original-To");
  const snippet = message.snippet || "";
  const contentSearchable = searchLower([subject, snippet, bodyText].join("\n"));
  const operationalSearchable = searchLower([subject, to, cc, bcc, snippet, bodyText].join("\n"));
  const explicitRecipientText = searchLower([to, cc, bcc].join("\n"));
  const envelopeRecipientText = searchLower([deliveredTo, originalTo].join("\n"));
  const monitoredMailbox = searchLower(settings.monitoredMailbox);
  const fromLower = searchLower(from);
  const ignored = settings.ignoredSenders.some((sender) => fromLower.includes(searchLower(sender)));
  const importantSender = matchImportantSender(from, settings);

  const targetMatches = settings.monitoredTargets
    .map((target) => {
      const targetLower = searchLower(target);
      if (!targetLower) return null;

      const explicit = includesSearchTerm(explicitRecipientText, target);
      const envelope = targetLower !== monitoredMailbox && includesSearchTerm(envelopeRecipientText, target);
      const contextual = includesSearchTerm(contentSearchable, target);

      if (!explicit && !envelope && !contextual) return null;
      return { target, explicit, envelope, contextual };
    })
    .filter(Boolean) as { target: string; explicit: boolean; envelope: boolean; contextual: boolean }[];

  const explicitTargets = unique(targetMatches.filter((item) => item.explicit).map((item) => item.target));
  const envelopeTargets = unique(targetMatches.filter((item) => item.envelope).map((item) => item.target));
  const contextualTargets = unique(targetMatches.filter((item) => !item.explicit && !item.envelope && item.contextual).map((item) => item.target));
  const matchedTargets = unique([...explicitTargets, ...envelopeTargets, ...contextualTargets]);
  const ownMailboxTargets = unique(explicitTargets.filter((target) => searchLower(target) === monitoredMailbox));
  const operationalRecipientTargets = unique(explicitTargets.filter((target) => searchLower(target) !== monitoredMailbox));

  const matchedKeywords = unique(
    settings.strongKeywords.filter((keyword) => {
      const keywordLower = searchLower(keyword);
      if (!keywordLower) return false;
      return includesSearchTerm(operationalSearchable, keyword);
    })
  );

  const reasons: { label: string; weight: number }[] = [];
  let score = 0;

  if (importantSender) {
    score += 7;
    reasons.push({ label: `Remetente importante de adserver: ${importantSender}.`, weight: 7 });
  }

  if (operationalRecipientTargets.length > 0) {
    score += 6;
    reasons.push({ label: "Alvo monitorado encontrado nos destinatarios principais.", weight: 6 });
  }

  if (ownMailboxTargets.length > 0) {
    score += 2;
    reasons.push({ label: "Lucas encontrado nos destinatarios principais.", weight: 2 });
  }

  if (envelopeTargets.length > 0) {
    score += 4;
    reasons.push({ label: "Alvo monitorado encontrado no encaminhamento ou grupo.", weight: 4 });
  }

  if (contextualTargets.length > 0) {
    score += 1;
    reasons.push({ label: "Alvo monitorado citado no contexto do email.", weight: 1 });
  }

  if (matchedKeywords.length > 0) {
    const weight = Math.min(4, matchedKeywords.length * 2);
    score += weight;
    reasons.push({ label: `Termos operacionais encontrados: ${matchedKeywords.slice(0, 4).join(", ")}.`, weight });
  }

  const searchableSubject = searchLower(subject);
  if (searchableSubject.includes("urgente") || searchableSubject.includes("aprova")) {
    score += 2;
    reasons.push({ label: "Assunto indica urgencia ou aprovacao.", weight: 2 });
  }

  if (ignored) {
    score -= 4;
    reasons.push({ label: "Remetente parece automatico ou pouco relevante.", weight: -4 });
  }

  const hasStrongRecipientSignal = operationalRecipientTargets.length > 0 || envelopeTargets.length > 0;
  const hasImportantSenderSignal = Boolean(importantSender);
  const hasLucasRecipientWithOperation = ownMailboxTargets.length > 0 && matchedKeywords.length > 0;
  const hasContextMentionWithOperation = contextualTargets.length > 0 && matchedKeywords.length > 0;
  const hasStrongKeywordSignal =
    matchedKeywords.length >= 2 ||
    hasLucasRecipientWithOperation ||
    hasContextMentionWithOperation ||
    searchableSubject.includes("urgente") ||
    searchableSubject.includes("aprova");

  if (score <= 0) return null;
  if (!hasImportantSenderSignal && !hasStrongRecipientSignal && !hasStrongKeywordSignal) return null;

  const priority = score >= 9 ? "critical" : score >= 6 ? "high" : score >= 3 ? "normal" : "low";

  return {
    matchedTargets,
    reasons,
    priority,
    score,
  };
}

async function gmailFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || data.error_description || `Falha na Gmail API (${response.status}).`);
  }

  return data as T;
}

async function getAccessToken() {
  const secrets = await getGmailIntelligenceSecrets();
  if (!secrets.clientId || !secrets.clientSecret || !secrets.refreshTokenLucas) {
    throw new Error("Client ID, Client Secret e Refresh Token Lucas precisam estar configurados.");
  }

  const body = new URLSearchParams({
    client_id: secrets.clientId,
    client_secret: secrets.clientSecret,
    refresh_token: secrets.refreshTokenLucas,
    grant_type: "refresh_token",
  });

  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as GmailTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Nao foi possivel renovar o token do Gmail.");
  }

  return data.access_token;
}

function quoteGmailSearchTerm(value: string) {
  const term = normalize(value)
    .replace(/[(){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!term) return "";
  const escaped = term.replace(/"/g, '\\"');
  if (/^[^\s]+@[^\s]+$/.test(escaped) || /\s/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

function buildTargetedSearchQuery(settings: GmailIntelligenceSettings) {
  const recipientTerms = unique(settings.monitoredTargets)
    .filter((target) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))
    .flatMap((email) => [`to:${quoteGmailSearchTerm(email)}`, `cc:${quoteGmailSearchTerm(email)}`]);
  const senderTerms = unique(settings.importantSenders)
    .filter((sender) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))
    .map((sender) => `from:${quoteGmailSearchTerm(sender)}`);
  const keywordTerms = unique(settings.strongKeywords)
    .filter((keyword) => searchLower(keyword).length > 2)
    .map(quoteGmailSearchTerm)
    .filter(Boolean)
    .slice(0, 24);
  const terms = unique([...recipientTerms, ...senderTerms, ...keywordTerms]);
  const window = `newer_than:${SEARCH_WINDOW_DAYS}d -in:spam -in:trash`;

  if (terms.length === 0) return window;
  return `${window} (${terms.join(" OR ")})`;
}

async function listGmailMessages(accessToken: string, q: string, maxResults: number) {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    includeSpamTrash: "false",
    q,
  });

  return gmailFetch<GmailMessageListResponse>(`/users/me/messages?${params.toString()}`, accessToken);
}

async function ensureMailbox(email: string) {
  const result = await db.query<GmailMailboxRow>(
    `
      insert into public.gmail_mailboxes (email, display_name, last_error, updated_at)
      values ($1, $2, null, now())
      on conflict (email)
      do update set enabled = true, last_error = null, updated_at = now()
      returning id
    `,
    [email.toLowerCase(), email]
  );

  return result.rows[0];
}

async function insertAlert(mailboxId: string, message: GmailMessageResponse, classified: ClassifiedAlert, bodyText: string) {
  const from = getHeader(message, "From");
  const subject = getHeader(message, "Subject") || "Email sem assunto";
  const { senderName, senderEmail } = parseSender(from);
  const receivedAt = getReceivedAt(message);
  const snippet = buildSnippet(message, bodyText);

  await db.query(
    `
      insert into public.gmail_alerts (
        mailbox_id,
        gmail_message_id,
        gmail_thread_id,
        received_at,
        sender_name,
        sender_email,
        subject,
        snippet,
        matched_targets,
        priority,
        reasons,
        gmail_url,
        status,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11::jsonb, $12, 'new', now())
      on conflict (mailbox_id, gmail_message_id)
      do update set
        gmail_thread_id = excluded.gmail_thread_id,
        received_at = excluded.received_at,
        sender_name = excluded.sender_name,
        sender_email = excluded.sender_email,
        subject = excluded.subject,
        snippet = excluded.snippet,
        matched_targets = excluded.matched_targets,
        priority = excluded.priority,
        reasons = excluded.reasons,
        gmail_url = excluded.gmail_url,
        updated_at = now()
    `,
    [
      mailboxId,
      message.id,
      message.threadId,
      receivedAt,
      senderName,
      senderEmail,
      subject,
      snippet,
      classified.matchedTargets,
      classified.priority,
      JSON.stringify(classified.reasons),
      buildGmailUrl(message),
    ]
  );
}

async function logSync(mailboxId: string, eventType: string, status: string, payload?: unknown, errorMessage?: string) {
  await db.query(
    `
      insert into public.gmail_sync_logs (mailbox_id, event_type, status, payload, error_message)
      values ($1, $2, $3, $4::jsonb, $5)
    `,
    [mailboxId, eventType, status, payload ? JSON.stringify(payload) : null, errorMessage || null]
  );
}

export async function syncGmailIntelligenceNow() {
  const settings = await getGmailIntelligenceSettings();
  if (!settings.enabled) throw new Error("Ative o monitoramento Gmail antes de sincronizar.");

  const accessToken = await getAccessToken();
  const profile = await gmailFetch<GmailProfileResponse>("/users/me/profile", accessToken);
  const mailboxEmail = lower(profile.emailAddress) || lower(settings.monitoredMailbox);
  const mailbox = await ensureMailbox(mailboxEmail);

  let inspected = 0;
  let matched = 0;
  let inserted = 0;
  let listed = 0;
  const queryPlans = [
    { name: "targeted", q: buildTargetedSearchQuery(settings), maxResults: TARGETED_SYNC_MAX_RESULTS },
    { name: "recent_fallback", q: "newer_than:2d -in:spam -in:trash", maxResults: RECENT_FALLBACK_MAX_RESULTS },
  ];

  try {
    const queuedMessages = new Map<string, { id: string; threadId: string; source: string }>();
    const listSummaries: { name: string; q: string; returned: number; resultSizeEstimate?: number }[] = [];

    for (const plan of queryPlans) {
      const list = await listGmailMessages(accessToken, plan.q, plan.maxResults);
      const messages = list.messages || [];
      listed += messages.length;
      listSummaries.push({
        name: plan.name,
        q: plan.q,
        returned: messages.length,
        resultSizeEstimate: list.resultSizeEstimate,
      });

      for (const item of messages) {
        if (!queuedMessages.has(item.id)) {
          queuedMessages.set(item.id, { ...item, source: plan.name });
        }
      }
    }

    for (const item of queuedMessages.values()) {
      inspected += 1;
      const detailParams = new URLSearchParams({ format: "full" });
      const message = await gmailFetch<GmailMessageResponse>(`/users/me/messages/${encodeURIComponent(item.id)}?${detailParams.toString()}`, accessToken);
      const bodyText = getMessageBodyText(message);
      const classified = classifyMessage(message, settings, bodyText);
      if (!classified) continue;

      matched += 1;
      await insertAlert(mailbox.id, message, classified, bodyText);
      inserted += 1;
    }

    await db.query(
      `
        update public.gmail_mailboxes
        set last_history_id = $2, last_sync_at = now(), last_error = null, updated_at = now()
        where id = $1
      `,
      [mailbox.id, profile.historyId || null]
    );
    await logSync(mailbox.id, "manual_sync", "success", {
      listed,
      inspected,
      matched,
      inserted,
      uniqueMessages: queuedMessages.size,
      queries: listSummaries,
      historyId: profile.historyId || null,
    });

    return {
      mailbox: mailboxEmail,
      listed,
      inspected,
      matched,
      inserted,
      historyId: profile.historyId || null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar Gmail.";
    await db.query("update public.gmail_mailboxes set last_error = $2, updated_at = now() where id = $1", [mailbox.id, message]).catch(() => null);
    await logSync(mailbox.id, "manual_sync", "error", { listed, inspected, matched, inserted, queries: queryPlans }, message).catch(() => null);
    throw error;
  }
}
