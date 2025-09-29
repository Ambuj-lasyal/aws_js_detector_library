
console.log('Carregando apiRoutes.js...');
const express = require('express');
const router = express.Router();
const apiController = require('../routes.js');

router.post('/index.html', app.js.index);

module.exports = router;



/*  Configurando a area do websocket*/
console.log('Carregando websocket.js...');

// Determinar a URL do WebSocket dinamicamente
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const wsUrl = isLocalhost ? 'ws://localhost:3000' : `wss://${window.location.hostname}`;
console.log('Conectando ao WebSocket:', wsUrl);
const ws = new WebSocket(wsUrl);

document.addEventListener('DOMContentLoaded', () => {
  let replyingTo = null;

  ws.onopen = () => {
    console.log('Conectado ao WebSocket');
    if (document.getElementById('adminChatBox')) {
      console.log('Solicitando histórico do admin...');
      ws.send(JSON.stringify({ type: 'loadAdminHistory' }));
    }
  };

  ws.onmessage = (event) => {
    console.log('Mensagem recebida do WebSocket:', event.data);
    try {
      const data = JSON.parse(event.data);
      const chatBox = document.getElementById('chatBox');
     
      if (data.type === 'chat' && chatBox) {
        console.log('Adicionando mensagem ao chatBox:', data);
        const message = document.createElement('div');
        message.className = `chat-message ${data.sender || 'system'}`;
        message.dataset.id = data.id;
        let messageContent = '';
        if (data.replyTo) {
          messageContent += `
            <div class="quoted-message">
              Respondendo a ${data.replyTo.usuario}: ${data.replyTo.mensagem}
            </div>`;
        }
        messageContent += `
          ${data.mensagem}
          <div class="timestamp">${data.timestamp}</div>
          <button class="reply-button">Responder</button>
        `;
        message.innerHTML = messageContent;
        chatBox.appendChild(message);
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
      }

      if (data.type === 'admin' && (chatBox || adminChatBox)) {
        console.log('Adicionando mensagem ao admin/chatBox:', data);
        const message = document.createElement('div');
        message.className = `chat-message ${data.sender || 'admin'}`;
        message.dataset.id = data.id;
        let messageContent = '';
        if (data.replyTo) {
          messageContent += `
            <div class="quoted-message">
              Respondendo a ${data.replyTo.usuario}: ${data.replyTo.mensagem}
            </div>`;
        }
        messageContent += `
          ${data.mensagem}
          <div class="timestamp">${data.timestamp}</div>
          <button class="reply-button">Responder</button>
        `;
        message.innerHTML = messageContent;
        if (chatBox) {
          chatBox.appendChild(message);
          chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        }
        if (adminChatBox) {
          adminChatBox.appendChild(message);
          adminChatBox.scrollTo({ top: adminChatBox.scrollHeight, behavior: 'smooth' });
        }
      }

      if (data.type === 'adminHistory' && adminChatBox) {
        console.log('Carregando histórico do admin:', data.messages);
        data.messages.forEach(msg => {
          const message = document.createElement('div');
          message.className = `chat-message ${msg.sender}`;
          message.dataset.id = msg.id;
          let messageContent = '';
          if (msg.replyTo) {
            messageContent += `
              <div class="quoted-message">
                Respondendo a ${msg.replyTo.usuario}: ${msg.mensagem}
              </div>`;
          }
          messageContent += `
            ${msg.mensagem}
            <div class="timestamp">${msg.timestamp}</div>
            <button class="reply-button">Responder</button>
          `;
          message.innerHTML = messageContent;
          adminChatBox.appendChild(message);
        });
        adminChatBox.scrollTo({ top: adminChatBox.scrollHeight, behavior: 'smooth' });
      }

      if (data.type === 'estoque' && estoqueTable) {
        console.log('Atualizando tabela de estoque:', data.items);
        estoqueTable.innerHTML = '';
        data.items.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.produto}</td>
            <td>${item.quantidade}</td>
            <td>R$ ${item.preco.toFixed(2)}</td>
            <td>${new Date(item.ultimaAtualizacao).toLocaleString('pt-BR')}</td>
          `;
          estoqueTable.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Erro ao processar mensagem WebSocket:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('Erro no WebSocket:', error);
  };

  ws.onclose = () => {
    console.log('Conexão WebSocket fechada');
  };

  const chatForm = document.getElementById('chatForm');
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('Enviando mensagem de chat...');
      const usuario = document.getElementById('usuario')?.value;
      const cidade = document.getElementById('cidade')?.value || 'Desconhecida';
      const mensagem = document.getElementById('mensagem')?.value;
      if (usuario && mensagem) {
        const messageData = { type: 'chat', usuario, cidade, mensagem, sender: 'user' };
        if (replyingTo) {
          messageData.replyTo = replyingTo;
        }
        ws.send(JSON.stringify(messageData));
        document.getElementById('mensagem').value = '';
        const replyPreview = document.getElementById('replyPreview');
        if (replyPreview) replyPreview.style.display = 'none';
        replyingTo = null;
        document.getElementById('mensagem')?.focus();
      } else {
        console.error('Campos de formulário incompletos:', { usuario, mensagem });
      }
    });
  }

  const adminForm = document.getElementById('adminForm');
  if (adminForm) {
    adminForm.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('Enviando mensagem de admin...');
      const mensagemInput = document.getElementById('adminMensagem');
      if (!mensagemInput) {
        console.error('Elemento #adminMensagem não encontrado');
        return;
      }
      const mensagem = mensagemInput.value.trim();
      if (mensagem) {
        const messageData = { 
          type: 'admin', 
          usuario: 'Administrador', 
          mensagem, 
          sender: 'admin',
          timestamp: new Date().toISOString()
        };
        if (replyingTo) {
          messageData.replyTo = replyingTo;
        }
        ws.send(JSON.stringify(messageData));
        mensagemInput.value = '';
        const replyPreview = document.getElementById('replyPreview');
        if (replyPreview) replyPreview.style.display = 'none';
        replyingTo = null;
        mensagemInput.focus();
      } else {
        console.error('Campo de mensagem do admin vazio');
      }
    });
  } else {
    console.error('Formulário #adminForm não encontrado');
  }

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('reply-button')) {
      const messageDiv = e.target.closest('.chat-message');
      const messageId = messageDiv.dataset.id;
      const messageText = messageDiv.querySelector(':not(.timestamp):not(.quoted-message)').textContent.trim();
      const sender = messageDiv.className.includes('user') ? messageDiv.textContent.split(':')[0] : 
                    messageDiv.className.includes('admin') ? 'Administrador' : 'Sistema';
      replyingTo = { id: messageId, usuario: sender, mensagem: messageText };

      const replyPreview = document.getElementById('replyPreview');
      if (replyPreview) {
        replyPreview.style.display = 'block';
        replyPreview.innerHTML = `
          Respondendo a ${sender}: ${messageText}
          <button id="cancelReply">Cancelar</button>
        `;
        document.getElementById('mensagem')?.focus();
        document.getElementById('adminMensagem')?.focus();

        document.getElementById('cancelReply')?.addEventListener('click', () => {
          replyingTo = null;
          replyPreview.style.display = 'none';
        });
      }
    }
  });
});



/*Configurando o Controlador*/

console.log('Carregando apiController.js...');


exports.contato = async (req, res) => {
  console.log('Processando requisição de contato...');
  try {
    const { nome, email, mensagem } = req.body;

    if (!nome || !email || !mensagem) {
      console.log('Campos obrigatórios faltando:', { nome, email, mensagem });
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    const dados = await readDados();
    const novoContato = {
      id: dados.contato.length + 1,
      nome,
      email,
      mensagem,
      data: new Date().toISOString()
    };

    dados.contato.push(novoContato);
    await writeDados(dados);

    console.log('Contato salvo com sucesso:', novoContato);
    res.json({ message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao processar contato:', error.message);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};