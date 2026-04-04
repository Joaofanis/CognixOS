const https = require('https');

const API_KEY = process.env.OPENROUTER_API_KEY || "YOUR_KEY";

const data = JSON.stringify({
  model: "meta-llama/llama-3.3-70b-instruct:free",
  messages: [{ role: "user", content: "Teste" }],
  temperature: 0.7,
  max_tokens: 200
});

const req = https.request('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || "YOUR_KEY_HERE"}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://pnmxqvaafdecqmeradfc.supabase.co',
    'X-Title': 'Segundo Cerebro'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});

req.on('error', console.error);
req.write(data);
req.end();
