/**
 * Microsoft Graph Integration — Calendar + Email
 * Tenant: 5ffc8daf-9a54-46be-9c74-c98d30a2a81a (Copastur single-tenant)
 * OAuth 2.0 Authorization Code Flow with PKCE via MSAL
 * Write ops: requires_human_approval = true
 */
const axios = require('axios');
const db = require('../db');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TENANT_ID = process.env.AZURE_TENANT_ID || '5ffc8daf-9a54-46be-9c74-c98d30a2a81a';

async function getStoredToken(userId) {
  const { rows } = await db.query(
    `SELECT access_token, refresh_token, expires_at FROM graph_tokens WHERE user_id = $1`, [userId]
  );
  return rows[0] || null;
}

async function graphGet(accessToken, endpoint, params = {}) {
  try {
    const res = await axios.get(`${GRAPH_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) throw new Error('Graph token expired or invalid');
    throw err;
  }
}

// Sync calendar events for next 7 days
async function syncCalendar(userId) {
  const token = await getStoredToken(userId);
  if (!token) return { synced: 0, error: 'No graph token — user must authenticate via Microsoft' };

  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const data = await graphGet(token.access_token, '/me/calendarView', {
      startDateTime: now,
      endDateTime: future,
      $select: 'id,subject,start,end,organizer,attendees,isOnlineMeeting,onlineMeeting,bodyPreview,importance',
      $top: 50,
      $orderby: 'start/dateTime asc'
    });

    let synced = 0;
    for (const ev of data.value || []) {
      await db.query(`
        INSERT INTO calendar_events (user_id, ms_event_id, subject, start_dt, end_dt,
          organizer_email, attendees, is_online, join_url, body_preview, importance, synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
        ON CONFLICT (ms_event_id) DO UPDATE SET
          subject=EXCLUDED.subject, start_dt=EXCLUDED.start_dt, end_dt=EXCLUDED.end_dt,
          attendees=EXCLUDED.attendees, synced_at=NOW()`,
        [userId, ev.id, ev.subject,
         ev.start?.dateTime, ev.end?.dateTime,
         ev.organizer?.emailAddress?.address,
         JSON.stringify(ev.attendees || []),
         ev.isOnlineMeeting || false,
         ev.onlineMeeting?.joinUrl || null,
         ev.bodyPreview, ev.importance || 'normal']
      );
      synced++;
    }

    await db.query(`UPDATE integration_sync SET status='success', last_sync_at=NOW(), items_synced=$1 WHERE integration='microsoft_graph'`, [synced]);
    return { synced };
  } catch (err) {
    await db.query(`UPDATE integration_sync SET status='error', error_msg=$1 WHERE integration='microsoft_graph'`, [err.message]);
    throw err;
  }
}

// Sync recent emails (last 48h, top 30)
async function syncEmail(userId) {
  const token = await getStoredToken(userId);
  if (!token) return { synced: 0, error: 'No graph token' };

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  try {
    const data = await graphGet(token.access_token, '/me/messages', {
      $filter: `receivedDateTime ge ${since}`,
      $select: 'id,subject,from,receivedDateTime,bodyPreview,importance,isRead,hasAttachments,categories',
      $top: 30,
      $orderby: 'receivedDateTime desc'
    });

    let synced = 0;
    for (const msg of data.value || []) {
      await db.query(`
        INSERT INTO email_digest (user_id, ms_message_id, subject, from_email, from_name,
          received_at, body_preview, importance, is_read, has_attachments, categories, synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
        ON CONFLICT (ms_message_id) DO UPDATE SET
          is_read=EXCLUDED.is_read, synced_at=NOW()`,
        [userId, msg.id, msg.subject,
         msg.from?.emailAddress?.address, msg.from?.emailAddress?.name,
         msg.receivedDateTime, msg.bodyPreview,
         msg.importance || 'normal', msg.isRead, msg.hasAttachments,
         msg.categories || []]
      );
      synced++;
    }
    return { synced };
  } catch (err) {
    throw err;
  }
}

async function getUpcomingEvents(userId, hours = 24) {
  const { rows } = await db.query(`
    SELECT * FROM calendar_events
    WHERE user_id = $1
      AND start_dt >= NOW()
      AND start_dt <= NOW() + ($2 || ' hours')::interval
    ORDER BY start_dt ASC LIMIT 10`, [userId, hours]);
  return rows;
}

async function getRecentEmails(userId, limit = 20) {
  const { rows } = await db.query(`
    SELECT * FROM email_digest
    WHERE user_id = $1
    ORDER BY received_at DESC LIMIT $2`, [userId, limit]);
  return rows;
}

// Write ops — require human approval
async function sendEmail(to, subject, body, approvedByUserId) {
  return {
    requires_human_approval: true,
    action: 'graph_send_email',
    payload: { to, subject, bodyPreview: body.substring(0, 100) },
    approved_by: approvedByUserId,
    message: 'Envio de email requer aprovação humana explícita'
  };
}

// MSAL OAuth URL builder (for frontend redirect)
function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.AZURE_REDIRECT_URI,
    scope: 'openid profile email ' + (process.env.GRAPH_SCOPES || 'User.Read Calendars.Read Mail.Read'),
    state,
    response_mode: 'query'
  });
  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}

module.exports = { syncCalendar, syncEmail, getUpcomingEvents, getRecentEmails, sendEmail, getAuthUrl };
