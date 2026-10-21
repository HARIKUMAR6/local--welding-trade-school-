const fs = require('fs');
const https = require('https');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const images = [
  {
    name: 'home2-workshop-overview.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Second_wave_of_I_Marine_Expeditionary_Force_Marines_participate_in_welding_training_%289178716%29.jpg'
  },
  {
    name: 'home2-welding-programs.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/95/College_of_DuPage_Student_Tackles_Large_Welding_Project_2015_4_%2817307555736%29.jpg'
  },
  {
    name: 'home2-training-workflow.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/32/A_Student_Welder_Exhibiting_His_Talent_At_Tamale_Technical_University_Practice.jpg'
  },
  {
    name: 'home2-skills-inspection.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Standard_Microscope_for_the_Weld_Inspection_System.jpg'
  },
  {
    name: 'home2-guided-instruction.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Members_of_the_Women%27s_Royal_Naval_Service_%28WRNS%29_practice_welding_at_a_Government_Training_Centre_as_part_of_their_training_to_become_Ship_Mechanics_in_1943._D17082.jpg'
  },
  {
    name: 'home2-career-pathways.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Repair_and_welding_of_steam_pipes.jpg'
  },
  {
    name: 'home2-enrollment-cta.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/27/BLACK_STUDENT_WELDERS_WORK_IN_A_MACHINE_SHOP_COURSE_TAUGHT_AT_THE_CHICAGO_OPPORTUNITIES_INDUSTRIALIZATION_CENTER_IN..._-_NARA_-_556269.jpg'
  }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadImage(item, attempt = 1) {
  return new Promise((resolve, reject) => {
    const dest = path.join(targetDir, item.name);
    console.log(`Starting [attempt ${attempt}]: ${item.name}...`);

    function requestUrl(currentUrl, redirects) {
      if (redirects > 5) return reject(new Error('Exceeded max redirects'));

      const req = https.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://commons.wikimedia.org/'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return requestUrl(res.headers.location, redirects + 1);
        }

        if (res.statusCode === 429) {
          if (attempt < 4) {
            console.log(`Rate-limited on ${item.name}, waiting 8s before retry...`);
            setTimeout(() => {
              downloadImage(item, attempt + 1).then(resolve).catch(reject);
            }, 8000);
            return;
          }
          return reject(new Error('Rate limited (HTTP 429)'));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            const stats = fs.statSync(dest);
            const fd = fs.openSync(dest, 'r');
            const buf = Buffer.alloc(4);
            fs.readSync(fd, buf, 0, 4, 0);
            fs.closeSync(fd);
            const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
            console.log(`[SUCCESS] ${item.name} (${stats.size} bytes, isJPEG: ${isJpeg})`);
            resolve({ name: item.name, size: stats.size, isJpeg });
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    }

    requestUrl(item.url, 0);
  });
}

async function main() {
  console.log('=== DOWNLOADING HOME 2 INDUSTRIAL PHOTOGRAPHS ===');
  for (const item of images) {
    try {
      await sleep(3500); // 3.5s delay to be polite to Wikimedia
      await downloadImage(item);
    } catch (e) {
      console.error(`[ERROR] ${item.name}: ${e.message}`);
    }
  }
  console.log('=== HOME 2 DOWNLOAD PROCESS COMPLETE ===');
}

main();
