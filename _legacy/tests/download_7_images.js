const https = require('https');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(process.cwd(), 'assets', 'images');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const imagesToDownload = [
  {
    filename: 'hero-industrial-welder.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/55/AlfredPalmerwelder1.jpg',
    source: 'Wikimedia Commons / Library of Congress (Alfred T. Palmer)',
    license: 'Public Domain',
    section: 'Section 1 — Career-focused hero'
  },
  {
    filename: 'learn-hands-on-practice.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/US_Navy_070820-N-8132M-018_Hull_Technician_Fireman_Wesley_Wilhelm%2C_of_Wilmington%2C_Del.%2C_welds_a_stud_inside_the_general_workshop_aboard_guided-missile_destroyer_USS_Arleigh_Burke_%28DDG_51%29.jpg',
    source: 'Wikimedia Commons / U.S. Navy (070820-N-8132M-018)',
    license: 'Public Domain',
    section: 'Section 2 — Learn by doing'
  },
  {
    filename: 'welding-disciplines-processes.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Metals_Tech_welds_rocket_storage_racks_%289264936%29.jpg',
    source: 'Wikimedia Commons / U.S. Air Force (Metals Tech)',
    license: 'Public Domain',
    section: 'Section 3 — Explore welding disciplines'
  },
  {
    filename: 'certification-weld-inspection.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Standard_Microscope_for_the_Weld_Inspection_System.jpg',
    source: 'Wikimedia Commons / CC BY-SA 4.0',
    license: 'CC BY-SA 4.0',
    section: 'Section 4 — Certification outcomes'
  },
  {
    filename: 'expert-instruction-technique.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/60/A_Sailor_welds_aboard_USS_Jason_Dunham._%288203275122%29.jpg',
    source: 'Wikimedia Commons / U.S. Navy (8203275122)',
    license: 'Public Domain',
    section: 'Section 5 — Expert instruction'
  },
  {
    filename: 'career-pathways-fabrication.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/43/U_S_Navy_Seabees_Build_Training_Facility_with_Senegalese_Partners_for_Obangame_Express_2026_%289618369%29.jpg',
    source: 'Wikimedia Commons / U.S. Navy Seabees (9618369)',
    license: 'Public Domain',
    section: 'Section 6 — Build job-ready skills'
  },
  {
    filename: 'enrollment-workshop-training.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/US_Navy_090824-N-6272M-001_Steel_Worker_1st_Class_Josh_Eichelberger_demonstrates_the_virtual_welder_system_at_Naval_Construction_Battalion_Center.jpg',
    source: 'Wikimedia Commons / U.S. Navy (090824-N-6272M-001)',
    license: 'Public Domain',
    section: 'Section 7 — Start your training journey'
  }
];

function downloadOne(item) {
  return new Promise((resolve, reject) => {
    const destPath = path.join(targetDir, item.filename);
    
    function fetchWithRedirect(url, redirectCount = 0) {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects for ' + item.filename));
      }

      https.get(url, {
        headers: {
          'User-Agent': 'WeldingSchoolImageDownloader/1.0 (admin@example.org)'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchWithRedirect(res.headers.location, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download ${item.filename}: HTTP ${res.statusCode}`));
        }

        const out = fs.createWriteStream(destPath);
        res.pipe(out);
        out.on('finish', () => {
          out.close(() => {
            const stats = fs.statSync(destPath);
            const buffer = Buffer.alloc(4);
            const fd = fs.openSync(destPath, 'r');
            fs.readSync(fd, buffer, 0, 4, 0);
            fs.closeSync(fd);
            const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
            resolve({
              filename: item.filename,
              path: destPath,
              size: stats.size,
              isJpeg,
              section: item.section,
              source: item.source,
              license: item.license
            });
          });
        });
      }).on('error', reject);
    }

    fetchWithRedirect(item.url);
  });
}

(async () => {
  console.log('Downloading 7 dedicated industrial images for Home 1...');
  const results = [];
  for (const item of imagesToDownload) {
    console.log(`Downloading: ${item.filename} (${item.section})...`);
    try {
      const res = await downloadOne(item);
      console.log(`[SUCCESS] ${item.filename} | Size: ${res.size} bytes | JPEG: ${res.isJpeg}`);
      results.push(res);
    } catch (err) {
      console.error(`[FAIL] ${item.filename}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n--- ALL 7 DEDICATED IMAGES DOWNLOADED SUCCESSFULLY ---');
  for (const r of results) {
    console.log(`- ${r.filename}: ${r.size} bytes (${r.section})`);
  }
})();
