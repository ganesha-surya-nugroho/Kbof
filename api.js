// api.js  
const express = require('express');  
const db = require('./db'); // Impor koneksi database  
const axios = require('axios'); // Impor axios untuk melakukan permintaan HTTP
const { Mistral } = require('@mistralai/mistralai'); // Impor Mistral  
  
const app = express();  
  
const apiKey = process.env.MISTRAL_API_KEY;
const client = new Mistral({ apiKey: apiKey }); // Inisialisasi klien Mistral


// Rute untuk menyimpan data kontak  
app.post('/contact', (req, res) => {  
    const { name, email, phone } = req.body;  
  
    // Validasi input  
    if (!name || !email || !phone) {  
        return res.status(400).json({ error: 'Semua field harus diisi.' });  
    }  
  
    console.log('Data yang dikirim:', { name, email, phone }); // Log data yang diterima  
  
    const query = 'INSERT INTO customer_contacts (name, email, phone) VALUES (?, ?, ?)';  
    db.query(query, [name, email, phone], (err, results) => {  
        if (err) {  
            console.error('Error saving contact:', err); // Log kesalahan  
            return res.status(500).json({ error: 'Gagal menyimpan data kontak.' });  
        }  
        res.status(200).json({ message: 'Data kontak berhasil disimpan.' });  
    });  
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
  
    // Ambil data bisnis dan ID agen Mistral berdasarkan agentId    
    const query = 'SELECT business_data, mistral_agent_id FROM agents WHERE id = ?';    
    db.query(query, [agentId], async (err, results) => {    
        if (err || results.length === 0) {    
            console.error('Error fetching business data:', err);    
            return res.status(500).json({ error: 'Gagal mengambil data bisnis.' });    
        }    
  
        const businessData = results[0].business_data;    
        const mistralAgentId = results[0].mistral_agent_id; // Ambil ID agen Mistral  
  
        console.log('Using Mistral Agent ID:', mistralAgentId); // Log ID agen Mistral  
  
        // Buat prompt untuk Mistral AI    
        const prompt = `Berdasarkan informasi bisnis kami: ${businessData}, Pelanggan bertanya: ${question}. Jawab pertanyaan pelanggan saja.`;    
        console.log('Prompt sent to Mistral AI:', prompt); // Log prompt    
  
        try {    
            // Kirim prompt ke Mistral AI    
            const chatResponse = await client.agents.complete({    
                agent_id: 'ag:ffcab88e:20250108:conversai:15862c86', // Gunakan ID agen Mistral yang diambil  
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
            console.error('Error sending prompt to Mistral AI:', error.message);    
            console.error('Stack trace:', error.stack);    
            if (error.response) {  
                console.error('Mistral AI error response:', error.response.data); // Log respons kesalahan dari Mistral  
            }  
            res.status(500).json({ error: 'Gagal mendapatkan respons dari Mistral AI.' });    
        }    
    });    
});  




  
// Fungsi untuk mendapatkan respons dari agen AI  

// Rute untuk menambahkan agen  
app.post('/add-agent', (req, res) => {  
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



// Endpoint untuk menangani pertanyaan dari pengguna  

  
module.exports = app;  
