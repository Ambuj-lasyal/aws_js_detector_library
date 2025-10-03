var express = require('express');
var router = express.Router();
const request = require('request');
const fetch = require('node-fetch');
//const config = require(config);

/* GET home page. */
router.post('/a', function(req, res, next) {
    // var city = document.getElementById("citya").value;
    let getwether = function(city){
        return new Promise(function (resolve, reject) {
            request("https://api.openweathermap.org/data/2.5/weather?q=+"+city+"&appid=4a837eced20b2c7a61d6e981ce116dfa", function (error, response, body){  //another example of err-first pattern
                if (error)

                    throw new Error(error)
                else {
                    resolve(body)
                }
            })
        })
    }

    getwether(req.body.city)
        .then(function (body){
            res.render('design1', {city:req.body.city, temp:JSON.parse(body).main.temp});
        })
});
router.post('/b', function(req, res, next) {
    let getwether = async function(city){

        let returnValueRaw = await fetch("https://api.openweathermap.org/data/2.5/weather?q=+"+city+"&appid=4a837eced20b2c7a61d6e981ce116dfa"); //another example of err-first pattern
        let returnValue = await returnValueRaw.json();
        return returnValue;
    }

    getwether(req.body.city)
        .then(function (returnValue){
            res.render('design1', {city:req.body.city, temp:returnValue.main.temp});
        })
});

router.post('/ps4/data', async (req, res) => {
    const cacheKey = 'apiData'; // Unique key for cache entry
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
        return res.json({ data: JSON.parse(cachedData), fromCache: true });
    } else {
        // Replace this with your actual API call logic
        const apiResponse = await fetchYourAPIData();

        // Cache the response for 15 seconds
        await redisClient.setEx(cacheKey, 15, JSON.stringify(apiResponse));

        return res.json({ data: apiResponse, fromCache: false });
    }
});

module.exports = router;