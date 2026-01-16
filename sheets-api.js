// Google Sheets API через публичный доступ
// Таблица должна быть опубликована: Файл -> Поделиться -> Опубликовать в интернете

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
            question: row['Вопрос'] || row['question'] || row['A'],
            option1: row['Вариант1'] || row['option1'] || row['B'],
            option2: row['Вариант2'] || row['option2'] || row['C'],
            correctAnswer: row['Ответ'] || row['answer'] || row['D']
        })).filter(q => q.question); // Убираем пустые строки
    }

    // Получить состояние игры
    async getState() {
        try {
            const data = await this.query(CONFIG.SHEETS.STATE);
            if (data.length === 0) {
                return {
                    currentQuestion: 0,
                    status: 'waiting', // waiting, voting, results
                    showResults: false
                };
            }
            const row = data[0];
            return {
                currentQuestion: parseInt(row['currentQuestion'] || row['A'] || 0),
                status: row['status'] || row['B'] || 'waiting',
                showResults: (row['showResults'] || row['C'] || 'false') === 'true'
            };
        } catch (e) {
            return {
                currentQuestion: 0,
                status: 'waiting',
                showResults: false
            };
        }
    }

    // Получить голоса для текущего вопроса
    async getVotes(questionId) {
        try {
            const data = await this.query(CONFIG.SHEETS.VOTES);
            const votes = data.filter(row => {
                const qId = parseInt(row['questionId'] || row['A'] || 0);
                return qId === questionId;
            });

            return {
                option1: votes.filter(v => (v['vote'] || v['B']) === '1').length,
                option2: votes.filter(v => (v['vote'] || v['B']) === '2').length,
                total: votes.length,
                voters: votes.map(v => v['sessionId'] || v['C'])
            };
        } catch (e) {
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
// Это нужно настроить отдельно в Google Sheets

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
            await fetch(this.webAppUrl, {
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
            await fetch(this.webAppUrl, {
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
            await fetch(this.webAppUrl, {
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
