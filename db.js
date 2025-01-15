const mysql = require ('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'conversai'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Database berhasil dikoneksikan');
}); 

module.exports = db;

