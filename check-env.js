#!/usr/bin/env node

// Скрипт для перевірки налаштування .env.local

const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');

console.log('=== Перевірка .env.local ===\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ Файл .env.local НЕ знайдено в корені проекту!');
  console.log('   Створіть файл .env.local з наступним вмістом:');
  console.log('');
  console.log('   OPENAI_API_KEY=sk-ваш-ключ');
  console.log('   TAVILY_API_KEY=tvly-ваш-ключ');
  process.exit(1);
}

console.log('✓ Файл .env.local знайдено\n');

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

let openaiKey = null;
let tavilyKey = null;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('OPENAI_API_KEY=')) {
    openaiKey = trimmed.split('=')[1]?.trim();
  }
  if (trimmed.startsWith('TAVILY_API_KEY=')) {
    tavilyKey = trimmed.split('=')[1]?.trim();
  }
}

console.log('Перевірка ключів:\n');

// Перевірка OpenAI
if (!openaiKey) {
  console.log('❌ OPENAI_API_KEY не знайдено');
} else if (openaiKey === 'sk-your-openai-api-key-here' || !openaiKey.startsWith('sk-')) {
  console.log('⚠️  OPENAI_API_KEY: потрібно вставити реальний ключ');
  console.log('   Поточне значення:', openaiKey.substring(0, 20) + '...');
} else {
  console.log('✓ OPENAI_API_KEY: налаштовано');
  console.log('   Префікс:', openaiKey.substring(0, 10) + '...');
}

console.log('');

// Перевірка Tavily
if (!tavilyKey) {
  console.log('❌ TAVILY_API_KEY не знайдено');
} else if (!tavilyKey.startsWith('tvly-')) {
  console.log('⚠️  TAVILY_API_KEY: неправильний формат (має починатися з tvly-)');
} else {
  console.log('✓ TAVILY_API_KEY: налаштовано');
  console.log('   Префікс:', tavilyKey.substring(0, 10) + '...');
}

console.log('\n=== Підсумок ===\n');

const allOk = openaiKey && 
              openaiKey !== 'sk-your-openai-api-key-here' && 
              openaiKey.startsWith('sk-') &&
              tavilyKey && 
              tavilyKey.startsWith('tvly-');

if (allOk) {
  console.log('✅ Всі ключі налаштовано правильно!');
  console.log('   Можна запускати: npm run dev');
} else {
  console.log('⚠️  Потрібно виправити налаштування:');
  if (!openaiKey || openaiKey === 'sk-your-openai-api-key-here' || !openaiKey.startsWith('sk-')) {
    console.log('   - Вставте реальний OPENAI_API_KEY в .env.local');
  }
  if (!tavilyKey || !tavilyKey.startsWith('tvly-')) {
    console.log('   - Вставте реальний TAVILY_API_KEY в .env.local');
  }
  process.exit(1);
}








