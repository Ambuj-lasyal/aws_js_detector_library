const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const dns = require("dns");
const cors = require ('cors')

app.use(cors())
"use client";
import {useState} from "react";

dns.setDefaultResultOrder("ipv4first");

//configuração do mongodb
const uri = `mongodb+srv://PIMaua:PiMaua@cluster0.mefla.mongodb.net/dbcontato`;
const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient(uri); 

mongoose.connect(`mongodb+srv://PIMaua:PiMaua@cluster0.mefla.mongodb.net/dbcontato`)

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// Configuração do servidor
console.log("server up & running");

export default function ContactForm(){
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [mensagem, setMensagem] = useState("");
}

  app.get("/contato", (req, res) => {
    res.json(contato)
    })
  
  
 let db;

client.connect((err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados:", err);
        process.exit(1);
    }
    db = client.db("dbcontato");
    console.log("Conectado ao banco de dados!");
});

app.post("/contato", function (req, resp) {
    db.collection("contato").insertOne(
        {
            db_nome: req.body.nome,
            db_email: req.body.email,
            db_mensagem: req.body.mensagem,
        },
        (err) => {
            if (err) {
                resp.render("resposta", { resposta: "Falha ao contatar" });
            } else {
                db.collection("contato").find().toArray((err, items) => {
                    if (err) {
                        console.error(err);
                        return resp.status(500).send("Erro ao buscar dados.");
                    }
                    resp.render("contato", { posts: items });
                });
            }
        }
    );
});

  
  

// Inicia o servidor na porta 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

function openModal(imgElement) {
    var modal = document.getElementById("imageModal");
    var modalImg = document.getElementById("modalImage");
    var captionText = document.getElementById("caption");

    modal.style.display = "block";
    modalImg.src = imgElement.src; // Define a imagem do modal
    captionText.innerHTML = imgElement.alt; // Define a legenda da imagem
}

function closeModal() {
    var modal = document.getElementById("imageModal");
    modal.style.display = "none";
}

app.post('/contato', (req, res) => {
    // Lógica de processamento do formulário
    res.send('Formulário enviado com sucesso');
});


app.use(express.urlencoded({ extended: true })); // Necessário para capturar dados de formulários