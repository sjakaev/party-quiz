// Конфигурация приложения
const CONFIG = {
    // ID Google таблицы
    SHEET_ID: '15zS8WOxQl0xeDPO1m0VM2wJEj32Qje6eGCtmVOQUoYA',

    // URL Google Apps Script Web App
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbx3dZhO8WIJHf2QjZWLM0LcMxEz4bHm3fALb5WwlCaoxG0xof6HpAe6D5gU1yX3TXdd/exec',

    // Названия листов в таблице
    SHEETS: {
        QUESTIONS: 'Questions',  // Вопросы
        STATE: 'State',          // Состояние игры
        VOTES: 'Votes'           // Голоса
    },

    // Интервал обновления данных (мс)
    POLL_INTERVAL: 1000,

    // URL для GitHub Pages (будет установлен автоматически)
    APP_URL: window.location.href.split('?')[0],

    // Уникальный ID сессии для участника
    SESSION_ID: generateSessionId()
};

// Генерация уникального ID сессии
function generateSessionId() {
    return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Сохранение Sheet ID в localStorage
function saveSheetId(id) {
    localStorage.setItem('partyQuizSheetId', id);
    CONFIG.SHEET_ID = id;
}

// Загрузка Sheet ID из localStorage
function loadSheetId() {
    const saved = localStorage.getItem('partyQuizSheetId');
    if (saved) {
        CONFIG.SHEET_ID = saved;
    }
    return saved || CONFIG.SHEET_ID;
}
