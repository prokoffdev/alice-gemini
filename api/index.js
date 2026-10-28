export default async function handler(req, res) {
  // Проверка живости сервера (GET)
  if (req.method === 'GET') {
    return res.status(200).send('Alice Gemini Skill Webhook is running!');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel автоматически парсит JSON в req.body
  const body = req.body || {};
  const version = body.version || '1.0';
  const session = body.session || {};
  const request = body.request || {};
  const isNew = session.new || false;
  const userCommand = (request.command || request.original_utterance || '').trim();

  // При первом запуске навыка или пустом запросе
  if (isNew || !userCommand) {
    return res.status(200).json({
      version,
      session,
      response: {
        text: 'Привет! Я Gemini. Задавайте любой вопрос, я слушаю.',
        end_session: false
      }
    });
  }

  // Команды выхода
  const exitCommands = ['выход', 'хватит', 'стоп', 'пока', 'закройся', 'отмена'];
  if (exitCommands.includes(userCommand.toLowerCase())) {
    return res.status(200).json({
      version,
      session,
      response: {
        text: 'До связи! Обращайтесь, если появятся вопросы.',
        end_session: true
      }
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const geminiReply = await queryGemini(userCommand, apiKey);
    return res.status(200).json({
      version,
      session,
      response: {
        text: geminiReply,
        end_session: false
      }
    });
  } catch (error) {
    console.error('Error querying Gemini:', error);
    return res.status(200).json({
      version,
      session,
      response: {
        text: 'Извините, произошла ошибка связи с Gemini. Попробуйте еще раз.',
        end_session: false
      }
    });
  }
}

async function queryGemini(prompt, apiKey) {
  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  const systemInstruction = 'Ты голосовой помощник для умной колонки Яндекс Алиса. Отвечай кратко, емко, естественным разговорным языком без markdown-разметки (никаких звездочек, решеток, списков), так как твой ответ будет зачитан вслух.';

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [
              { parts: [{ text: prompt }] }
            ],
            generationConfig: {
              maxOutputTokens: 250,
              temperature: 0.7
            }
          })
        }
      );

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let text = data.candidates[0].content.parts[0].text;
        // Очищаем markdown символы, чтобы Алиса не произносила "звездочка", "решетка"
        text = text.replace(/[*#_`>]/g, '').trim();
        if (text.length > 900) {
          text = text.slice(0, 900) + '...';
        }
        return text;
      }
    } catch (e) {
      console.warn(`Model ${model} failed, trying fallback...`, e);
    }
  }

  return 'К сожалению, нейросеть сейчас недоступна. Попробуйте повторить вопрос через пару секунд.';
}
