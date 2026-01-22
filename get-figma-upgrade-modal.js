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
const nodeIds = ['4-1123', '4-1274'];

async function fetchNode(nodeId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.figma.com',
      path: `/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
      method: 'GET',
      headers: {
        'X-Figma-Token': token,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(data);
          resolve(json);
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Fetching Figma designs for upgrade modal...\n');
  
  for (const nodeId of nodeIds) {
    try {
      console.log(`Fetching node ${nodeId}...`);
      const data = await fetchNode(nodeId);
      const filename = `figma-upgrade-modal-${nodeId.replace('-', '_')}.json`;
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`✓ Saved to ${filename}`);
      
      // Print summary
      if (data.nodes && data.nodes[nodeId]) {
        const node = data.nodes[nodeId].document;
        console.log(`  Name: ${node.name}`);
        console.log(`  Type: ${node.type}`);
        if (node.children) {
          console.log(`  Children: ${node.children.length}`);
        }
      }
      console.log('');
    } catch (error) {
      console.error(`Error fetching ${nodeId}:`, error.message);
    }
  }
}

main();
