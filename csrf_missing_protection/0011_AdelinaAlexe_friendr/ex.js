const express = require('express')
const router = express.Router()

//TODO remove
const users = [
    { id: 1, firstName: 'Forrest', lastName: 'Gump' },
    { id: 2, firstName: 'Hari', lastName: 'Sheldon' },
    { id: 3, firstName: 'Tom', lastName: 'Cruise'}
];

// id pe query : ex-> http://localhost:3006/users?id=23
router.get('/', (req, res) => {
        //console.log(req.body);
        const id = req.query.id;
        let found = false;
        // for ( let i = 0; i < users.length; i++) {
        //     if (users[i].id == id) {
        //         res.send('id:' + users[i].id + ' firstName:' + users[i].firstName + ' lastName:' + users[i].lastName);
        //         console.log('id:' + users[i].id + ' firstName:' + users[i].firstName + ' lastName:' + users[i].lastName);
        //         return;
        //     }
        //     }
        for ( const user of users )
            {
                if (user.id == id) {
                    res.send('id:' + user.id + ' firstName:' + user.firstName + ' lastName:' + user.lastName);
                    console.log('id:' + user.id + ' firstName:' + user.firstName + ' lastName:' + user.lastName);
                    found = true;
                    return;
                }
            }

        if ( found == false ) {
            res.status(404);
            res.send('User not found');
        }
        //console.log(id);
        //res.send('id: ' + id);
      })

router.post('/', (req, res) => {
    console.log(req.body);
    res.status(201);
    res.send('The user successfully created');
  })

module.exports = router