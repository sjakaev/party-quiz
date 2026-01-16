// Основная логика приложения
let sheetsApi = null;
let sheetsWriter = null;
let questions = [];
let currentQuestionIndex = 0;
let isHost = false;
let pollInterval = null;

// DOM элементы
const elements = {
    // Экраны
    setupScreen: document.getElementById('setup-screen'),
    hostScreen: document.getElementById('host-screen'),
    playerScreen: document.getElementById('player-screen'),

    // Настройка
    sheetIdInput: document.getElementById('sheet-id'),
    startHostBtn: document.getElementById('start-host'),
    startPlayerBtn: document.getElementById('start-player'),

    // Ведущий - ожидание
    hostWaiting: document.getElementById('host-waiting'),
    qrCode: document.getElementById('qr-code'),
    playersOnline: document.getElementById('players-online'),
    startQuizBtn: document.getElementById('start-quiz'),

    // Ведущий - голосование
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

    // Ведущий - результаты
    hostResults: document.getElementById('host-results'),
    resultIcon: document.getElementById('result-icon'),
    resultText: document.getElementById('result-text'),
    correctAnswer: document.getElementById('correct-answer'),
    winnerLabel: document.getElementById('winner-label'),
    winnerName: document.getElementById('winner-name'),
    finalVotes: document.getElementById('final-votes'),
    confettiCanvas: document.getElementById('confetti-canvas'),
    nextQuestionBtn: document.getElementById('next-question'),

    // Ведущий - конец
    hostEnd: document.getElementById('host-end'),
    restartQuizBtn: document.getElementById('restart-quiz'),

    // Участник
    playerWaiting: document.getElementById('player-waiting'),
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

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Загрузить сохранённый Sheet ID или использовать дефолтный
    const savedId = loadSheetId();
    elements.sheetIdInput.value = savedId || CONFIG.SHEET_ID;

    // Проверить URL параметры для автоматического подключения участника
    const urlParams = new URLSearchParams(window.location.search);
    const sheetIdFromUrl = urlParams.get('sheet');
    const modeFromUrl = urlParams.get('mode');

    if (sheetIdFromUrl) {
        elements.sheetIdInput.value = sheetIdFromUrl;
        saveSheetId(sheetIdFromUrl);

        if (modeFromUrl === 'player') {
            startAsPlayer();
        }
    }

    // Обработчики кнопок
    elements.startHostBtn.addEventListener('click', startAsHost);
    elements.startPlayerBtn.addEventListener('click', startAsPlayer);
    elements.startQuizBtn.addEventListener('click', startQuiz);
    elements.showResultsBtn.addEventListener('click', showResults);
    elements.nextQuestionBtn.addEventListener('click', nextQuestion);
    elements.restartQuizBtn.addEventListener('click', restartQuiz);
    elements.voteOption1Btn.addEventListener('click', () => vote(1));
    elements.voteOption2Btn.addEventListener('click', () => vote(2));
});

// Показать экран
function showScreen(screen) {
    elements.setupScreen.classList.remove('active');
    elements.hostScreen.classList.remove('active');
    elements.playerScreen.classList.remove('active');
    screen.classList.add('active');
}

// Показать состояние ведущего
function showHostState(state) {
    elements.hostWaiting.classList.remove('active');
    elements.hostVoting.classList.remove('active');
    elements.hostResults.classList.remove('active');
    elements.hostEnd.classList.remove('active');
    state.classList.add('active');
}

// Показать состояние участника
function showPlayerState(state) {
    elements.playerWaiting.classList.remove('active');
    elements.playerVoting.classList.remove('active');
    elements.playerVoted.classList.remove('active');
    elements.playerResults.classList.remove('active');
    state.classList.add('active');
}

// Запуск как ведущий
async function startAsHost() {
    const sheetId = elements.sheetIdInput.value.trim() || CONFIG.SHEET_ID;
    if (!sheetId) {
        alert('Введите ID Google таблицы');
        return;
    }

    saveSheetId(sheetId);
    sheetsApi = new SheetsAPI(sheetId);

    // Использовать Web App URL из конфига
    if (CONFIG.WEB_APP_URL) {
        sheetsWriter = new SheetsWriter(CONFIG.WEB_APP_URL);
    }

    isHost = true;
    showScreen(elements.hostScreen);

    // Загрузить вопросы
    try {
        questions = await sheetsApi.getQuestions();
        elements.totalQ.textContent = questions.length;
        console.log('Загружено вопросов:', questions.length);
    } catch (e) {
        alert('Ошибка загрузки вопросов. Проверьте ID таблицы и настройки доступа.');
        return;
    }

    // Сгенерировать QR-код
    generateQRCode();

    // Начать отслеживать голоса
    startPolling();
}

// Запуск как участник
async function startAsPlayer() {
    const sheetId = elements.sheetIdInput.value.trim() || CONFIG.SHEET_ID;
    if (!sheetId) {
        alert('Введите ID Google таблицы');
        return;
    }

    saveSheetId(sheetId);
    sheetsApi = new SheetsAPI(sheetId);

    // Использовать Web App URL из конфига
    if (CONFIG.WEB_APP_URL) {
        sheetsWriter = new SheetsWriter(CONFIG.WEB_APP_URL);
    }

    // Загрузить вопросы
    try {
        questions = await sheetsApi.getQuestions();
    } catch (e) {
        alert('Ошибка подключения. Проверьте QR-код или ID таблицы.');
        return;
    }

    isHost = false;
    showScreen(elements.playerScreen);
    showPlayerState(elements.playerWaiting);

    // Начать отслеживать состояние
    startPolling();
}

// Генерация QR-кода
function generateQRCode() {
    const playerUrl = `${CONFIG.APP_URL}?sheet=${CONFIG.SHEET_ID}&mode=player`;

    elements.qrCode.innerHTML = '';
    new QRCode(elements.qrCode, {
        text: playerUrl,
        width: 250,
        height: 250,
        colorDark: '#1a1a2e',
        colorLight: '#ffffff'
    });
}

// Начать опрос данных
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        if (isHost) {
            await pollHostData();
        } else {
            await pollPlayerData();
        }
    }, CONFIG.POLL_INTERVAL);
}

// Опрос данных для ведущего
async function pollHostData() {
    try {
        const state = await sheetsApi.getState();

        // Если идёт голосование, обновить счётчики
        if (state.status === 'voting' && currentQuestionIndex < questions.length) {
            const votes = await sheetsApi.getVotes(currentQuestionIndex + 1);
            updateVotingBar(votes);
            elements.playersOnline.textContent = votes.total;
        }
    } catch (e) {
        console.error('Ошибка опроса:', e);
    }
}

// Опрос данных для участника
async function pollPlayerData() {
    try {
        const state = await sheetsApi.getState();

        if (state.status === 'waiting') {
            showPlayerState(elements.playerWaiting);
        } else if (state.status === 'voting') {
            currentQuestionIndex = state.currentQuestion - 1;

            // Проверить, голосовал ли уже
            const hasVoted = await sheetsApi.hasVoted(state.currentQuestion, CONFIG.SESSION_ID);

            if (hasVoted) {
                showPlayerState(elements.playerVoted);
            } else {
                showPlayerState(elements.playerVoting);
                updatePlayerQuestion();
            }
        } else if (state.status === 'results') {
            showPlayerState(elements.playerResults);

            // Показать результат
            const question = questions[state.currentQuestion - 1];
            const votes = await sheetsApi.getVotes(state.currentQuestion);
            showPlayerResult(question, votes);
        }
    } catch (e) {
        console.error('Ошибка опроса:', e);
    }
}

// Начать викторину
async function startQuiz() {
    currentQuestionIndex = 0;

    // Обновить состояние в таблице
    if (sheetsWriter) {
        await sheetsWriter.updateState({
            currentQuestion: 1,
            status: 'voting',
            showResults: false
        });
        await sheetsWriter.clearVotes();
    }

    showHostState(elements.hostVoting);
    updateHostQuestion();
}

// Обновить вопрос на экране ведущего
function updateHostQuestion() {
    const question = questions[currentQuestionIndex];
    if (!question) return;

    elements.currentQ.textContent = currentQuestionIndex + 1;
    elements.hostQuestion.textContent = question.question;
    elements.labelOption1.textContent = question.option1;
    elements.labelOption2.textContent = question.option2;

    // Сбросить прогресс-бар
    elements.barOption1.style.width = '50%';
    elements.barOption2.style.width = '50%';
    elements.countOption1.textContent = '0';
    elements.countOption2.textContent = '0';
    elements.totalVotes.textContent = '0';
}

// Обновить вопрос на экране участника
function updatePlayerQuestion() {
    const question = questions[currentQuestionIndex];
    if (!question) return;

    elements.playerQuestion.textContent = question.question;
    elements.voteOption1Btn.textContent = question.option1;
    elements.voteOption2Btn.textContent = question.option2;
}

// Обновить прогресс-бар голосования
function updateVotingBar(votes) {
    const total = votes.option1 + votes.option2;

    if (total === 0) {
        elements.barOption1.style.width = '50%';
        elements.barOption2.style.width = '50%';
    } else {
        const percent1 = (votes.option1 / total) * 100;
        const percent2 = (votes.option2 / total) * 100;
        elements.barOption1.style.width = percent1 + '%';
        elements.barOption2.style.width = percent2 + '%';
    }

    elements.countOption1.textContent = votes.option1;
    elements.countOption2.textContent = votes.option2;
    elements.totalVotes.textContent = total;
}

// Голосование участника
async function vote(option) {
    const questionId = currentQuestionIndex + 1;

    // Записать голос
    if (sheetsWriter) {
        await sheetsWriter.addVote(questionId, option, CONFIG.SESSION_ID);
    }

    // Показать подтверждение
    const question = questions[currentQuestionIndex];
    elements.yourVote.textContent = option === 1 ? question.option1 : question.option2;
    showPlayerState(elements.playerVoted);
}

// Показать результаты
async function showResults() {
    const question = questions[currentQuestionIndex];
    const votes = await sheetsApi.getVotes(currentQuestionIndex + 1);

    // Определить результат
    const correctOption = question.correctAnswer.toLowerCase().trim();
    const option1Lower = question.option1.toLowerCase().trim();
    const option2Lower = question.option2.toLowerCase().trim();

    let correctVotes, incorrectVotes, correctLabel, incorrectLabel;

    if (correctOption === option1Lower || correctOption === '1') {
        correctVotes = votes.option1;
        incorrectVotes = votes.option2;
        correctLabel = question.option1;
        incorrectLabel = question.option2;
    } else {
        correctVotes = votes.option2;
        incorrectVotes = votes.option1;
        correctLabel = question.option2;
        incorrectLabel = question.option1;
    }

    // Определить победу/поражение/ничью
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

    // Обновить UI
    elements.resultIcon.textContent = resultEmoji;
    elements.resultText.textContent = resultMessage;
    elements.resultText.className = `result-${resultType}`;
    elements.correctAnswer.textContent = `Правильный ответ: ${correctLabel}`;
    elements.winnerLabel.textContent = 'Правильный ответ:';
    elements.winnerName.textContent = correctLabel;
    elements.finalVotes.textContent = `${correctVotes} из ${votes.total}`;

    showHostState(elements.hostResults);

    // Обновить состояние для участников
    if (sheetsWriter) {
        await sheetsWriter.updateState({
            currentQuestion: currentQuestionIndex + 1,
            status: 'results',
            showResults: true
        });
    }
}

// Показать результат участнику
function showPlayerResult(question, votes) {
    const correctOption = question.correctAnswer.toLowerCase().trim();
    const option1Lower = question.option1.toLowerCase().trim();

    let correctVotes, incorrectVotes;

    if (correctOption === option1Lower || correctOption === '1') {
        correctVotes = votes.option1;
        incorrectVotes = votes.option2;
    } else {
        correctVotes = votes.option2;
        incorrectVotes = votes.option1;
    }

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

// Следующий вопрос
async function nextQuestion() {
    currentQuestionIndex++;

    if (currentQuestionIndex >= questions.length) {
        // Викторина завершена
        showHostState(elements.hostEnd);

        if (sheetsWriter) {
            await sheetsWriter.updateState({
                currentQuestion: 0,
                status: 'waiting',
                showResults: false
            });
        }
        return;
    }

    // Обновить состояние
    if (sheetsWriter) {
        await sheetsWriter.updateState({
            currentQuestion: currentQuestionIndex + 1,
            status: 'voting',
            showResults: false
        });
    }

    showHostState(elements.hostVoting);
    updateHostQuestion();
}

// Перезапустить викторину
async function restartQuiz() {
    currentQuestionIndex = 0;

    if (sheetsWriter) {
        await sheetsWriter.clearVotes();
        await sheetsWriter.updateState({
            currentQuestion: 0,
            status: 'waiting',
            showResults: false
        });
    }

    showHostState(elements.hostWaiting);
}

// Конфетти
function triggerConfetti() {
    const canvas = elements.confettiCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#e94560', '#ff6b6b', '#4361ee', '#7209b7', '#4ade80', '#fbbf24'];

    // Создать частицы
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

    let animationFrame;

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
            animationFrame = requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();

    // Остановить через 5 секунд
    setTimeout(() => {
        cancelAnimationFrame(animationFrame);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 5000);
}
