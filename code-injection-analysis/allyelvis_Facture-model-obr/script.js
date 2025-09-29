document.getElementById('invoiceForm').addEventListener('submit', function(event) {
    event.preventDefault();
    generateInvoice();
});

function addItem() {
    const itemsContainer = document.getElementById('items');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    itemDiv.innerHTML = `
        <input type="text" class="itemDescription" placeholder="Description" required>
        <input type="number" class="itemQuantity" placeholder="Quantity" required>
        <input type="number" class="itemPrice" placeholder="Price" required>
        <button type="button" onclick="removeItem(this)">Remove</button>
    `;
    itemsContainer.appendChild(itemDiv);
}

function removeItem(button) {
    button.parentElement.remove();
}

function generateInvoice() {
    const sellerName = document.getElementById('sellerName').value;
    const sellerAddress = document.getElementById('sellerAddress').value;
    const companyNIF = document.getElementById('companyNIF').value;
    const legalForm = document.getElementById('legalForm').value;
    const tradeRegister = document.getElementById('tradeRegister').value;
    const sellerContact = document.getElementById('sellerContact').value;
    const vatSubjected = document.getElementById('vatSubjected').value;
    const buyerName = document.getElementById('buyerName').value;
    const buyerAddress = document.getElementById('buyerAddress').value;
    const invoiceDate = document.getElementById('invoiceDate').value;

    const items = [];
    document.querySelectorAll('#items .item').forEach(itemDiv => {
        const description = itemDiv.querySelector('.itemDescription').value;
        const quantity = itemDiv.querySelector('.itemQuantity').value;
        const price = itemDiv.querySelector('.itemPrice').value;
        items.push({ description, quantity, price });
    });

    let totalAmount = 0;
    let invoiceHtml = `
        <h3>Invoice</h3>
        <p><strong>Seller Name:</strong> ${sellerName}</p>
        <p><strong>Seller Address:</strong> ${sellerAddress}</p>
        <p><strong>Company NIF:</strong> ${companyNIF}</p>
        <p><strong>Legal Form:</strong> ${legalForm}</p>
        <p><strong>Trade Register:</strong> ${tradeRegister}</p>
        <p><strong>Contact:</strong> ${sellerContact}</p>
        <p><strong>VAT Subjected:</strong> ${vatSubjected}</p>
        <p><strong>Buyer Name:</strong> ${buyerName}</p>
        <p><strong>Buyer Address:</strong> ${buyerAddress}</p>
        <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
        <table border="1" cellpadding="10" cellspacing="0">
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
            </tr>
    `;

    items.forEach(item => {
        const itemTotal = item.quantity * item.price;
        totalAmount += itemTotal;
        invoiceHtml += `
            <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.price}</td>
                <td>${itemTotal}</td>
            </tr>
        `;
    });

    invoiceHtml += `
            <tr>
                <td colspan="3"><strong>Total Amount</strong></td>
                <td><strong>${totalAmount}</strong></td>
            </tr>
        </table>
    `;

    document.getElementById('invoicePreview').innerHTML = invoiceHtml;

    // Save the invoice
    saveInvoice({
        sellerName,
        sellerAddress,
        companyNIF,
        legalForm,
        tradeRegister,
        sellerContact,
        vatSubjected,
        buyerName,
        buyerAddress,
        invoiceDate,
        items,
        totalAmount
    });
}

function saveInvoice(invoice) {
    const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    invoices.push(invoice);
    localStorage.setItem('invoices', JSON.stringify(invoices));
}

function listInvoices() {
    const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    console.log('Invoices:', invoices);
    // Display invoices in a suitable format (e.g., table or list)
}

function listProducts() {
    const products = JSON.parse(localStorage.getItem('products') || '[]');
    console.log('Products:', products);
    // Display products in a suitable format (e.g., table or list)
}

function listCustomers() {
    const customers = JSON.parse(localStorage.getItem('customers') || '[]');
    console.log('Customers:', customers);
    // Display customers in a suitable format (e.g., table or list)
}

function getPayment() {
    // Handle payment process
    console.log('Getting payment...');
}

function generateBill() {
    // Generate bill from the invoice
    console.log('Generating bill...');
}

function printOrSaveBill() {
    // Print or save the bill
    console.log('Printing or saving bill...');
}

function listBills() {
    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    console.log('Bills:', bills);
    // Display bills in a suitable format (e.g., table or list)
}

function editOrder() {
    // Edit an existing order
    console.log('Editing order...');
}
// Example script.js
document.getElementById('invoiceForm').addEventListener('submit', function(event) {
    event.preventDefault();
    generateInvoice();
});

function addItem() {
    const itemsDiv = document.getElementById('items');
    const newItem = document.createElement('div');
    newItem.innerHTML = `
        <label>Item Name:</label>
        <input type="text" class="itemName" required>
        <label>Quantity:</label>
        <input type="number" class="itemQuantity" required>
        <label>Price:</label>
        <input type="number" class="itemPrice" required>
        <br>
    `;
    itemsDiv.appendChild(newItem);
}

function generateInvoice() {
    const invoice = {
        seller: {
            name: document.getElementById('sellerName').value,
            address: document.getElementById('sellerAddress').value,
            companyNIF: document.getElementById('companyNIF').value,
            legalForm: document.getElementById('legalForm').value,
            tradeRegister: document.getElementById('tradeRegister').value,
            contact: document.getElementById('sellerContact').value,
            vatSubjected: document.getElementById('vatSubjected').value,
        },
        buyer: {
            name: document.getElementById('buyerName').value,
            address: document.getElementById('buyerAddress').value,
        },
        date: document.getElementById('invoiceDate').value,
        items: []
    };

    const itemNames = document.getElementsByClassName('itemName');
    const itemQuantities = document.getElementsByClassName('itemQuantity');
    const itemPrices = document.getElementsByClassName('itemPrice');

    for (let i = 0; i < itemNames.length; i++) {
        invoice.items.push({
            name: itemNames[i].value,
            quantity: itemQuantities[i].value,
            price: itemPrices[i].value
        });
    }

    const invoicePreview = document.getElementById('invoicePreview');
    invoicePreview.innerHTML = JSON.stringify(invoice, null, 2);

    // Save invoice to database (localStorage for simplicity)
    const invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    invoices.push(invoice);
    localStorage.setItem('invoices', JSON.stringify(invoices));

    alert('Invoice generated and saved!');
}

function listInvoices() {
    const invoices = JSON.parse(localStorage.getItem('invoices')) || [];
    alert('Invoices: ' + JSON.stringify(invoices, null, 2));
}

function listProducts() {
    const products = JSON.parse(localStorage.getItem('products')) || [];
    alert('Products: ' + JSON.stringify(products, null, 2));
}

function listCustomers() {
    const customers = JSON.parse(localStorage.getItem('customers')) || [];
    alert('Customers: ' + JSON.stringify(customers, null, 2));
}

function getPayment() {
    alert('Payment functionality not implemented yet.');
}

function generateBill() {
    alert('Bill generation functionality not implemented yet.');
}

function printOrSaveBill() {
    alert('Print/Save bill functionality not implemented yet.');
}

function listBills() {
    const bills = JSON.parse(localStorage.getItem('bills')) || [];
    alert('Bills: ' + JSON.stringify(bills, null, 2));
}

function editOrder() {
    alert('Edit order functionality not implemented yet.');
}

// Initialize database with default admin login
function initializeDatabase() {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    if (!users.find(user => user.username === 'admin')) {
        users.push({ username: 'admin', password: '' });
        localStorage.setItem('users', JSON.stringify(users));
    }
}

initializeDatabase();
// server.js
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'yourUsername', // Update with your MySQL username
    password: 'yourPassword', // Update with your MySQL password
    database: 'aenzbi'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

app.post('/generateInvoice', (req, res) => {
    const { seller, buyer, date, items } = req.body;
    const sql = `INSERT INTO invoices (seller_name, seller_address, company_nif, legal_form, trade_register, seller_contact, vat_subjected, buyer_name, buyer_address, invoice_date, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [seller.name, seller.address, seller.companyNIF, seller.legalForm, seller.tradeRegister, seller.contact, seller.vatSubjected, buyer.name, buyer.address, date, JSON.stringify(items)];
    
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error generating invoice.');
        } else {
            res.send('Invoice generated and saved!');
        }
    });
});

app.get('/listInvoices', (req, res) => {
    const sql = 'SELECT * FROM invoices';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error retrieving invoices.');
        } else {
            res.json(results);
        }
    });
});

// More endpoints for listProducts, listCustomers, etc.

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
