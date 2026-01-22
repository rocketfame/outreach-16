const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to read token from .env.local
let token = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;

if (!token) {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/FIGMA_PERSONAL_ACCESS_TOKEN=(.+)/);
      if (match) {
        token = match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (e) {
    console.error('Could not read .env.local:', e.message);
  }
}

if (!token) {
  console.error('FIGMA_PERSONAL_ACCESS_TOKEN not found. Please set it in .env.local or as environment variable.');
  process.exit(1);
}

const fileKey = 'A5QmFDenHInwQnft6pk8KO';
const nodeId = '5-1739';

const options = {
  hostname: 'api.figma.com',
  path: `/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
  method: 'GET',
  headers: {
    'X-Figma-Token': token,
  },
};

console.log('Fetching Figma design for credits exhausted widget...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const json = JSON.parse(data);
      fs.writeFileSync('figma-credits-exhausted.json', JSON.stringify(json, null, 2));
      console.log('✓ Design saved to figma-credits-exhausted.json');
      
      // Print summary
      if (json.nodes && json.nodes[nodeId]) {
        const node = json.nodes[nodeId].document;
        console.log(`  Name: ${node.name}`);
        console.log(`  Type: ${node.type}`);
        if (node.children) {
          console.log(`  Children: ${node.children.length}`);
        }
      }
    } else {
      console.error('Error:', res.statusCode, data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();
