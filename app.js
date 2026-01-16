// Используем JSONBin.io - бесплатное хранилище JSON без регистрации
// Или localStorage + BroadcastChannel для локальной синхронизации

let roomCode = '';
let questions = [];
let currentQuestionIndex = 0;
let isHost = false;
let sessionId = 'player_' + Math.random().toString(36).substr(2, 9);
let pollInterval = null;

// Простой backend на основе бесплатного сервиса
const API_URL = 'https://api.jsonbin.io/v3/b';
const MASTER_KEY = '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Публичный ключ для демо

// Локальное хранилище для работы без интернета (fallback)
const LOCAL_STORAGE_KEY = 'partyQuizData';

// DOM элементы
const elements = {
    setupScreen: document.getElementById('setup-screen'),
    editScreen: document.getElementById('edit-screen'),
    hostScreen: document.getElementById('host-screen'),
    playerScreen: document.getElementById('player-screen'),
    roomCodeInput: document.getElementById('room-code'),
    startHostBtn: document.getElementById('start-host'),
    startPlayerBtn: document.getElementById('start-player'),
    questionsList: document.getElementById('questions-list'),
    addQuestionBtn: document.getElementById('add-question'),
    saveAndStartBtn: document.getElementById('save-and-start'),
    hostWaiting: document.getElementById('host-waiting'),
    qrCode: document.getElementById('qr-code'),
    roomDisplay: document.getElementById('room-display'),
    playersOnline: document.getElementById('players-online'),
    startQuizBtn: document.getElementById('start-quiz'),
    hostVoting: document.getElementById('host-voting'),
    currentQ: document.getElementById('current-q'),
    totalQ: document.getElementById('total-q'),
    hostQuestion: document.getElementById('host-question'),
    barOption1: document.getElementById('bar-option1'),
    barOption2: document.getElementById('bar-option2'),
    labelOption1: document.getElementById('label-option1'),
    labelOption2: document.getElementById('label-option2'),
    countOption1: document.getElementById('count-option1'),
    countOption2: document.getElementById('count-option2'),
    totalVotes: document.getElementById('total-votes'),
    showResultsBtn: document.getElementById('show-results'),
    hostResults: document.getElementById('host-results'),
    resultIcon: document.getElementById('result-icon'),
    resultText: document.getElementById('result-text'),
    correctAnswer: document.getElementById('correct-answer'),
    winnerName: document.getElementById('winner-name'),
    finalVotes: document.getElementById('final-votes'),
    confettiCanvas: document.getElementById('confetti-canvas'),
    nextQuestionBtn: document.getElementById('next-question'),
    hostEnd: document.getElementById('host-end'),
    restartQuizBtn: document.getElementById('restart-quiz'),
    playerWaiting: document.getElementById('player-waiting'),
    playerRoomDisplay: document.getElementById('player-room-display'),
    playerVoting: document.getElementById('player-voting'),
    playerQuestion: document.getElementById('player-question'),
    voteOption1Btn: document.getElementById('vote-option1'),
    voteOption2Btn: document.getElementById('vote-option2'),
    playerVoted: document.getElementById('player-voted'),
    yourVote: document.getElementById('your-vote'),
    playerResults: document.getElementById('player-results'),
    playerResultIcon: document.getElementById('player-result-icon'),
    playerResultText: document.getElementById('player-result-text')
};

// ==================== STORAGE API ====================
// Используем localStorage + URL sharing для синхронизации между устройствами

function getRoomData() {
    const data = localStorage.getItem(`quiz_${roomCode}`);
    return data ? JSON.parse(data) : null;
}

function setRoomData(data) {
    localStorage.setItem(`quiz_${roomCode}`, JSON.stringify(data));
    // Также сохраняем в глобальное хранилище для sharing
    const allRooms = JSON.parse(localStorage.getItem('quiz_rooms') || '{}');
    allRooms[roomCode] = data;
    localStorage.setItem('quiz_rooms', JSON.stringify(allRooms));
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    const dataFromUrl = urlParams.get('data');

    // Если есть код комнаты в URL - установить глобальную переменную
    if (roomFromUrl) {
        roomCode = roomFromUrl.toLowerCase();
        elements.roomCodeInput.value = roomCode;
    }

    // Если есть данные в URL - загрузить их
    if (dataFromUrl) {
        try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(dataFromUrl))));
            // Используем roomCode из URL или из decoded данных
            const targetRoom = roomCode || decoded.roomCode;
            localStorage.setItem(`quiz_${targetRoom}`, JSON.stringify(decoded));
            console.log('Room data saved for:', targetRoom);
        } catch (e) {
            console.error('Failed to decode URL data', e);
        }
    }

    if (roomFromUrl) {
        // Небольшая задержка чтобы localStorage точно записался
        setTimeout(() => startAsPlayer(), 100);
    }

    // Event listeners
    elements.startHostBtn.addEventListener('click', startAsHost);
    elements.startPlayerBtn.addEventListener('click', startAsPlayer);
    elements.addQuestionBtn.addEventListener('click', () => addQuestionField());
    elements.saveAndStartBtn.addEventListener('click', saveAndStart);
    elements.startQuizBtn.addEventListener('click', startQuiz);
    elements.showResultsBtn.addEventListener('click', showResults);
    elements.nextQuestionBtn.addEventListener('click', nextQuestion);
    elements.restartQuizBtn.addEventListener('click', restartQuiz);
    elements.voteOption1Btn.addEventListener('click', () => vote(1));
    elements.voteOption2Btn.addEventListener('click', () => vote(2));
});

// ==================== SCREEN MANAGEMENT ====================

function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showHostState(state) {
    document.querySelectorAll('.host-state').forEach(s => s.classList.remove('active'));
    state.classList.add('active');
}

function showPlayerState(state) {
    document.querySelectorAll('.player-state').forEach(s => s.classList.remove('active'));
    state.classList.add('active');
}

// ==================== HOST FUNCTIONS ====================

async function startAsHost() {
    roomCode = elements.roomCodeInput.value.trim().toLowerCase() || 'demo';
    if (!roomCode) {
        roomCode = 'room_' + Math.random().toString(36).substr(2, 6);
        elements.roomCodeInput.value = roomCode;
    }

    isHost = true;
    const roomData = getRoomData();

    if (roomData && roomData.questions && roomData.questions.length > 0) {
        questions = roomData.questions;
        showScreen(elements.hostScreen);
        elements.roomDisplay.textContent = roomCode;
        elements.totalQ.textContent = questions.length;
        generateQRCode();
        startHostPolling();
    } else {
        showScreen(elements.editScreen);
        addDefaultQuestions();
    }
}

function addDefaultQuestions() {
    elements.questionsList.innerHTML = '';
    const defaults = [
        { q: 'Никогда не был на море', o1: 'Антон', o2: 'Вася', a: 'Антон' },
        { q: 'Боится пауков', o1: 'Антон', o2: 'Вася', a: 'Вася' },
        { q: 'Умеет играть на гитаре', o1: 'Антон', o2: 'Вася', a: 'Антон' }
    ];
    defaults.forEach(d => addQuestionField(d));
}

function addQuestionField(data = {}) {
    const div = document.createElement('div');
    div.className = 'question-item';
    div.innerHTML = `
        <input type="text" class="q-question" placeholder="Вопрос" value="${data.q || ''}">
        <div class="q-options">
            <input type="text" class="q-option1" placeholder="Вариант 1" value="${data.o1 || ''}">
            <input type="text" class="q-option2" placeholder="Вариант 2" value="${data.o2 || ''}">
        </div>
        <select class="q-answer">
            <option value="1" ${data.a === data.o1 || !data.a ? 'selected' : ''}>Правильный: Вариант 1</option>
            <option value="2" ${data.a === data.o2 ? 'selected' : ''}>Правильный: Вариант 2</option>
        </select>
        <button class="btn-remove" onclick="this.parentElement.remove()">✕</button>
    `;
    elements.questionsList.appendChild(div);
}

async function saveAndStart() {
    const items = elements.questionsList.querySelectorAll('.question-item');
    questions = [];

    items.forEach(item => {
        const q = item.querySelector('.q-question').value.trim();
        const o1 = item.querySelector('.q-option1').value.trim();
        const o2 = item.querySelector('.q-option2').value.trim();
        const a = item.querySelector('.q-answer').value;

        if (q && o1 && o2) {
            questions.push({
                question: q,
                option1: o1,
                option2: o2,
                correctAnswer: a === '1' ? o1 : o2
            });
        }
    });

    if (questions.length === 0) {
        alert('Добавьте хотя бы один вопрос');
        return;
    }

    // Сохранить данные комнаты
    setRoomData({
        roomCode: roomCode,
        questions: questions,
        state: { status: 'waiting', currentQuestion: 0 },
        votes: {},
        players: {}
    });

    showScreen(elements.hostScreen);
    elements.roomDisplay.textContent = roomCode;
    elements.totalQ.textContent = questions.length;
    generateQRCode();
    startHostPolling();
}

function generateQRCode() {
    // Создаём URL с данными комнаты закодированными в base64 (с поддержкой UTF-8)
    const roomData = getRoomData();
    const jsonStr = JSON.stringify(roomData);
    const encodedData = btoa(unescape(encodeURIComponent(jsonStr)));
    const playerUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}&data=${encodedData}`;

    elements.qrCode.innerHTML = '';
    new QRCode(elements.qrCode, {
        text: playerUrl,
        width: 250,
        height: 250,
        colorDark: '#1a1a2e',
        colorLight: '#ffffff'
    });
}

function startHostPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(() => {
        const data = getRoomData();
        if (data) {
            const playersCount = data.players ? Object.keys(data.players).length : 0;
            elements.playersOnline.textContent = playersCount;

            if (data.state && data.state.status === 'voting') {
                updateVotesDisplay(data.votes);
            }
        }
    }, 500);
}

// ==================== PLAYER FUNCTIONS ====================

async function startAsPlayer() {
    roomCode = elements.roomCodeInput.value.trim().toLowerCase();
    if (!roomCode) {
        alert('Введите код комнаты');
        return;
    }

    isHost = false;
    const roomData = getRoomData();

    if (!roomData || !roomData.questions) {
        alert('Комната не найдена. Убедитесь что ведущий создал комнату.');
        return;
    }

    questions = roomData.questions;

    // Зарегистрировать игрока
    roomData.players = roomData.players || {};
    roomData.players[sessionId] = { joinedAt: Date.now() };
    setRoomData(roomData);

    showScreen(elements.playerScreen);
    elements.playerRoomDisplay.textContent = roomCode;
    startPlayerPolling();
}

function startPlayerPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(() => {
        const data = getRoomData();
        if (!data || !data.state) return;

        const state = data.state;

        if (state.status === 'waiting') {
            showPlayerState(elements.playerWaiting);
        } else if (state.status === 'voting') {
            currentQuestionIndex = state.currentQuestion;
            const myVote = data.votes && data.votes[`q${currentQuestionIndex}`] && data.votes[`q${currentQuestionIndex}`][sessionId];

            if (myVote) {
                showPlayerState(elements.playerVoted);
            } else {
                showPlayerState(elements.playerVoting);
                updatePlayerQuestion();
            }
        } else if (state.status === 'results') {
            showPlayerState(elements.playerResults);
            updatePlayerResults();
        }
    }, 500);
}

// ==================== VOTING ====================

function updateVotesDisplay(votes) {
    const questionVotes = votes ? votes[`q${currentQuestionIndex}`] : null;
    let opt1 = 0, opt2 = 0;

    if (questionVotes) {
        Object.values(questionVotes).forEach(v => {
            if (v.vote === 1) opt1++;
            if (v.vote === 2) opt2++;
        });
    }

    const total = opt1 + opt2;
    elements.countOption1.textContent = opt1;
    elements.countOption2.textContent = opt2;
    elements.totalVotes.textContent = total;

    if (total > 0) {
        elements.barOption1.style.width = (opt1 / total * 100) + '%';
        elements.barOption2.style.width = (opt2 / total * 100) + '%';
    } else {
        elements.barOption1.style.width = '50%';
        elements.barOption2.style.width = '50%';
    }
}

async function startQuiz() {
    currentQuestionIndex = 0;
    const data = getRoomData();
    data.state = { status: 'voting', currentQuestion: 0 };
    data.votes = {};
    setRoomData(data);

    // Обновить QR с новыми данными
    generateQRCode();

    showHostState(elements.hostVoting);
    updateHostQuestion();
}

function updateHostQuestion() {
    const q = questions[currentQuestionIndex];
    if (!q) return;

    elements.currentQ.textContent = currentQuestionIndex + 1;
    elements.hostQuestion.textContent = q.question;
    elements.labelOption1.textContent = q.option1;
    elements.labelOption2.textContent = q.option2;
    elements.barOption1.style.width = '50%';
    elements.barOption2.style.width = '50%';
    elements.countOption1.textContent = '0';
    elements.countOption2.textContent = '0';
    elements.totalVotes.textContent = '0';
}

function updatePlayerQuestion() {
    const q = questions[currentQuestionIndex];
    if (!q) return;

    elements.playerQuestion.textContent = q.question;
    elements.voteOption1Btn.textContent = q.option1;
    elements.voteOption2Btn.textContent = q.option2;
}

async function vote(option) {
    const data = getRoomData();
    if (!data.votes) data.votes = {};
    if (!data.votes[`q${currentQuestionIndex}`]) data.votes[`q${currentQuestionIndex}`] = {};

    data.votes[`q${currentQuestionIndex}`][sessionId] = {
        vote: option,
        time: Date.now()
    };
    setRoomData(data);

    const q = questions[currentQuestionIndex];
    elements.yourVote.textContent = option === 1 ? q.option1 : q.option2;
    showPlayerState(elements.playerVoted);
}

// ==================== RESULTS ====================

async function showResults() {
    const q = questions[currentQuestionIndex];
    const data = getRoomData();
    const votes = data.votes ? data.votes[`q${currentQuestionIndex}`] : {};

    let opt1 = 0, opt2 = 0;
    if (votes) {
        Object.values(votes).forEach(v => {
            if (v.vote === 1) opt1++;
            if (v.vote === 2) opt2++;
        });
    }

    const correctIsOpt1 = q.correctAnswer === q.option1;
    const correctVotes = correctIsOpt1 ? opt1 : opt2;
    const incorrectVotes = correctIsOpt1 ? opt2 : opt1;
    const total = opt1 + opt2;

    let resultType, resultEmoji, resultMessage;

    if (correctVotes > incorrectVotes) {
        resultType = 'win';
        resultEmoji = '🎉';
        resultMessage = 'Большинство угадало!';
        triggerConfetti();
    } else if (correctVotes < incorrectVotes) {
        resultType = 'lose';
        resultEmoji = '😅';
        resultMessage = 'Большинство ошиблось!';
    } else {
        resultType = 'draw';
        resultEmoji = '🤔';
        resultMessage = 'Ничья!';
    }

    elements.resultIcon.textContent = resultEmoji;
    elements.resultText.textContent = resultMessage;
    elements.resultText.className = `result-${resultType}`;
    elements.winnerName.textContent = q.correctAnswer;
    elements.finalVotes.textContent = `${correctVotes} из ${total}`;

    // Обновить состояние
    data.state.status = 'results';
    setRoomData(data);
    generateQRCode();

    showHostState(elements.hostResults);
}

function updatePlayerResults() {
    const q = questions[currentQuestionIndex];
    const data = getRoomData();
    const votes = data.votes ? data.votes[`q${currentQuestionIndex}`] : {};

    let opt1 = 0, opt2 = 0;
    if (votes) {
        Object.values(votes).forEach(v => {
            if (v.vote === 1) opt1++;
            if (v.vote === 2) opt2++;
        });
    }

    const correctIsOpt1 = q.correctAnswer === q.option1;
    const correctVotes = correctIsOpt1 ? opt1 : opt2;
    const incorrectVotes = correctIsOpt1 ? opt2 : opt1;

    if (correctVotes > incorrectVotes) {
        elements.playerResultIcon.textContent = '🎉';
        elements.playerResultText.textContent = 'Большинство угадало!';
        elements.playerResultText.className = 'result-win';
    } else if (correctVotes < incorrectVotes) {
        elements.playerResultIcon.textContent = '😅';
        elements.playerResultText.textContent = 'Большинство ошиблось!';
        elements.playerResultText.className = 'result-lose';
    } else {
        elements.playerResultIcon.textContent = '🤔';
        elements.playerResultText.textContent = 'Ничья!';
        elements.playerResultText.className = 'result-draw';
    }
}

// ==================== NAVIGATION ====================

async function nextQuestion() {
    currentQuestionIndex++;

    if (currentQuestionIndex >= questions.length) {
        showHostState(elements.hostEnd);
        const data = getRoomData();
        data.state = { status: 'waiting', currentQuestion: 0 };
        setRoomData(data);
        generateQRCode();
        return;
    }

    const data = getRoomData();
    data.state = { status: 'voting', currentQuestion: currentQuestionIndex };
    setRoomData(data);
    generateQRCode();

    showHostState(elements.hostVoting);
    updateHostQuestion();
}

async function restartQuiz() {
    currentQuestionIndex = 0;
    const data = getRoomData();
    data.state = { status: 'waiting', currentQuestion: 0 };
    data.votes = {};
    setRoomData(data);
    generateQRCode();
    showHostState(elements.hostWaiting);
}

// ==================== CONFETTI ====================

function triggerConfetti() {
    const canvas = elements.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#e94560', '#ff6b6b', '#4361ee', '#7209b7', '#4ade80', '#fbbf24'];

    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 4,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let stillActive = false;

        particles.forEach(p => {
            if (p.y < canvas.height + 50) {
                stillActive = true;
                p.y += p.speedY;
                p.x += p.speedX;
                p.rotation += p.rotationSpeed;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            }
        });

        if (stillActive) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();
    setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 5000);
}
