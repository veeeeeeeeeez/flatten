require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 8081;

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

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

  // Save refresh token if present
  if (tokens.refresh_token) {
    // First, try to insert the user (in case they don't exist)
    const { error: insertError } = await supabase
      .from('users')
      .insert([{ id: user_id, gmail_refresh_token: tokens.refresh_token }])
      .single();
    
    // If insert fails (user already exists), then update
    if (insertError && insertError.code === '23505') { // Unique violation
      await supabase
        .from('users')
        .update({ gmail_refresh_token: tokens.refresh_token })
        .eq('id', user_id);
    }
  }

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
  res.redirect('https://flatten-seven.vercel.app/');
});

// Add a refresh-gmail endpoint for fetching new emails using the stored refresh token
app.get('/refresh-gmail', async (req, res) => {
  const user_id = req.query.user_id;
  // 1. Get refresh token from Supabase
  const { data: user, error } = await supabase
    .from('users')
    .select('gmail_refresh_token')
    .eq('id', user_id)
    .single();

  if (error || !user || !user.gmail_refresh_token) {
    // If user doesn't exist, create them (without refresh token)
    if (error && error.code === 'PGRST116') { // No rows returned
      await supabase
        .from('users')
        .insert([{ id: user_id }]);
    }
    return res.status(400).send('No refresh token found. Please reconnect Gmail.');
  }

  // 2. Set up OAuth2 client with refresh token
  oAuth2Client.setCredentials({ refresh_token: user.gmail_refresh_token });

  // 3. Fetch emails as before
  try {
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
      // Deduplication: check if gmail_id exists
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
    res.send('Fetched and saved new emails!');
  } catch (err) {
    console.error('Gmail refresh error:', err);
    res.status(500).send('Failed to fetch emails.');
  }
});

app.get('/test', (req, res) => {
    res.send('Hello from test route!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});