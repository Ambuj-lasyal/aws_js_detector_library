const express = require('express');
const app = express()

const dotenv = require("dotenv")
dotenv.config()

const port = process.env.port || 8000

const connectToDB = require('./database/db');
const { Todo } = require('./models/todo.model');


const time = new Date()

//middleware
app.use(express.json())


connectToDB()



//TODO APIs
app.get('/get', async (req, res) => {
    try{
        const result = await Todo.find()
        res.send({
            success: true,
            message: "Todo retrieved successfully",
            data: result,
        })

    } catch(error) {
        res.send({
            success: false,
            message: "Fail Todo",
            data: result,
        })
    }
})



app.post('/create', async (req, res) => {
    let result_data = await req.body
    const result = Todo.create(result_data)
    res.send({
        a: "updated success"
    })
})

app.get('/:todo', async (req, res) => {
    const item = req.params.todo
    const result = await Todo.findById(item)
    res.send({
        message: "retrieved happily",
        data : result
    })
})


app.patch('/:todoId', async (req, res) => {
    const oldId = req.params.todoId
    const change = req.body
    const updated = await Todo.findByIdAndUpdate(oldId, change, {new: true})
    res.send({
        msg : "updates",
        content: updated
    })
})



app.delete('/delete/:todoIdD', async (req, res) => {
    await Todo.findByIdAndDelete(req.params.todoIdD)
    res.status(200).send({
        key : "del success"
    })
})




app.listen(port, () => {
    console.log("The server is running on http://localhost:"+ port)
})