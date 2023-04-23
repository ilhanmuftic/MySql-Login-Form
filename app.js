const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const JWT_SECRET = 'your-secret';
const path = require('path')
const cookieParser = require('cookie-parser')
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join("public", "static")))
app.set('trust proxy', 1)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser())

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'database-name',
    multipleStatements: true
  });

  db.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL: ' + err.stack);
      return;
    }
    console.log('Connected to MySQL.');
   
  });  

  const authMiddleware = async (req, res, next) => {
    // Get the JWT from the cookie
    try {
      // Verify the JWT and extract the user ID
      const token = req.cookies.jwt;
      if(!token) return res.redirect('/login')
      const { playerId } = jwt.verify(token, JWT_SECRET);
  
      // Attach the user object to the request
      const playerQuery = `SELECT * FROM users WHERE id = '${playerId}'`;
  
      const playerRows = await new Promise((resolve, reject) => {
        db.query(playerQuery,  (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
  
  
      const player = playerRows[0];
  
    if (!player) {
        return res.redirect('/login')
    }
  
    req.player = player;
  
    next();
    } catch (err) {
      console.log(err)
      res.redirect('/login')
      //res.status(401).send({error:'Unauthorized'});

    }
  };  


  app.get('/', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'home.html'));
  })
  
    app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "login.html"));
    });

    app.post('/login', (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).send('Please provide username and password');
        }
        db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (error, results) => {
          if (error) {
            throw error;
          }
          if (results.length === 0) {
            return res.status(401).send({error:'Invalid username or password'});
          }
          const player = results[0];
          const token = jwt.sign({ playerId: player.id }, JWT_SECRET, { expiresIn: '1y' });
          res.cookie('jwt', token, { httpOnly: true });
          res.status(200).send({msg:'Logged in successfully'});
        });
    });
    
    app.post('/signup', async (req, res) => {
        try {
          // Check if the username already exists
          const usernameExists = await new Promise((resolve, reject) => {
            const query = `SELECT id FROM users WHERE username = ?`;
            db.query(query, [req.body.username], (error, results) => {
              if (error) {
                reject(error);
              } else {
                resolve(results.length > 0);
              }
            });
          });
          if (usernameExists) {
            return res.status(400).send({error:'Username already exists'});
          }
      
          // Insert the user to the database
          await new Promise((resolve, reject) => {
            const query = `INSERT INTO users (id, username, password) VALUES (uuid(), ?, ?)`;
            db.query(query, [req.body.username, req.body.password], (error, results) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });

      
          // Respond with success message
          res.status(200).send({msg:'User created'});
        } catch (error) {
          console.error('Sign up error:', error);
          res.status(500).send({error:'Server error!'});
        }
      });
      
      app.get('*', function(req, res){
        res.status(404).sendFile(path.join(__dirname, "public",  "html", "404.html"));
      });
      
      // Start server
      app.listen(port, () => {
        console.log('Server started on port ' + port);
        
      });      