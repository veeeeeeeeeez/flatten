require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 8081;

// Add body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/contacts.readonly'
    ],
    prompt: 'consent',
    state,
    include_granted_scopes: true
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

  // Fetch email from auth.users
  let email = null;
  const { data: authUser, error: authError } = await supabase
    .from('auth.users')
    .select('email')
    .eq('id', user_id)
    .single();
  if (authUser && authUser.email) email = authUser.email;

  // Save refresh token if present
  if (tokens.refresh_token) {
    // First, try to insert the user (in case they don't exist)
    const { error: insertError } = await supabase
      .from('users')
      .insert([{ id: user_id, email, gmail_refresh_token: tokens.refresh_token }])
      .single();
    // If insert fails (user already exists), then update
    if (insertError && insertError.code === '23505') { // Unique violation
      await supabase
        .from('users')
        .update({ gmail_refresh_token: tokens.refresh_token, email })
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
      // Fetch email from auth.users
      let email = null;
      const { data: authUser, error: authError } = await supabase
        .from('auth.users')
        .select('email')
        .eq('id', user_id)
        .single();
      if (authUser && authUser.email) email = authUser.email;
      await supabase
        .from('users')
        .insert([{ id: user_id, email }]);
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

// Add endpoint to fetch contacts
app.get('/contacts', async (req, res) => {
  const user_id = req.query.user_id;
  
  // 1. Get refresh token from Supabase
  const { data: user, error } = await supabase
    .from('users')
    .select('gmail_refresh_token')
    .eq('id', user_id)
    .single();

  if (error || !user || !user.gmail_refresh_token) {
    return res.status(400).send('No refresh token found. Please reconnect Gmail.');
  }

  try {
    // 2. Set up OAuth2 client with refresh token
    oAuth2Client.setCredentials({ refresh_token: user.gmail_refresh_token });
    
    // 3. Fetch contacts using Google People API
    const people = google.people({ version: 'v1', auth: oAuth2Client });
    const contactsRes = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,photos'
    });
    
    const contacts = contactsRes.data.connections || [];
    const formattedContacts = contacts.map(contact => ({
      id: contact.resourceName,
      name: contact.names?.[0]?.displayName || 'Unknown',
      email: contact.emailAddresses?.[0]?.value || '',
      photo: contact.photos?.[0]?.url || null
    })).filter(contact => contact.email); // Only return contacts with emails
    
    res.json(formattedContacts);
  } catch (err) {
    console.error('Contacts fetch error:', err);
    res.status(500).send('Failed to fetch contacts.');
  }
});

// Add endpoint to send emails
app.post('/send-email', async (req, res) => {
  const user_id = req.body.user_id;
  const { to, cc, bcc, subject, content, attachments } = req.body;
  
  // 1. Get refresh token from Supabase
  const { data: user, error } = await supabase
    .from('users')
    .select('gmail_refresh_token')
    .eq('id', user_id)
    .single();

  if (error || !user || !user.gmail_refresh_token) {
    return res.status(400).send('No refresh token found. Please reconnect Gmail.');
  }

  try {
    // 2. Set up OAuth2 client with refresh token
    oAuth2Client.setCredentials({ refresh_token: user.gmail_refresh_token });
    
    // 3. Create email message
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
    // Build email headers
    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0'
    ];
    
    if (cc && cc.trim()) headers.push(`Cc: ${cc}`);
    if (bcc && bcc.trim()) headers.push(`Bcc: ${bcc}`);
    
    // Ensure proper line endings for email format
    const emailContent = headers.join('\r\n') + '\r\n\r\n' + content;
    
    // Encode the email in base64
    const encodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    
    console.log('Sending email to:', to);
    console.log('Subject:', subject);
    console.log('Content length:', content.length);
    
    // Send the email
    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    console.log('Email sent successfully, message ID:', sendRes.data.id);
    
    res.json({ 
      success: true, 
      messageId: sendRes.data.id,
      message: 'Email sent successfully!' 
    });
    
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send email.',
      details: err.message 
    });
  }
});

app.get('/test', (req, res) => {
    res.send('Hello from test route!');
});

// Force re-authorization endpoint
app.get('/reauth', (req, res) => {
  const user_id = req.query.user_id;
  console.log('Force re-authorization for user:', user_id);
  const state = Math.random().toString(36).substring(2);
  userIdMap[state] = user_id;
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/contacts.readonly'
    ],
    prompt: 'consent',
    state,
    include_granted_scopes: true
  });
  res.redirect(url);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});