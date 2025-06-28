require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 8081;

// Set up Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Set up Google OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// At the top of your file, add this in-memory map:
const userIdMap = {};

// Step 1: Redirect user to Google for consent, passing user_id and state
app.get('/auth/google', (req, res) => {
  const user_id = req.query.user_id;
  console.log('Received user_id in /auth/google:', user_id);
  const state = Math.random().toString(36).substring(2);
  userIdMap[state] = user_id;
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent',
    state
  });
  res.redirect(url);
});

// Step 2: Google redirects back with code and state
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const user_id = userIdMap[state];
  console.log('Using user_id in /auth/google/callback:', user_id);
  delete userIdMap[state];
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  // Fetch emails
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 10 });
  const messages = listRes.data.messages || [];

  for (const msg of messages) {
    const msgRes = await gmail.users.messages.get({ userId: 'me', id: msg.id });
    const headers = msgRes.data.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    const body = msgRes.data.snippet || '';

    // Check if this gmail_id already exists
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('gmail_id', msg.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('messages').insert([{
        user_id,
        source: 'Gmail',
        sender: from,
        content: body,
        timestamp: new Date(date),
        tags: [],
        channel: null,
        is_thread: false,
        thread_parent_preview: null,
        is_dm: false,
        participants: null,
        subject: subject,
        gmail_id: msg.id
      }]);
    }
  }

  res.send('Fetched and saved emails to Supabase!');
});

app.get('/test', (req, res) => {
    res.send('Hello from test route!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});