const express = require('express');

const app = express();
const port = 3000;

// Los Endpoints son rutas a las cuales puedes llegar a través de peticiones HTTP

// Request(Solicitud petición HTTP)
// Response(Respuesta petición HTTP)
// Endpoint para acceder a un recurso

// 200 Ok
// 201 Ok Created
// 204 Ok No Content (Put, Patch, Delete)

// get (Obtener recurso) endpoint
// post (Crear recurso) endpoint
// put (Actualizar recurso) endpoint
// patch (Actualizar recurso parcialmente) endpoint
// delete (Eliminar recurso) endpoint

// se puede usar para autenticar, validar, transformar datos, etc.
app.get('/', (req, res) => {
    res.status(200).send('Hello World!');
});

// No se puede acceder a la ruta directamente desde el navegador
app.post('/', (req, res) => {
    res.status(201).send('Resource created successfully!');
});

app.get('/:id', (req, res) => {
    console.log(req.params.id);
    res.status(200).send(req.params.id);
});

app.put('/:id', (req, res) => {
    res.sendStatus(204);
});

app.patch('/:id', (req, res) => {
    res.sendStatus(204);
});

app.delete('/:id', (req, res) => {
    res.sendStatus(204);
});

// Endpoint para actualizar un recurso
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});