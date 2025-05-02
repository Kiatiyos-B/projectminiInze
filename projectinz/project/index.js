const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const levenshtein = require('fast-levenshtein');

const app = express();
const PORT = 3000;

// Setup Multer
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'testdb',
  charset: 'utf8mb4'
});

db.connect((err) => {
  if (err) throw err;
  console.log('เชื่อมต่อฐานข้อมูลสำเร็จ!');
});

// Upload route
app.post('/upload', upload.single('file'), (req, res) => {
  const name = req.body.name;
  const comment = req.body.comment;
  const fileName = req.file.filename;

  const sql = 'INSERT INTO testtable (name, catalog, commet2) VALUES (?, ?, ?)';
  db.query(sql, [name, fileName, comment], (err) => {
    if (err) {
      console.error(err);
      return res.send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
    res.send('อัปโหลดสำเร็จและบันทึกลงฐานข้อมูลแล้ว!');
  });
});

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/form', (req, res) => res.sendFile(path.join(__dirname, 'public/upload.html')));
app.get('/problem', (req, res) => res.sendFile(path.join(__dirname, 'public/problem.html')));
app.get('/pview-file', (req, res) => res.sendFile(path.join(__dirname, 'public/view-file.html')));

// View all files
app.get('/view-files', (req, res) => {
  db.query('SELECT * FROM testtable', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์');
    }
    res.json(results);
  });
});

// Download file
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  res.download(filepath, filename, (err) => {
    if (err) {
      console.error('เกิดข้อผิดพลาดในการดาวน์โหลด:', err);
      res.status(404).send('ไม่พบไฟล์');
    }
  });
});

// Search for similar problems using Levenshtein distance
app.post('/ask', (req, res) => {
  const { modelName, question } = req.body;
  console.log(`Model Name: ${modelName}, Question: ${question}`);

  const query = `SELECT * FROM testtable`;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาคำตอบ' });
    }

    let bestMatch = { distance: Infinity, solution: '' };

    results.forEach(result => {
      const nameDistance = levenshtein.get(modelName, result.name);
      const problemDistance = levenshtein.get(question, result.commet2);
      const totalDistance = nameDistance + problemDistance;

      if (totalDistance < bestMatch.distance) {
        bestMatch = {
          distance: totalDistance,
          solution: `รุ่น: ${result.name}\nปัญหา: ${result.commet2}`
        };
      }
    });

    if (bestMatch.distance === Infinity) {
      return res.json({ solution: 'ไม่พบคำตอบที่ใกล้เคียง' });
    }

    console.log('Best Match:', bestMatch);
    res.json({ solution: bestMatch.solution });
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server is running at http://localhost:' + PORT);
});
