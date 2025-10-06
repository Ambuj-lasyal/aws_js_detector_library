express = require('express')
db = require('./db')

let router = new express.Router()

let search_params = {
    q: ['code IN(SELECT code from en_fts where en_fts MATCH (?))', x=>`"${x}"`],
    brands: ["brands LIKE (?)", x=>x],
    nutriscore: [`nutriscore_grade = ?`, x=>x],
    novascore: [`nova_group = ?`, x=>x],
    ecoscore: [`ecoscore_grade_fr = ?`, x=>x],
    category: ["pnns_groups_1 = ?", x=>x],
    subcategory: ["pnns_groups_2 = ?", x=>x]
}

let categories = {
    "unknown": [
        "unknown"
    ],
    "Fat and sauces": [
        "Dressings and sauces",
        "Fats"
    ],
    "Composite foods": [
        "One-dish meals",
        "Pizza pies and quiches",
        "Sandwiches",
        "Pizza pies and quiche",
    ],
    "Sugary snacks": [
        "Biscuits and cakes",
        "Sweets",
        "Pastries",
        "Chocolate products",
    ],
    "Fruits and vegetables": [
        "Fruits",
        "Dried fruits",
        "Vegetables",
        "Soups",
    ],
    "Fish Meat Eggs": [
        "Meat",
        "Fish and seafood",
        "Processed meat",
        "Eggs",
        "Offals",
    ],
    "Beverages": [
        "Sweetened beverages",
        "Fruit juices",
        "Unsweetened beverages",
        "Plant-based milk substitutes",
        "Teas and herbal teas and coffees",
        "Artificially sweetened beverages",
        "Waters and flavored waters",
        "Fruit nectars",
    ],
    "Milk and dairy products": [
        "Cheese",
        "Dairy desserts",
        "Milk and yogurt",
        "Ice cream",
    ],
    "Cereals and potatoes": [
        "Bread",
        "Legumes",
        "Cereals",
        "Breakfast cereals",
        "Potatoes",
    ],
    "Salty snacks": [
        "Salty and fatty products",
        "Nuts",
        "Appetizers",
    ],
    "Alcoholic beverages": [
        "Alcoholic beverages"
    ],
}

router.get('/search', async (req, res) => {
    try {
        console.log(req.query)
        if (Object.keys(req.query).length === 0) {
            res.status(400).send("Empty query")
            return
        }
        let sql_criteria = []
        let sql_query = []
        for (criteria of Object.keys(search_params)) {
            if (req.query[criteria]) {
                let [subquery, subCriteriaFormat] = search_params[criteria]
                if (req.query[criteria] instanceof Array){
                    sql_query.push(req.query[criteria].map(x => subquery))
                    req.query[criteria].forEach(x => sql_criteria.push(subCriteriaFormat(x)))
                } else {
                    sql_query.push(subquery)
                    sql_criteria.push(subCriteriaFormat(req.query[criteria]))
                }
                if (sql_query[-1] === false) {
                    res.status(400).send("Invalid query")
                    return
                }
            }
        }
        sql_query = `SELECT * FROM en WHERE (${sql_query.map(x => x instanceof Array ? `(${x.join(" OR ")})`:x).join(" AND ")}) LIMIT 20;`
        console.log(sql_query, sql_criteria)
        let data = await new Promise((resolve, reject) => {
            db.all(sql_query, sql_criteria, (err, rows) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(rows)
                }
            })
        })
        res.json(data)
    } catch (e) {
        console.error(e)
        res.status(500).send("Internal server error")
    }
})

router.get('/product/:id', async (req, res) => {
    res.json(await new Promise((resolve, reject) => {
            db.get("SELECT * FROM en WHERE code = ?", req.params.id, (err, row) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(row)
                }
            })
        }
    ))
})

router.get('/categories', async (req, res) => {
    res.json(categories)
})

module.exports = router