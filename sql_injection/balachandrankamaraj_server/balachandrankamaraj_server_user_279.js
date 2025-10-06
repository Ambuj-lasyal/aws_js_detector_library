const db = require('./database');

const init = async () => {
  await db.run('CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, name varchar(32));');
  await db.run('CREATE TABLE Friends (id INTEGER PRIMARY KEY AUTOINCREMENT, userId int, friendId int);');
  await db.run('CREATE INDEX name_idx ON Users (name);');
  const users = [];
  const names = ['foo', 'bar', 'baz'];
  for (i = 0; i < 27000; ++i) {
    let n = i;
    let name = '';
    for (j = 0; j < 3; ++j) {
      name += names[n % 3];
      n = Math.floor(n / 3);
      name += n % 10;
      n = Math.floor(n / 10);
    }
    users.push(name);
  }
  const friends = users.map(() => []);
  for (i = 0; i < friends.length; ++i) {
    const n = 10 + Math.floor(90 * Math.random());
    const list = [...Array(n)].map(() => Math.floor(friends.length * Math.random()));
    list.forEach((j) => {
      if (i === j) {
        return;
      }
      if (friends[i].indexOf(j) >= 0 || friends[j].indexOf(i) >= 0) {
        return;
      }
      friends[i].push(j);
      friends[j].push(i);
    });
  }
  console.log("Init Users Table...");
  await Promise.all(users.map((un) => db.run(`INSERT INTO Users (name) VALUES ('${un}');`)));
  console.log("Init Friends Table...");
  await Promise.all(friends.map((list, i) => {
    return Promise.all(list.map((j) => db.run(`INSERT INTO Friends (userId, friendId) VALUES (${i + 1}, ${j + 1});`)));
  }));
  console.log("Adding Index...");
  await db.run('CREATE INDEX Friends_unq ON Friends(friendId);');
  await db.run('CREATE UNIQUE INDEX UserFriends_unq ON Friends(userId, friendId);');
  console.log("Ready.");
}
module.exports.init = init;

const search = async (req, res) => {
  const query = req.params.query;
  const limit = req.query.pagesize || 40;
  const connection = req.query.maxconnection || 5;
  const userId = parseInt(req.params.userId);

  let sqlquery = `SELECT u.id, u.name, 
  case 
    when u.id IN (${userId}) then -1 
    when (SELECT f1.userId from Friends f1 where f1.userId = ${userId} limit 1) IS null then 0 
    `;
    for(let i = 0; i<connection ; i++){
      let selectquery = `SELECT f${i+1}.friendId from Friends f1 `;
      for(let j = 1; j<=i ; j++){
        selectquery += `inner join Friends f${j+1} on f${j+1}.userId = f${j}.friendId `;
      }
      selectquery = `${selectquery} where u.id = f${i+1}.friendId and f1.userId = ${userId} limit 1 `;
      sqlquery += `when u.id IN (${selectquery}) then ${i+1} 
      `;
      
    }
    // when u.id IN (SELECT f1.friendId from Friends f1 where u.id = f1.friendId and f1.userId = ${userId} limit 1) then 1 
    // when u.id IN (SELECT f2.friendId from Friends f1 inner join Friends f2 on f2.userId = f1.friendId where u.id = f2.friendId and f1.userId = ${userId} limit 1) then 2 
    // when u.id IN (SELECT f3.friendId from Friends f1 inner join Friends f2 on f2.userId = f1.friendId inner join Friends f3 on f3.userId = f2.friendId where u.id = f3.friendId and f1.userId = ${userId} limit 1) then 3
    // when u.id IN (SELECT f4.friendId from Friends f1 inner join Friends f2 on f2.userId = f1.friendId inner join Friends f3 on f3.userId = f2.friendId inner join Friends f4 on f4.userId = f3.friendId where u.id = f4.friendId and f1.userId = ${userId} limit 1) then 4 
  sqlquery += ` ELSE 0
  end as connection
  from Users u where name LIKE '${query}%'`;
  if(limit > 0){
    sqlquery += ` LIMIT ${limit}`
  }
    console.log(sqlquery)
  db.all(sqlquery).then((results) => {
    res.statusCode = 200;
    res.json({
      success: true,
      users: results
    });
  }).catch((err) => {
    console.error(err)
    res.statusCode = 500;
    res.json({ success: false, error: err });
  });
}

const addFriend = async (req, res) => {
  const friendId = req.params.friendId;
  const userId = parseInt(req.params.userId);

  db.run(`INSERT INTO Friends (userId, friendId) values (${userId}, ${friendId}) `).then((results) => {
    res.statusCode = 200;
    res.json({
      success: true
    });
  }).catch((err) => {
    res.statusCode = 500;
    res.json({ success: false, error: err });
  });
}


const removeFriend = async (req, res) => {
  const friendId = req.params.friendId;
  const userId = parseInt(req.params.userId);

  db.run(`DELETE FROM Friends WHERE userId = ${userId} AND friendId = ${friendId} `).then((results) => {
    res.statusCode = 200;
    res.json({
      success: true
    });
  }).catch((err) => {
    res.statusCode = 500;
    res.json({ success: false, error: err });
  });
}
module.exports.search = search;
module.exports.addFriend = addFriend;
module.exports.removeFriend = removeFriend;