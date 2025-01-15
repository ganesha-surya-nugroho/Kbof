const express = require('express');  
const bodyParser = require('body-parser');  
const bcrypt = require('bcryptjs');  
const session = require('express-session');  
const db = require('./db'); // Koneksi ke database  
const app = express(); 
const apiRoutes = require('./api'); // Impor rute API
 const { Mistral } = require('@mistralai/mistralai')
// app.js  
require('dotenv').config(); // Tambahkan ini di bagian atas file  

  
app.set('view engine', 'ejs');  
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());  
app.use(express.static('public'));  
  
// Konfigurasi sesi  
app.use(session({  
    secret: 'your_secret_key',  
    resave: false,  
    saveUninitialized: true  
}));  

app.get('/', (req, res) => {  
    res.render('index'); // Pastikan file index.ejs ada di folder views  
});

// Menggunakan rute API  
app.use('/api', apiRoutes);

  
// Halaman registrasi  
app.get('/register', (req, res) => {  
    res.render('register');  
});  
  
// Endpoint untuk registrasi  
app.post('/register', async (req, res) => {  
    const { username, nomor_telepon, email, password } = req.body;  
    const hashedPassword = await bcrypt.hash(password, 10);  
      
    const query = 'INSERT INTO users (username, nomor_telepon, email, password) VALUES (?, ?, ?, ?)';  
    db.query(query, [username, nomor_telepon, email, hashedPassword], (err, results) => {  
        if (err) {  
            console.error(err);  
            return res.redirect('/register'); // Redirect jika ada error  
        }  
        res.redirect('/login');  
    });  
});  
  
// Halaman login  
app.get('/login', (req, res) => {  
    res.render('login');  
});  
  
// Endpoint untuk login  
app.post('/login', (req, res) => {  
    const { username, password } = req.body;  
      
    const query = 'SELECT * FROM users WHERE username = ?';  
    db.query(query, [username], async (err, results) => {  
        if (err) {  
            console.error(err);  
            return res.redirect('/login'); // Redirect jika ada error  
        }  
          
        if (results.length > 0) {  
            const user = results[0];  
            if (await bcrypt.compare(password, user.password)) {  
                req.session.userId = user.user_id; // Simpan ID pengguna di sesi  
                const updateQuery = 'UPDATE users SET last_active = NOW() WHERE user_id = ?';  
                db.query(updateQuery, [user.user_id], (err) => {  
                    if (err) console.error(err);  
                });  
                return res.redirect('/dashboard');  
            }  
        }  
        res.redirect('/login'); // Redirect jika login gagal  
    });  
});  
  
// Halaman dashboard  
app.get('/dashboard', (req, res) => {  
      
    res.render('dashboard'); // Tampilkan dashboard  
});  
  
// Endpoint untuk logout  
app.get('/logout', (req, res) => {  
    req.session.destroy();  
    res.redirect('/login');  
});  
  
   
  


// rute untuk Chatbot
// Rute untuk menampilkan halaman percakapan  
// Rute untuk menampilkan halaman percakapan  
app.get('/chat', (req, res) => {  
    const agentId = req.query.agentId;  
    if (!agentId) {  
        return res.status(400).send('Agent ID is required.');  
    }  
  
    // Ambil informasi bisnis dari database berdasarkan agentId  
    const query = 'SELECT * FROM agents WHERE id = ?';  
    db.query(query, [agentId], (err, results) => {  
        if (err || results.length === 0) {  
            return res.status(500).send('Error fetching agent information.');  
        }  
  
        const agentInfo = results[0]; // Ambil informasi agen  
        res.render('chat', { agentId, agentInfo }); // Kirim agentId dan agentInfo ke template chat.ejs  
    });  
});  
  


app.post('/contact', (req, res) => {    
    const { name, email, phone } = req.body;    
  
    // Validasi input  
    if (!name || !email || !phone) {  
        return res.status(400).json({ error: 'Semua field harus diisi.' });  
    }  

    // Log data yang diterima untuk debugging  
    console.log('Data yang diterima:', { name, email, phone });  
  
    const query = 'INSERT INTO customer_contacts (name, email, phone) VALUES (?, ?, ?)';    
    db.query(query, [name, email, phone], (err, results) => {    
        if (err) {    
            console.error('Error saving contact:', err);    
            return res.status(500).json({ error: 'Gagal menyimpan data kontak.' });    
        }    
        res.status(200).json({ message: 'Data kontak berhasil disimpan.' });    
    });    
});  

// Rute untuk menambahkan agen  
app.post('/api/add-agent', (req, res) => {  
    const { name, businessData } = req.body;  
  
    // Validasi input  
    if (!name || !businessData) {  
        return res.status(400).json({ error: 'Semua field harus diisi.' });  
    }  
  
    // Simpan data agen ke database  
    const query = 'INSERT INTO agents (name, business_data, created_at) VALUES (?, ?, NOW())';  
    db.query(query, [name, businessData], (err, results) => {  
        if (err) {  
            console.error('Error inserting agent:', err);  
            return res.status(500).json({ error: 'Gagal menambahkan agen.' });  
        }  
        res.status(201).json({ message: 'Agen berhasil ditambahkan.', agentId: results.insertId });  
    });  
});  
  
// Rute untuk mendapatkan daftar agen  
app.get('/api/agents', (req, res) => {  
    const query = 'SELECT * FROM agents ORDER BY created_at DESC';  
    db.query(query, (err, results) => {  
        if (err) {  
            console.error('Error fetching agents:', err);  
            return res.status(500).json({ error: 'Gagal mengambil daftar agen.' });  
        }  
        res.json(results); // Mengembalikan daftar agen  
    });  
});  
  
// Rute untuk menyimpan percakapan  
app.post('/api/save-conversation', (req, res) => {  
    const { agentId, userMessage, aiResponse } = req.body;  
  
    // Validasi input  
    if (!agentId || !userMessage || !aiResponse) {  
        return res.status(400).json({ error: 'Semua field harus diisi.' });  
    }  
  
    // Simpan percakapan ke database  
    const query = 'INSERT INTO conversations (agent_id, user_message, ai_response, created_at) VALUES (?, ?, ?, NOW())';  
    db.query(query, [agentId, userMessage, aiResponse], (err, results) => {  
        if (err) {  
            console.error('Error saving conversation:', err);  
            return res.status(500).json({ error: 'Gagal menyimpan percakapan.' });  
        }  
        res.status(201).json({ message: 'Percakapan berhasil disimpan.' });  
    });  
});  
  
// Rute untuk mendapatkan riwayat percakapan berdasarkan agentId  
app.get('/api/conversations/:agentId', (req, res) => {  
    const agentId = req.params.agentId;  
  
    const query = 'SELECT * FROM conversations WHERE agent_id = ? ORDER BY created_at DESC';  
    db.query(query, [agentId], (err, results) => {  
        if (err) {  
            console.error('Error fetching conversations:', err);  
            return res.status(500).json({ error: 'Gagal mengambil riwayat percakapan.' });  
        }  
        res.json(results); // Mengembalikan riwayat percakapan  
    });  
});  
  
 

// Rute untuk menampilkan halaman daftar agen  
app.get('/agents', (req, res) => {  
    if (!req.session.userId) {  
        return res.redirect('/login'); // Redirect jika belum login  
    }
    res.render('agents_list'); // Render halaman agents_list.ejs  
});

app.post('/api/ask', async (req, res) => {      
    const { question, userInfo, agentId } = req.body;      
  
    // Validasi input  
    if (!agentId) {  
        return res.status(400).json({ error: 'agentId harus disertakan.' });  
    }  
    if (!question) {  
        return res.status(400).json({ error: 'Pertanyaan harus disertakan.' });  
    }  
    if (!userInfo || !userInfo.name || !userInfo.email || !userInfo.phone) {  
        return res.status(400).json({ error: 'Informasi pengguna tidak lengkap.' });  
    }  
  
    console.log('Received request:', { question, userInfo, agentId });  
  
    // Ambil data bisnis berdasarkan agentId    
    const query = 'SELECT business_data FROM agents WHERE id = ?';    
    db.query(query, [agentId], async (err, results) => {    
        if (err || results.length === 0) {    
            console.error('Error fetching business data:', err);    
            return res.status(500).json({ error: 'Gagal mengambil data bisnis.' });    
        }    
  
        const businessData = results[0].business_data;    
  
        // Buat prompt untuk Mistral AI    
        const prompt = `Berdasarkan informasi bisnis kami: ${businessData}, Pelanggan bertanya: ${question}. Jawab pertanyaan pelanggan saja.`;    
        console.log('Prompt sent to Mistral AI:', prompt); // Log prompt    
  
        try {    
            // Kirim prompt ke Mistral AI    
            const chatResponse = await client.agents.complete({    
                agent_id: agentId, // Pastikan agentId valid    
                messages: [{ role: 'user', content: prompt }],    
            });    
  
            console.log('Response from Mistral AI:', chatResponse); // Log respons dari Mistral    
  
            // Periksa apakah ada pilihan yang dikembalikan    
            if (!chatResponse.choices || chatResponse.choices.length === 0) {    
                console.error('No choices returned from Mistral AI');    
                return res.status(500).json({ error: 'Gagal mendapatkan jawaban.' });    
            }    
  
            // Mengambil respons dari Mistral AI    
            const aiAnswer = chatResponse.choices[0].message.content;    
            console.log('AI Answer:', aiAnswer);    
  
            // Simpan percakapan ke database    
            const insertQuery = 'INSERT INTO conversations (user_id, user_name, user_email, user_phone, user_message, ai_response, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())';    
            db.query(insertQuery, [userInfo.id, userInfo.name, userInfo.email, userInfo.phone, question, aiAnswer], (err) => {    
                if (err) {    
                    console.error('Error saving conversation:', err);    
                    return res.status(500).json({ error: 'Gagal menyimpan percakapan.' });    
                }    
                console.log('Conversation saved successfully');    
                res.json({ answer: aiAnswer });    
            });    
        } catch (error) {    
            console.error('Error sending prompt to Mistral AI:', error);    
            res.status(500).json({ error: 'Gagal mendapatkan respons dari Mistral AI.' });    
        }    
    });    
});  

 

// Endpoint untuk mengambil semua riwayat percakapan  
app.get('/api/conversations', (req, res) => {  
    const query = 'SELECT * FROM conversations ORDER BY created_at DESC';  
    db.query(query, (err, results) => {  
        if (err) {  
            console.error('Error fetching conversations:', err);  
            return res.status(500).json({ error: 'Gagal mengambil riwayat percakapan.' });  
        }  
        res.json(results);  
    });  
}); 

app.get('/view-chat', (req, res) => {
    res.render('view');
});

app.get('/integration', (req, res) => {
    res.render('integration');
});

app.get('/chatting', (req, res) => {
    res.render('chatting');
});

app.get('/contacts', (req, res) => {
    res.render('contacts');
});

  





const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => {  
    console.log(`Server running on port ${PORT}`);  
});  
