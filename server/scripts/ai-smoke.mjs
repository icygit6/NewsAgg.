// Uses only the existing configured providers and synthetic, non-private text.
import 'dotenv/config';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
const results = [];
if (process.env.GROQ_API_KEY) {
  const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';
  try {
    const r = await new Groq({apiKey:process.env.GROQ_API_KEY,timeout:20000,maxRetries:0}).chat.completions.create({model,messages:[{role:'user',content:'Reply with only OK.'}],max_tokens:100});
    results.push({provider:'groq',model,ok:!!r.choices[0]?.message?.content});
  } catch(e) { results.push({provider:'groq',model,ok:false,status:e.status,error:e.code || e.name}); }
}
if (process.env.GEMINI_API_KEY) {
  const model = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-3.5-flash-lite';
  try {
    const r = await new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY,httpOptions:{timeout:20000}}).models.generateContent({model,contents:'Translate into Indonesian, only the translation: The hospital opened today.',config:{maxOutputTokens:100}});
    results.push({provider:'gemini',model,ok:!!r.text});
  } catch(e) { results.push({provider:'gemini',model,ok:false,status:e.status,error:e.name}); }
}
console.log(JSON.stringify(results));
if (results.length === 0 || results.some(result => !result.ok)) process.exitCode = 1;
