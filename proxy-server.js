const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Счетчик для пульса (чтобы менять символы)
let pulseCounter = 0;
const pulseSymbols = ['💓', '💗', '💖', '💘', '💝', '💞', '💕'];

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Логирование всех запросов с пульсом для health-чеков
app.use((req, res, next) => {
    const now = new Date().toISOString();
    const pulse = pulseSymbols[pulseCounter % pulseSymbols.length];
    pulseCounter++;
    
    if (req.path === '/' || req.path === '/health') {
        console.log(`${pulse} [${now}] Pulse check from ${req.ip}`);
    } else {
        console.log(`📨 [${now}] ${req.method} ${req.path} from ${req.ip}`);
    }
    next();
});

// Корневой путь
app.get('/', (req, res) => {
    res.json({
        service: 'FoodAI Proxy Server',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: 'GET /health',
            test: 'GET /proxy/test',
            gemini_vision: 'POST /proxy/gemini-vision'
        }
    });
});

// Health check с улучшенным ответом
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({ 
        status: 'healthy', 
        service: 'FoodAI Proxy Server',
        timestamp: new Date().toISOString(),
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
        }
    });
});

// Тестовый эндпоинт
app.get('/proxy/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Прокси-сервер работает!',
        timestamp: new Date().toISOString()
    });
});

// Прокси для Gemini Vision API с моделью Gemini 2.0 Flash и УСИЛЕННЫМИ русскими промптами
app.post('/proxy/gemini-vision', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('📨 Получен запрос на анализ изображения...');
        
        const { imageBase64, apiKey } = req.body;
        
        if (!imageBase64 || !apiKey) {
            return res.status(400).json({ 
                error: 'Отсутствуют обязательные параметры: imageBase64, apiKey' 
            });
        }

        // Используем Gemini 2.0 Flash
        const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        console.log(`🔄 Используем модель: Gemini 2.0 Flash`);
        
        const response = await fetch(geminiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `ВНИМАНИЕ: Ты должен отвечать ТОЛЬКО на РУССКОМ языке и возвращать ТОЛЬКО JSON!

Ты - эксперт-диетолог и шеф-повар. Проанализируй изображение еды и верни ответ в СТРОГОМ JSON формате.

ТРЕБОВАНИЯ:
- Все текстовые поля должны быть на РУССКОМ языке
- Верни ТОЛЬКО JSON без каких-либо дополнительных текстов
- Не используй markdown formatting (```json ... ```)
- Используй только кириллические символы для текста

ФОРМАТ JSON (все поля обязательны):
{
  "dish_name": "название блюда на русском языке",
  "ingredients": ["ингредиент1", "ингредиент2", "ингредиент3"],
  "calories": число (ккал),
  "protein": число (граммы белка),
  "fat": число (граммы жиров), 
  "carbs": число (граммы углеводов),
  "confidence": число от 0.1 до 1.0 (уверенность в анализе),
  "description": "подробное описание блюда на русском языке",
  "estimated_weight": число (приблизительный вес в граммах)
}

ПРАВИЛА АНАЛИЗА:
1. Будь максимально точным в определении блюда
2. Учитывай размер порции на фотографии
3. Используй реалистичные значения КБЖУ для данного типа блюда
4. Если не уверен в анализе - укажи confidence ниже 0.7
5. Все ингредиенты перечисляй на русском языке
6. Описание должно быть информативным и на русском

ПРИМЕР ВЕРНОГО ОТВЕТА:
{
  "dish_name": "Салат Цезарь",
  "ingredients": ["салат айсберг", "куриная грудка", "сухарики", "сыр пармезан", "соус цезарь"],
  "calories": 320,
  "protein": 18,
  "fat": 22,
  "carbs": 12,
  "confidence": 0.85,
  "description": "Классический салат Цезарь с куриной грудкой, сухариками и сыром пармезан",
  "estimated_weight": 280
}

ВОЗВРАЩАЙ ТОЛЬКО JSON БЕЗ ЛЮБЫХ ДОПОЛНИТЕЛЬНЫХ СИМВОЛОВ ИЛИ ТЕКСТА!`
                            },
                            {
                                inlineData: {
                                    mimeType: "image/jpeg",
                                    data: imageBase64
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                }
            })
        });

        console.log(`📡 Статус Gemini: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Успешный ответ от Gemini API');
            
            // Логируем часть ответа для отладки
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const content = data.candidates[0].content.parts[0].text;
                console.log(`📝 Ответ Gemini (первые 300 символов): ${content.substring(0, 300)}...`);
                
                // Проверяем, содержит ли ответ русский текст
                const hasRussian = /[а-яА-Я]/.test(content);
                if (!hasRussian) {
                    console.warn('⚠️  В ответе не обнаружены русские символы!');
                }
            }
            
            return res.json(data);
        } else {
            const errorText = await response.text();
            console.error(`❌ Ошибка Gemini: ${response.status} - ${errorText}`);
            return res.status(response.status).json({ 
                error: 'Gemini API error',
                message: errorText.substring(0, 500)
            });
        }

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`🔥 Ошибка за ${responseTime}ms:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on port ${PORT}`);
    console.log(`💓 UptimeRobot будет показывать пульс при каждом пинге!`);
    console.log(`🎯 Используется Gemini 2.0 Flash`);
    console.log(`🇷🇺 Настроены усиленные русские промпты`);
});
