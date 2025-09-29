const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
app.use(express.json());
const USERS_DATA_FILE = 'data/users_achievements.json';
const ACHIEVEMENTS_FILE = 'data/achievements_list.json';
const achievements = require('./data/achievements_list.json');

const SHOP_DATA_PATH = path.resolve(__dirname, 'data/shop.json');
const USERS_DATA_PATH = path.resolve(__dirname, 'data/users.json');

const BUY_LOG_PATH = path.join(__dirname, 'logs/buyLog.json');
const MONEY_LOG_PATH = path.join(__dirname, 'logs/moneyLog.json');

// Initialiser les fichiers JSON s'ils n'existent pas
if (!fs.existsSync(USERS_DATA_FILE)) {
    fs.writeFileSync(USERS_DATA_FILE, JSON.stringify({}, null, 2));
}
if (!fs.existsSync(ACHIEVEMENTS_FILE)) {
    fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2));
}

// GET liste des achievements
app.get('/achievements', (req, res) => {
    res.json(achievements);
});

// GET achievements d'un utilisateur
app.get('/achievements/:userID', (req, res) => {
    const userID = req.params.userID;
    const userData = JSON.parse(fs.readFileSync(USERS_DATA_FILE));

    if (!userData[userID]) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
        userAchievements: userData[userID],
        allAchievements: achievements
    });
});

// Ajouter ou mettre à jour un achievement pour un utilisateur 
app.put('/achievement/:userID/:achievement/:value?', (req, res) => {
    const userID = req.params.userID;
    const achievementID = req.params.achievement;
    const value = parseInt(req.params.value) || 1; // Valeur par défaut de 1 si non spécifiée
    
    if (!achievements[achievementID]) {
        return res.status(404).json({ error: 'Achievement non trouvé' });
    }

    let userData = JSON.parse(fs.readFileSync(USERS_DATA_FILE));
    
    if (!userData[userID]) {
        userData[userID] = [];
    }

    const existingAchievement = userData[userID].find(a => a.name === achievementID);
    const maxValue = achievements[achievementID].maxValue;
    
    if (existingAchievement) {
        existingAchievement.current = Math.min(value, maxValue); // Ne pas dépasser maxValue
    } else {
        userData[userID].push({
            name: achievementID,
            current: Math.min(value, maxValue)
        });
    }

    fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(userData, null, 2));
    res.json({ success: true });
});

// Endpoint to get shop data
app.get('/api/shop', (req, res) => {
    try {
        const shopData = JSON.parse(fs.readFileSync(SHOP_DATA_PATH));
        res.json(shopData);
    } catch (error) {
        console.error('Error reading shop data:', error);
        res.status(500).json({ error: 'Error reading shop data' });
    }
});

app.post('/api/shop', (req, res) => {
    try {
        const shopData = req.body;
        
        // Vérifier que shopData existe et est un tableau
        if (!Array.isArray(shopData)) {
            return res.status(400).json({ error: 'Shop data must be an array' });
        }

        // Écriture des données dans le fichier
        fs.writeFileSync(SHOP_DATA_PATH, JSON.stringify(shopData, null, 4));
        
        res.status(200).json({ message: 'Shop data updated successfully' });
    } catch (error) {
        console.error('Error updating shop data:', error);
        res.status(500).json({ error: 'Error updating shop data' });
    }
});

// Endpoint to edit an item in the shop
app.put('/api/shop/:itemName', (req, res) => {
    const itemName = req.params.itemName;
    const updatedItem = req.body;
    try {
        const shopData = JSON.parse(fs.readFileSync(SHOP_DATA_PATH));
        const itemIndex = shopData.findIndex(item => item.name === itemName);

        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found' });
        }

        shopData[itemIndex] = updatedItem;
        fs.writeFileSync(SHOP_DATA_PATH, JSON.stringify(shopData, null, 4));
        res.status(200).json(updatedItem);
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Error updating item' });
    }
});

app.listen(3000, () => {
    console.log('API des achievements démarrée sur le port 3000');
});

// Endpoint to remove an item from the shop
app.post('/api/remove-item', (req, res) => {
    const { itemName } = req.body;
    try {
        const shopData = JSON.parse(fs.readFileSync(SHOP_DATA_PATH));
        const itemIndex = shopData.findIndex(item => item.name === itemName);

        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found' });
        }

        shopData.splice(itemIndex, 1);
        fs.writeFileSync(SHOP_DATA_PATH, JSON.stringify(shopData, null, 4));
        res.status(200).json({ message: 'Item removed successfully' });
    } catch (error) {
        console.error('Error removing item:', error);
        res.status(500).json({ error: 'Error removing item' });
    }
});

// leaderboard
app.get('/api/bits-leaderboard', async (req, res) => {
    const pointsFile = path.resolve(__dirname, 'data/users.json');
    if (!fs.existsSync(pointsFile)) {
        return res.status(400).json({ error: 'Server not found' });
    }

    const pointsData = JSON.parse(fs.readFileSync(pointsFile, 'utf8'));

    // Convert the points data to an array of [userID, points] pairs
    const pointsArray = pointsData.map(user => [user.id, user.balance]);

    // Sort the array by points in descending order
    pointsArray.sort((a, b) => b[1] - a[1]);

    // Convert the array to an array of objects with id and points properties
    const sortedPointsData = pointsArray.map(([id, balance]) => ({ id, balance }));

    res.json(sortedPointsData);
});

// Endpoint to handle purchases
app.post('/api/buy', (req, res) => {
    const { userId, itemName } = req.body;
    try {
        const shopData = JSON.parse(fs.readFileSync(SHOP_DATA_PATH));
        const usersData = JSON.parse(fs.readFileSync(USERS_DATA_PATH));
        const item = shopData.find(item => item.name === itemName);

        let user = usersData.find(user => user.id === userId);
        // Check if the item exists
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Create user profile if it doesn't exist
        if (!user) {
            user = { id: userId, balance: 0, items: [] };
            usersData.push(user);
        }
        // Check if the user has an items array, if not create one
        if (!user.items) {
            user.items = [];
        }
        // Check if the user already owns the item
        if (user.items.some(userItem => userItem.name === itemName)) {
            return res.status(400).json({ error: 'User already owns this item' });
        }
        // Check if the user has enough balance to purchase the item
        if (user.balance < item.price) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct the item price from the user's balance and add the item to their inventory 
        user.balance -= item.price;
        user.items.push({ name: itemName, date: new Date().toISOString(), used: 0 });
        fs.writeFileSync(USERS_DATA_PATH, JSON.stringify(usersData, null, 4));
        res.status(200).json({ message: 'Purchase successful', item });

        // Log the purchase
        const buyLog = JSON.parse(fs.readFileSync(BUY_LOG_PATH));
        buyLog.push({ userId, itemName, price: item.price, date: new Date().toISOString() });
        fs.writeFileSync(BUY_LOG_PATH, JSON.stringify(buyLog, null, 4));
    } catch (error) {
        console.error('Error processing purchase:', error);
        res.status(500).json({ error: 'Error processing purchase' });
    }
});

// Endpoint to handle using an item
app.post('/api/use', (req, res) => {
    const { userId, itemName } = req.body;
    try {
        const usersData = JSON.parse(fs.readFileSync(USERS_DATA_PATH));
        const user = usersData.find(user => user.id === userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const item = user.items.find(userItem => userItem.name === itemName);

        if (!item) {
            return res.status(404).json({ error: 'Item not found in user inventory' });
        }

        if (item.used === 1) {
            return res.status(400).json({ error: 'Item already used' });
        }

        item.used = 1;
        fs.writeFileSync(USERS_DATA_PATH, JSON.stringify(usersData, null, 4));
        res.status(200).json({ message: 'Item used successfully', item });
    } catch (error) {
        console.error('Error using item:', error);
        res.status(500).json({ error: 'Error using item' });
    }
});

// Endpoint to add money to a user's balance
app.post('/api/add-money', (req, res) => {
    const { userId, amount } = req.body;
    try {
        const usersData = JSON.parse(fs.readFileSync(USERS_DATA_PATH));
        let user = usersData.find(user => user.id === userId);

        if (!user) {
            // Create user profile if it doesn't exist
            user = { id: userId, balance: 0 };
            usersData.push(user);
        }

        // Log the transaction in the moneyLog.json file
        const moneyLog = JSON.parse(fs.readFileSync(MONEY_LOG_PATH));
        moneyLog.push({ userId, amount, date: new Date().toISOString() });
        fs.writeFileSync(MONEY_LOG_PATH, JSON.stringify(moneyLog, null, 4));

        user.balance += amount;
        fs.writeFileSync(USERS_DATA_PATH, JSON.stringify(usersData, null, 4));
        res.status(200).json({ message: 'Money added successfully', balance: user.balance });
    } catch (error) {
        console.error('Error adding money:', error);
        res.status(500).json({ error: 'Error adding money' });
    }
});

// Endpoint to get a user's balance
app.get('/api/balance', (req, res) => {
    const { userId } = req.query;
    try {
        const usersData = JSON.parse(fs.readFileSync(USERS_DATA_PATH));
        const user = usersData.find(user => user.id === userId);

        if (!user) {
            return res.status(404).json({ error: '0' });
        }

        res.status(200).json({ balance: user.balance });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: 'Error fetching balance' });
    }
});

// Endpoint to get a user's inventory
app.get('/api/inventory', (req, res) => {
    const { userId } = req.query;
    try {
        const usersData = JSON.parse(fs.readFileSync(USERS_DATA_PATH));
        const user = usersData.find(user => user.id === userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ inventory: user.items || [] });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Error fetching inventory' });
    }
});

// Endpoint to remove money from a user's balance
app.post('/api/remove-money', (req, res) => {
    const { userId, amount } = req.body;
    try {
        const usersData = JSON.parse(fs.readFileSync(USERS_DATA_PATH));
        let user = usersData.find(user => user.id === userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        user.balance -= amount;
        fs.writeFileSync(USERS_DATA_PATH, JSON.stringify(usersData, null, 4));
        res.status(200).json({ message: 'Money removed successfully', balance: user.balance });
    } catch (error) {
        console.error('Error removing money:', error);
        res.status(500).json({ error: 'Error removing money' });
    }
});