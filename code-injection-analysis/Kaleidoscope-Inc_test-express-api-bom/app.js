const express = require('express');
const mongoose = require('mongoose');
const app = express();

// Set up body parser middleware
app.use(express.json());

// Connect to MongoDB (example connection)
mongoose.connect('mongodb://localhost/test', { useNewUrlParser: true });
const User = mongoose.model('User', { name: String, email: String });

app.get('/users', (req, res) => {
  // VULNERABILITY: Direct use of user input in query without validation
  const query = req.query.filter ? JSON.parse(req.query.filter) : {};
  
  User.find(query)
    .then(users => res.json(users))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/users', (req, res) => {
  // VULNERABILITY: No input validation
  const user = new User(req.body);
  
  user.save()
    .then(savedUser => res.status(201).json(savedUser))
    .catch(err => res.status(400).json({ error: err.message }));
});

// VULNERABILITY: Using eval with user input
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  try {
    const result = eval('(' + query + ')');
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: 'Invalid query' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
