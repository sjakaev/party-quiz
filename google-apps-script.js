/**
 * Google Apps Script для Party Quiz
 *
 * ИНСТРУКЦИЯ ПО УСТАНОВКЕ:
 * 1. Откройте вашу Google таблицу
 * 2. Меню: Расширения -> Apps Script
 * 3. Удалите весь код и вставьте этот файл
 * 4. Сохраните (Ctrl+S)
 * 5. Нажмите "Развернуть" -> "Новое развертывание"
 * 6. Тип: "Веб-приложение"
 * 7. Выполнять как: "Я"
 * 8. Доступ: "Все"
 * 9. Скопируйте URL развертывания
 * 10. Вставьте URL в ячейку A1 листа "Config"
 */

// Обработка POST запросов
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (data.action) {
      case 'updateState':
        return updateState(ss, data);
      case 'addVote':
        return addVote(ss, data);
      case 'clearVotes':
        return clearVotes(ss);
      default:
        return createResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return createResponse({ error: error.message });
  }
}

// Обработка GET запросов (для тестирования)
function doGet(e) {
  return createResponse({ status: 'Party Quiz API is running!' });
}

// Обновить состояние игры
function updateState(ss, data) {
  let stateSheet = ss.getSheetByName('State');

  // Создать лист если не существует
  if (!stateSheet) {
    stateSheet = ss.insertSheet('State');
    stateSheet.getRange('A1:C1').setValues([['currentQuestion', 'status', 'showResults']]);
  }

  // Записать состояние
  stateSheet.getRange('A2:C2').setValues([
    [data.currentQuestion || 0, data.status || 'waiting', data.showResults || false]
  ]);

  return createResponse({ success: true });
}

// Добавить голос
function addVote(ss, data) {
  let votesSheet = ss.getSheetByName('Votes');

  // Создать лист если не существует
  if (!votesSheet) {
    votesSheet = ss.insertSheet('Votes');
    votesSheet.getRange('A1:D1').setValues([['questionId', 'vote', 'sessionId', 'timestamp']]);
  }

  // Проверить, не голосовал ли уже этот участник за этот вопрос
  const existingData = votesSheet.getDataRange().getValues();
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0] == data.questionId && existingData[i][2] == data.sessionId) {
      return createResponse({ success: false, reason: 'Already voted' });
    }
  }

  // Добавить голос
  const lastRow = votesSheet.getLastRow() + 1;
  votesSheet.getRange(lastRow, 1, 1, 4).setValues([
    [data.questionId, data.vote, data.sessionId, new Date().toISOString()]
  ]);

  return createResponse({ success: true });
}

// Очистить все голоса
function clearVotes(ss) {
  let votesSheet = ss.getSheetByName('Votes');

  if (votesSheet) {
    const lastRow = votesSheet.getLastRow();
    if (lastRow > 1) {
      votesSheet.deleteRows(2, lastRow - 1);
    }
  }

  return createResponse({ success: true });
}

// Создать JSON ответ
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Функция для первоначальной настройки таблицы
 * Запустите её один раз из редактора скриптов
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Создать лист Questions если не существует
  let questionsSheet = ss.getSheetByName('Questions');
  if (!questionsSheet) {
    questionsSheet = ss.insertSheet('Questions');
    questionsSheet.getRange('A1:D1').setValues([['Вопрос', 'Вариант1', 'Вариант2', 'Ответ']]);

    // Добавить примеры вопросов
    questionsSheet.getRange('A2:D4').setValues([
      ['Никогда не был на море', 'Антон', 'Вася', 'Антон'],
      ['Боится пауков', 'Антон', 'Вася', 'Вася'],
      ['Умеет играть на гитаре', 'Антон', 'Вася', 'Антон']
    ]);
  }

  // Создать лист State
  let stateSheet = ss.getSheetByName('State');
  if (!stateSheet) {
    stateSheet = ss.insertSheet('State');
    stateSheet.getRange('A1:C1').setValues([['currentQuestion', 'status', 'showResults']]);
    stateSheet.getRange('A2:C2').setValues([[0, 'waiting', false]]);
  }

  // Создать лист Votes
  let votesSheet = ss.getSheetByName('Votes');
  if (!votesSheet) {
    votesSheet = ss.insertSheet('Votes');
    votesSheet.getRange('A1:D1').setValues([['questionId', 'vote', 'sessionId', 'timestamp']]);
  }

  // Создать лист Config
  let configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    configSheet = ss.insertSheet('Config');
    configSheet.getRange('A1').setValue('webAppUrl');
    configSheet.getRange('A2').setValue('ВСТАВЬТЕ_СЮДА_URL_РАЗВЕРТЫВАНИЯ');
  }

  SpreadsheetApp.getUi().alert('Таблица настроена! Теперь разверните веб-приложение и вставьте URL в ячейку A2 листа Config.');
}
