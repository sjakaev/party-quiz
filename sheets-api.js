// Google Sheets API через публичный доступ + Web App

class SheetsAPI {
    constructor(sheetId) {
        this.sheetId = sheetId;
        this.baseUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
    }

    // Выполнить запрос к листу
    async query(sheetName, sqlQuery = 'SELECT *') {
        const url = `${this.baseUrl}?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=${encodeURIComponent(sqlQuery)}`;

        try {
            const response = await fetch(url);
            const text = await response.text();

            // Google возвращает JSONP, нужно извлечь JSON
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            const jsonString = text.substring(jsonStart, jsonEnd + 1);

            const data = JSON.parse(jsonString);

            if (data.status === 'error') {
                throw new Error(data.errors[0].message);
            }

            return this.parseTable(data.table);
        } catch (error) {
            console.error('Ошибка запроса к Google Sheets:', error);
            throw error;
        }
    }

    // Парсинг таблицы в массив объектов
    parseTable(table) {
        if (!table || !table.rows) return [];

        const headers = table.cols.map(col => col.label || col.id);

        return table.rows.map(row => {
            const obj = {};
            row.c.forEach((cell, index) => {
                const header = headers[index];
                obj[header] = cell ? (cell.v !== null ? cell.v : '') : '';
            });
            return obj;
        });
    }

    // Получить все вопросы
    async getQuestions() {
        const data = await this.query(CONFIG.SHEETS.QUESTIONS);
        return data.map((row, index) => ({
            id: index + 1,
            question: row['Вопрос'] || row['question'] || row['A'] || Object.values(row)[0],
            option1: row['Вариант1'] || row['option1'] || row['B'] || Object.values(row)[1],
            option2: row['Вариант2'] || row['option2'] || row['C'] || Object.values(row)[2],
            correctAnswer: row['Ответ'] || row['answer'] || row['D'] || Object.values(row)[3]
        })).filter(q => q.question && q.question !== 'Вопрос');
    }

    // Получить состояние игры через Web App
    async getState() {
        if (!CONFIG.WEB_APP_URL) {
            return { currentQuestion: 0, status: 'waiting', showResults: false };
        }

        try {
            const response = await fetch(CONFIG.WEB_APP_URL + '?action=getState', {
                method: 'GET'
            });
            const data = await response.json();
            return {
                currentQuestion: parseInt(data.currentQuestion) || 0,
                status: data.status || 'waiting',
                showResults: data.showResults === true || data.showResults === 'true'
            };
        } catch (e) {
            console.error('Ошибка получения состояния:', e);
            return { currentQuestion: 0, status: 'waiting', showResults: false };
        }
    }

    // Получить голоса через Web App
    async getVotes(questionId) {
        if (!CONFIG.WEB_APP_URL) {
            return { option1: 0, option2: 0, total: 0, voters: [] };
        }

        try {
            const response = await fetch(CONFIG.WEB_APP_URL + '?action=getVotes&questionId=' + questionId, {
                method: 'GET'
            });
            const data = await response.json();
            return {
                option1: parseInt(data.option1) || 0,
                option2: parseInt(data.option2) || 0,
                total: parseInt(data.total) || 0,
                voters: data.voters || []
            };
        } catch (e) {
            console.error('Ошибка получения голосов:', e);
            return { option1: 0, option2: 0, total: 0, voters: [] };
        }
    }

    // Проверить, голосовал ли уже участник
    async hasVoted(questionId, sessionId) {
        const votes = await this.getVotes(questionId);
        return votes.voters.includes(sessionId);
    }
}

// Для записи данных используем Google Apps Script Web App
class SheetsWriter {
    constructor(webAppUrl) {
        this.webAppUrl = webAppUrl;
    }

    async updateState(state) {
        if (!this.webAppUrl) {
            console.warn('Web App URL не настроен');
            return false;
        }

        try {
            const response = await fetch(this.webAppUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateState',
                    ...state
                })
            });
            return true;
        } catch (e) {
            console.error('Ошибка записи состояния:', e);
            return false;
        }
    }

    async addVote(questionId, vote, sessionId) {
        if (!this.webAppUrl) {
            console.warn('Web App URL не настроен');
            return false;
        }

        try {
            const response = await fetch(this.webAppUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addVote',
                    questionId,
                    vote,
                    sessionId
                })
            });
            return true;
        } catch (e) {
            console.error('Ошибка записи голоса:', e);
            return false;
        }
    }

    async clearVotes() {
        if (!this.webAppUrl) return false;

        try {
            const response = await fetch(this.webAppUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clearVotes' })
            });
            return true;
        } catch (e) {
            console.error('Ошибка очистки голосов:', e);
            return false;
        }
    }
}
