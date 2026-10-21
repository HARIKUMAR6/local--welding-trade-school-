const fs = require('fs');
const https = require('https');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'assets', 'images');

const items = [
  {
    name: 'home2-guided-instruction.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Members_of_the_Women%27s_Royal_Naval_Service_%28WRNS%29_practice_welding_at_a_Government_Training_Centre_as_part_of_their_training_to_become_Ship_Mechanics_in_1943._D17082.jpg'
  },
  {
    name: 'home2-career-pathways.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Repair_and_welding_of_steam_pipes.jpg'
  }
];

function downloadOne(item) {
  return new Promise((resolve, reject) => {
    const dest = path.join(targetDir, item.name);
    console.log(`Downloading ${item.name}...`);

    function reqUrl(currentUrl, hops) {
      if (hops > 5) return reject(new Error('Max hops'));
      https.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
          'Accept': 'image/*,*/*',
          'Referer': 'https://commons.wikimedia.org/'
        }
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return reqUrl(res.headers.location, hops + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error('Status ' + res.statusCode));
        }
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close(() => {
            const stats = fs.statSync(dest);
            console.log(`[SUCCESS] ${item.name} (${stats.size} bytes)`);
            resolve(stats.size);
          });
        });
        stream.on('error', err => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      }).on('error', reject);
    }

    reqUrl(item.url, 0);
  });
}

async function run() {
  for (const item of items) {
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await new Promise(r => setTimeout(r, 6000));
        await downloadOne(item);
        success = true;
        break;
      } catch (e) {
        console.error(`Attempt ${attempt} failed for ${item.name}: ${e.message}`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }
}

run();
