// index.js
const express = require('express');
const path = require('path');
const crypto = require('crypto');          // untuk generate API key
const mysql = require('mysql2/promise');   // untuk koneksi MySQL

const app = express();
const PORT = 3000;

// Middleware untuk baca JSON body dari fetch() / Postman
app.use(express.json());

// Serve file statis dari folder "public"
app.use(express.static(path.join(__dirname, 'public')));

// =====================
// KONEKSI DATABASE
// =====================
const db = mysql.createPool({
  host: 'localhost',
  port: 3307,
  user: 'root',               // ganti sesuai user MySQL kamu
  password: '1234567',        // ganti password MySQL kamu
  database: 'praktikum7_pws', // ganti sesuai nama DB yang kamu pakai
});

async function testDbConnection() {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    console.log('Koneksi ke MySQL berhasil');
    conn.release();
  } catch (err) {
    console.error('Gagal konek ke MySQL:', err);
  }
}

testDbConnection();

// =========================
// Helper: generate API key
// =========================
function generateApiKey(prefixRaw) {
  let prefix = '';

  if (prefixRaw && typeof prefixRaw === 'string') {
    prefix = prefixRaw.trim();
    if (prefix && !prefix.endsWith('_')) {
      prefix += '_'; // misal PWS_XXXX-XXXX-XXXX
    }
  }

  const segment = () => crypto.randomBytes(4).toString('hex').toUpperCase();
  const apiKey = `${prefix}${segment()}-${segment()}-${segment()}`;

  return apiKey;
}

// =======================
//  API: Generate API Key
//  (dipanggil dari front-end)
// =======================
app.post('/api/generate-key', async (req, res) => {
  try {
    const { appName, description, expiry, scopes, prefix } = req.body;

    if (!appName || typeof appName !== 'string' || appName.trim() === '') {
      return res.status(400).json({ error: 'appName wajib diisi.' });
    }

    const finalScopes =
      Array.isArray(scopes) && scopes.length > 0 ? scopes : ['read'];

    // 1. Generate API key pakai crypto
    const apiKey = generateApiKey(prefix);

    // 2. Simpan ke database
    const [result] = await db.execute(
      'INSERT INTO api_keys (api_key) VALUES (?)',
      [apiKey]
    );

    const insertedId = result.insertId;

    // 3. Kirim response ke front-end
    return res.status(201).json({
      id: insertedId,
      apiKey,
      appName,
      description: description || '',
      expiry,
      scopes: finalScopes,
      createdAt: new Date().toISOString(),
      message: 'API key berhasil dibuat dan disimpan ke database',
    });
  } catch (err) {
    console.error('Error /api/generate-key:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================
//  API: Validate API Key (POST)
//  body: { "apiKey": "..." }
//  (dipakai di Postman)
// =============================
app.post('/api/validate-key', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'apiKey wajib diisi.' });
    }

    // Cek apakah apiKey ada di tabel
    const [rows] = await db.execute(
      'SELECT id, api_key, created_at FROM api_keys WHERE api_key = ? LIMIT 1',
      [apiKey]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        valid: false,
        message: 'API key tidak ditemukan / tidak valid',
      });
    }

    return res.json({
      valid: true,
      id: rows[0].id,
      apiKey: rows[0].api_key,
      createdAt: rows[0].created_at,
      message: 'API key valid',
    });
  } catch (err) {
    console.error('Error /api/validate-key:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`App berjalan di http://localhost:${PORT}`);
});
