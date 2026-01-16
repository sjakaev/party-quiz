/**
 * Google Apps Script для Party Quiz
 *
 * ВАЖНО: После изменения кода нужно создать НОВОЕ развертывание!
 * 1. Нажмите "Развернуть" -> "Новое развертывание"
 * 2. Тип: "Веб-приложение"
 * 3. Выполнять как: "Я"
 * 4. Доступ: "Все"
 * 5. Скопируйте НОВЫЙ URL и обновите его в config.js
 */

// Глобальное хранилище состояния (в свойствах скрипта)
const PROPS = PropertiesService.getScriptProperties();

// Обработка GET запросов (чтение данных)
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getState':
        return getState();
      case 'getVotes':
        return getVotes(e.parameter.questionId);
      default:
        return createResponse({ status: 'Party Quiz API is running!' });
    }
  } catch (error) {
    return createResponse({ error: error.message });
  }
}

// Обработка POST запросов (запись данных)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    switch (data.action) {
      case 'updateState':
        return updateState(data);
      case 'addVote':
        return addVote(data);
      case 'clearVotes':
        return clearVotes();
      default:
        return createResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return createResponse({ error: error.message });
  }
}

// Получить состояние игры
function getState() {
  const state = {
    currentQuestion: parseInt(PROPS.getProperty('currentQuestion')) || 0,
    status: PROPS.getProperty('status') || 'waiting',
    showResults: PROPS.getProperty('showResults') === 'true'
  };
  return createResponse(state);
}

// Обновить состояние игры
function updateState(data) {
  PROPS.setProperty('currentQuestion', String(data.currentQuestion || 0));
  PROPS.setProperty('status', data.status || 'waiting');
  PROPS.setProperty('showResults', String(data.showResults || false));
  return createResponse({ success: true });
}

// Получить голоса для вопроса
function getVotes(questionId) {
  const votesJson = PROPS.getProperty('votes') || '{}';
  const allVotes = JSON.parse(votesJson);
  const questionVotes = allVotes[questionId] || [];

  let option1 = 0;
  let option2 = 0;
  const voters = [];

  questionVotes.forEach(v => {
    if (v.vote === 1 || v.vote === '1') option1++;
    if (v.vote === 2 || v.vote === '2') option2++;
    voters.push(v.sessionId);
  });

  return createResponse({
    option1: option1,
    option2: option2,
    total: questionVotes.length,
    voters: voters
  });
}

// Добавить голос
function addVote(data) {
  const votesJson = PROPS.getProperty('votes') || '{}';
  const allVotes = JSON.parse(votesJson);

  const questionId = String(data.questionId);
  if (!allVotes[questionId]) {
    allVotes[questionId] = [];
  }

  // Проверить, не голосовал ли уже
  const existingVote = allVotes[questionId].find(v => v.sessionId === data.sessionId);
  if (existingVote) {
    return createResponse({ success: false, reason: 'Already voted' });
  }

  // Добавить голос
  allVotes[questionId].push({
    vote: data.vote,
    sessionId: data.sessionId,
    timestamp: new Date().toISOString()
  });

  PROPS.setProperty('votes', JSON.stringify(allVotes));
  return createResponse({ success: true });
}

// Очистить все голоса
function clearVotes() {
  PROPS.setProperty('votes', '{}');
  return createResponse({ success: true });
}

// Создать JSON ответ с CORS заголовками
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Сброс всего состояния (можно вызвать вручную)
function resetAll() {
  PROPS.deleteAllProperties();
  Logger.log('Все данные сброшены');
}
