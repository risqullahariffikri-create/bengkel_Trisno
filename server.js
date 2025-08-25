// server.js
// Ini adalah kode backend yang berfungsi sebagai API untuk aplikasi bengkel
// dengan penyimpanan data permanen menggunakan Firebase Firestore.

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = 3000;

// --- Inisialisasi Firebase Admin SDK ---
// PENTING: Ganti 'path/to/your-service-account-key.json' dengan jalur file JSON
// yang sudah Anda unduh dari konsol Firebase.
// File JSON ini berisi kredensial aman untuk server Anda.
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- Fungsi Helper untuk Mengambil Data dan Mengirim Respon ---
async function fetchDataAndRespond(collectionName, res) {
  try {
    const snapshot = await db.collection(collectionName).get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error(`Gagal mengambil data dari koleksi ${collectionName}:`, error);
    res.status(500).send('Gagal memuat data dari database.');
  }
}

// --- Endpoint API untuk Stok ---
app.get('/api/stok', async (req, res) => {
  await fetchDataAndRespond('stok', res);
});

app.post('/api/stok', async (req, res) => {
  const { nama, harga, stok: jumlah } = req.body;
  if (!nama || harga === undefined || jumlah === undefined) {
    return res.status(400).send('Nama, harga, dan stok harus diisi.');
  }

  try {
    const stokRef = db.collection('stok');
    const querySnapshot = await stokRef.where('nama', '==', nama).get();

    if (!querySnapshot.empty) {
      // Item sudah ada, perbarui stok dan harga
      const doc = querySnapshot.docs[0];
      const existingStok = doc.data().stok || 0;
      await doc.ref.update({
        harga: harga,
        stok: existingStok + jumlah
      });
      console.log(`POST /api/stok: Memperbarui item: ${nama}`);
      res.status(200).json({ id: doc.id, ...doc.data(), stok: existingStok + jumlah });
    } else {
      // Item baru, tambahkan ke koleksi
      const newItem = { nama, harga, stok: jumlah };
      const docRef = await stokRef.add(newItem);
      console.log(`POST /api/stok: Menambahkan item baru: ${nama}`);
      res.status(201).json({ id: docRef.id, ...newItem });
    }
  } catch (error) {
    console.error('Gagal tambah/update stok:', error);
    res.status(500).send('Gagal menyimpan data stok.');
  }
});

app.delete('/api/stok/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const docRef = db.collection('stok').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send('Item tidak ditemukan.');
    }
    await docRef.delete();
    console.log(`DELETE /api/stok: Item dengan ID ${id} berhasil dihapus.`);
    res.status(200).send('Item berhasil dihapus.');
  } catch (error) {
    console.error('Gagal hapus stok:', error);
    res.status(500).send('Gagal menghapus data stok.');
  }
});

// --- Endpoint API untuk Keranjang ---
app.get('/api/keranjang', async (req, res) => {
  await fetchDataAndRespond('keranjang', res);
});

app.post('/api/keranjang', async (req, res) => {
  try {
    // Hapus semua data keranjang yang lama terlebih dahulu
    const batch = db.batch();
    const snapshot = await db.collection('keranjang').get();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Tambahkan item keranjang yang baru
    const newKeranjangItems = req.body;
    if (newKeranjangItems && newKeranjangItems.length > 0) {
      const newBatch = db.batch();
      newKeranjangItems.forEach(item => {
        const docRef = db.collection('keranjang').doc();
        newBatch.set(docRef, item);
      });
      await newBatch.commit();
    }

    console.log('POST /api/keranjang: Keranjang berhasil diperbarui.');
    res.status(200).send('Keranjang berhasil diperbarui.');
  } catch (error) {
    console.error('Gagal memperbarui keranjang:', error);
    res.status(500).send('Gagal menyimpan data keranjang.');
  }
});

// --- Endpoint API untuk Riwayat ---
app.get('/api/riwayat', async (req, res) => {
  await fetchDataAndRespond('riwayat', res);
});

app.post('/api/riwayat', async (req, res) => {
  const newRiwayat = req.body;
  try {
    const docRef = await db.collection('riwayat').add(newRiwayat);
    console.log('POST /api/riwayat: Menambahkan riwayat baru.');
    res.status(201).json({ id: docRef.id, ...newRiwayat });
  } catch (error) {
    console.error('Gagal menambahkan riwayat:', error);
    res.status(500).send('Gagal menyimpan data riwayat.');
  }
});

app.delete('/api/riwayat/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const docRef = db.collection('riwayat').doc(id);
    await docRef.delete();
    console.log(`DELETE /api/riwayat: Riwayat dengan ID ${id} dihapus.`);
    res.status(200).send('Riwayat berhasil dihapus.');
  } catch (error) {
    console.error('Gagal menghapus riwayat:', error);
    res.status(500).send('Gagal menghapus data riwayat.');
  }
});

// Mulai server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
