const fs = require('fs');
const https = require('https');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const imagesToDownload = [
  {
    name: 'hero-cinematic-workshop.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Welding_Shop_DVIDS186624.jpg'
  },
  {
    name: 'practice-torch-control.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Welding_activities_by_young_man.jpg'
  },
  {
    name: 'methods-tig-training.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/27/US_Navy_090715-N-5821P-002_Aviation_Support_Equipment_Technician_Airman_Anthony_Hammond_performs_tungsten_inert_gas_welding_during_a_training_evolution.jpg'
  },
  {
    name: 'inspection-proficiency-test.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/86/US_Navy_070603-N-8909B-043_Aviation_Structural_Mechanic_2nd_Class_Harold_Macadangdang%2C_performs_a_welding_proficiency_test_aboard_USS_Bonhomme_Richard_%28LHD_6%29_%28BHR%29.jpg'
  },
  {
    name: 'guided-instructor-coaching.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/E%2C_Instructor_C.C._Gravelge%2C_showing_one_of_his_classes_the_difficult_art_of_overhead_welding_in_preparation_for_their_initiation_into_aircraft_welding_jobs_._Former_nightclub_in_Daytona_Beach%2C_Florida_April_1942._-_Flickr_-_polkbritton.jpg'
  },
  {
    name: 'pathways-structural-steel.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/I-beam_raw_material_at_WP_Welding_1.jpg'
  },
  {
    name: 'cta-industrial-shop.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/dc/Welding_Shop_DVIDS186629.jpg'
  }
];

function downloadOne(item) {
  return new Promise((resolve, reject) => {
    const dest = path.join(targetDir, item.name);
    console.log(`Starting download: ${item.name}...`);

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

        if (res.statusCode !== 200) {
          return reject(new Error(`Failed with HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            const stats = fs.statSync(dest);
            // Verify JPEG magic bytes
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
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    }

    requestUrl(item.url, 0);
  });
}

async function main() {
  console.log('=== DOWNLOADING 7 NEW INDUSTRIAL PHOTOGRAPHS ===');
  for (const item of imagesToDownload) {
    try {
      await downloadOne(item);
    } catch (err) {
      console.error(`[FAIL] ${item.name}: ${err.message}`);
    }
  }
  console.log('=== DOWNLOAD SEQUENCE COMPLETE ===');
}

main();
