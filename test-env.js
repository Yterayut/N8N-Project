// Test if n8n can read environment variables
const dotenv = require('dotenv');
const path = require('path');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const keywords = process.env.FB_ENCOURAGEMENT_KEYWORDS || '';
const keywordArray = keywords.split(',').map(k => k.trim());

console.log('Total keywords:', keywordArray.length);
console.log('Contains "ตัวจริง":', keywordArray.includes('ตัวจริง'));
console.log('Contains "ดีงาม":', keywordArray.includes('ดีงาม'));
console.log('Contains "คมกริบ":', keywordArray.includes('คมกริบ'));

console.log('\nFirst 10 keywords:');
keywordArray.slice(0, 10).forEach((k, i) => console.log(`${i+1}. ${k}`));
