const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');
const btnConnect = document.getElementById('btn-connect');
const statusDiv = document.getElementById('status');

let socket;
let isPaused = false;
let isDragging = false;

// Conecta ao backend Node.js
function connectSocket() {
    // O IP deve ser o do computador rodando o backend. 
    // Se estiver rodando o frontend no mesmo PC, use localhost.
    socket = io('http://localhost:3000');

    socket.on('connect', () => {
        statusDiv.textContent = 'Conectado ao Servidor';
        statusDiv.className = 'status connected';
        console.log('Conectado ao backend!');
    });

    socket.on('disconnect', () => {
        statusDiv.textContent = 'Desconectado';
        statusDiv.className = 'status disconnected';
    });
}

// Função chamada pelo MediaPipe quando uma mão é detectada
function onResults(results) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Desenha os pontos da mão
        for (const landmark of landmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(landmark.x * canvasElement.width, landmark.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fillStyle = '#89b4fa';
            canvasCtx.fill();
        }

        // --- Lógica de Detecção de Gestos ---
        
        // 1. Verifica dedos levantados (Y menor = mais alto na tela)
        const indexUp = landmarks[8].y < landmarks[6].y;
        const middleUp = landmarks[12].y < landmarks[10].y;
        const ringUp = landmarks[16].y < landmarks[14].y;
        const pinkyUp = landmarks[20].y < landmarks[18].y;
        
        // 2. Gesto Pausar: Todos os dedos levantados
        const openHand = indexUp && middleUp && ringUp && pinkyUp;
        
        // 3. Gesto Voltar (L): Polegar e indicador levantados, outros abaixados
        const thumbUp = landmarks[4].x < landmarks[3].x; // Lógica simples para polegar
        const isLShape = thumbUp && indexUp && !middleUp && !ringUp && !pinkyUp;

        // 4. Gesto Pinça: Distância entre polegar (4) e indicador (8)
        const distance = Math.hypot(landmarks[8].x - landmarks[4].x, landmarks[8].y - landmarks[4].y);
        const isPinching = distance < 0.05;

        // 5. Gesto Punho: Nenhum dedo levantado
        const isFist = !indexUp && !middleUp && !ringUp && !pinkyUp && !thumbUp;

        // --- Execução das Ações ---
        
        if (openHand && !isPaused) {
            isPaused = true;
            socket.emit('action', { type: 'pause', state: true });
            canvasCtx.fillStyle = "rgba(243, 139, 168, 0.5)"; // Overlay avermelhado
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        } else if (!openHand && isPaused) {
            isPaused = false;
            socket.emit('action', { type: 'pause', state: false });
        }

        if (!isPaused) {
            if (isLShape) {
                socket.emit('action', { type: 'back' });
            } else if (isPinching) {
                socket.emit('action', { type: 'click' });
            } else if (isFist && !isDragging) {
                isDragging = true;
                socket.emit('action', { type: 'drag_start' });
            } else if (!isFist && isDragging) {
                isDragging = false;
                socket.emit('action', { type: 'drag_end' });
            } else if (indexUp && !isPinching && !isFist && !isLShape) {
                // Mover mouse (Inverte X porque o vídeo está espelhado)
                socket.emit('mouse_move', { x: 1 - landmarks[8].x, y: landmarks[8].y });
                
                // Desenha um círculo no dedo indicador
                canvasCtx.beginPath();
                canvasCtx.arc(landmarks[8].x * canvasElement.width, landmarks[8].y * canvasElement.height, 15, 0, 2 * Math.PI);
                canvasCtx.fillStyle = 'rgba(166, 227, 161, 0.6)';
                canvasCtx.fill();
            }
        }
    }
    canvasCtx.restore();
}

// Inicialização do MediaPipe
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});
hands.onResults(onResults);

// Iniciar Câmera
btnConnect.addEventListener('click', async () => {
    connectSocket();
    btnConnect.disabled = true;
    btnConnect.textContent = "Câmera Ativa";

    try {
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        camera.start();
    } catch (error) {
        console.error("Erro ao acessar a câmera:", error);
        alert("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
});
