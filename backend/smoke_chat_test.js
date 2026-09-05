// Simple smoke test for backend /api/chat endpoint
// Run this after starting backend and ai_service (and MongoDB if persistence is required)
// node smoke_chat_test.js

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

async function main(){
  const payload = {
    userId: 'smoke_user',
    message: "I'm feeling anxious about a presentation next week.",
  };

  try{
    const resp = await axios.post(`${BACKEND_URL}/api/chat`, payload, { timeout: 10000 });
    console.log('Status:', resp.status);
    console.log('Body:', JSON.stringify(resp.data, null, 2));
  }catch(err){
    console.error('Error calling backend:', err.message);
    if(err.response){
      console.error('Response data:', err.response.data);
    }
  }
}

main();
