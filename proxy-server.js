const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Логирование всех запросов
app.use((req, res, next) => {
    console.log(`📨 [${new Date().toISOString()}] ${req.method} ${req.path}`);
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

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'FoodAI Proxy Server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Простой ping для UptimeRobot
app.get('/ping', (req, res) => {
    res.json({ 
        status: 'pong',
        timestamp: new Date().toISOString()
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

// ТОЧНЫЙ промпт из вашего приложения
const FOOD_ANALYSIS_PROMPT = `Ты - эксперт по питанию и шеф-повар. Проанализируй изображение еды и верни ответ в формате JSON.

Требуемый формат:
{
  "dish_name": "название блюда на русском",
  "ingredients": ["ингредиент1", "ингредиент2"],
  "calories": число,
  "protein": число,
  "fat": число,
  "carbs": число,
  "confidence": число от 0 до 1,
  "description": "краткое описание на русском",
  "estimated_weight": число
}

Правила анализа:
1. Определи основные ингредиенты
2. Оцени размер порции
3. Учти метод приготовления
4. Будь реалистичен в оценке КБЖУ
5. Если не уверен - укажи confidence ниже 0.5

Верни ТОЛЬКО JSON без дополнительного текста.`;

// Прокси для Gemini Vision API
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

        console.log('🖼️ Размер изображения:', Math.round((imageBase64.length * 3) / 4 / 1024), 'KB');

        // Используем актуальную модель Gemini
        const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        console.log(`🔄 Отправка запроса к Gemini с точным промптом...`);
        
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: FOOD_ANALYSIS_PROMPT
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
                maxOutputTokens: 2048
            }
        };

        console.log('📝 Длина промпта:', FOOD_ANALYSIS_PROMPT.length, 'символов');
        
        const response = await fetch(geminiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log(`📡 Статус Gemini: ${response.status}`);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Успешный ответ от Gemini за ${responseTime}ms`);
            
            // Логируем часть ответа для отладки
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const text = data.candidates[0].content.parts[0].text || '';
                console.log(`📄 Ответ Gemini (первые 200 символов): ${text.substring(0, 200)}...`);
            }
            
            return res.json(data);
        } else {
            const errorText = await response.text();
            console.error(`❌ Ошибка Gemini: ${response.status} - ${errorText}`);
            return res.status(response.status).json({ 
                error: 'Gemini API error',
                status: response.status,
                message: errorText.substring(0, 500)
            });
        }

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`🔥 Ошибка за ${responseTime}ms:`, error.message);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Обработка несуществующих маршрутов
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        availableEndpoints: ['GET /', 'GET /health', 'GET /ping', 'GET /proxy/test', 'POST /proxy/gemini-vision']
    });
});

app.listen(PORT, () => {
    console.log(`🚀 FoodAI Proxy Server запущен на порту ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Точный промпт: ${FOOD_ANALYSIS_PROMPT.length} символов`);
});
