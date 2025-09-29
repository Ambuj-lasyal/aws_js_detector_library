const express = require('express');
const methodOverride = require('method-override');
const mysql = require('mysql');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(methodOverride('_method'));

app.use(express.static(__dirname));

// Middleware to parse JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL Connection Pool
const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sam_pharmacy'
});

// Serve static files (like HTML and client-side scripts)
app.use(express.static('public'));

// Route to serve the HTML form
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/addDrug', (req, res) => {
  const { drug_id, drug_name, issue_date, expiry_date, active_subs, dose, stock, purpose, category, price, side_effects } = req.body;

  // Validate drug_name field
  if (!drug_name) {
    return res.status(400).send('Drug Name cannot be empty');
  }

  // SQL query to insert data into 'drugs' table
  const sql = 'INSERT INTO `drugs` (`drug_id`, `drug_name`, `issue_date`, `expiry_date`, `active_subs`, `dose`, `stock`, `purpose`, `category`, `price`, `side_effects`) VALUES (?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?)';
  
  const values = [drug_id, drug_name, issue_date, expiry_date, active_subs, dose, stock, purpose, category, price, side_effects];

  // Execute SQL query with values
  pool.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Error adding drug: ' + err.message); // Send detailed error message
    }
    res.sendFile(__dirname + '/form html.html');
    console.log('Drug added successfully');
    
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
   

function filterData() {
  const category = document.getElementById('categoryInput').value;
  fetch(`/drugs?category=${category}`)
    .then(response => response.json())
    .then(data => {
      renderTable(data);
    })
    .catch(error => console.error('Error fetching data:', error));
};

function renderTable(data) {
  const tableBody = document.getElementById('tableBody');
  tableBody.innerHTML = ''; // Clear existing rows

  data.forEach(drug => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${drug.ID}</td>
      <td>${drug.name}</td>
      <td>${drug.issue_date}</td>
      <td>${drug.expiry_date}</td>
      <td>${drug.active_subs}</td>
      <td>${drug.purpose}</td>
      <td>${drug.price}</td>
      <td>${drug.category}</td>
      <td>${drug.dose}</td>
      <td>${drug.stock}</td>
      <td>${drug.side_effects}</td>
      <td>
        <div class="btn-container">
          <button class="btn btn-update" onclick="updateDrug(${drug.ID})">Update</button>
          <button class="btn btn-delete" onclick="deleteDrug(${drug.ID})">Delete</button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
};

function deleteDrug(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    fetch(`/drugs/${id}`, {
      method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
      alert(data.message);
      // Refresh table after deletion
      filterData(); // You can also remove the row from the DOM directly
    })
    .catch(error => console.error('Error deleting record:', error));
  };
};

function updateDrug(id) {
  // Implement update functionality as per your requirements
  console.log('Update drug with ID:', id);
  // You can redirect to an update page or show a modal for editing
};