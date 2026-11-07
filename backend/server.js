const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const robot = require("robotjs");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Permite acesso de qualquer origem (útil para testar de outros dispositivos)
        methods: ["GET", "POST"]
    }
});

// Pega o tamanho da tela do computador
const screenSize = robot.getScreenSize();
let isPaused = false;
let isDragging = false;

console.log(`Servidor iniciado. Resolução detectada: ${screenSize.width}x${screenSize.height}`);

io.on('connection', (socket) => {
    console.log('🟢 Novo controle conectado:', socket.id);

    // Movimentação do mouse
    socket.on('mouse_move', (data) => {
        if (isPaused || isDragging) return; // Se estiver pausado ou arrastando, ignora o movimento normal

        // Converte a coordenada da câmera (0 a 1) para a tela real
        const x = Math.round(data.x * screenSize.width);
        const y = Math.round(data.y * screenSize.height);
        robot.moveMouse(x, y);
    });

    // Ações de Clique e Arrastar
    socket.on('action', (data) => {
        switch (data.type) {
            case 'click':
                robot.mouseClick();
                console.log('🖱️ Clique');
                break;
            case 'drag_start':
                robot.mouseToggle("down");
                isDragging = true;
                console.log('✊ Arrastando iniciado');
                break;
            case 'drag_end':
                robot.mouseToggle("up");
                isDragging = false;
                console.log('🖐️ Arrastando finalizado');
                break;
            case 'pause':
                isPaused = data.state;
                console.log(isPaused ? '⏸️ Rastreamento Pausado' : '▶️ Rastreamento Retomado');
                break;
            case 'back':
                // Simula o atalho Alt + Seta Esquerda (Voltar no navegador)
                robot.keyTap("left", ["alt"]);
                console.log('⬅️ Voltar');
                break;
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Controle desconectado');
        if (isDragging) {
            robot.mouseToggle("up"); // Segurança: solta o mouse se desconectar no meio de um arrasto
            isDragging = false;
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});
