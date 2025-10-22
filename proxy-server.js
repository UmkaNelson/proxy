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
    console.log(`📍 Origin: ${req.get('origin') || 'No origin'}`);
    console.log(`📱 User-Agent: ${req.get('user-agent')}`);
    next();
});

// Корневой путь - информационная страница
app.get('/', (req, res) => {
    res.json({
        service: 'FoodAI Proxy Server',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: 'GET /health',
            test: 'GET /proxy/test',
            debug: 'GET /proxy/debug',
            gemini_vision: 'POST /proxy/gemini-vision'
        },
        usage: 'Это прокси-сервер для iOS приложения FoodAI'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'FoodAI Proxy Server',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Детальный тестовый эндпоинт
app.get('/proxy/debug', (req, res) => {
    const serverInfo = {
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        endpoints: [
            'GET /',
            'GET /health',
            'GET /proxy/test', 
            'GET /proxy/debug',
            'POST /proxy/gemini-vision'
        ]
    };
    res.json(serverInfo);
});

// Тестовый эндпоинт
app.get('/proxy/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Прокси-сервер работает!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Прокси для Gemini Vision API
app.post('/proxy/gemini-vision', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('📨 Получен запрос на анализ изображения...');
        
        const { imageBase64, apiKey } = req.body;
        
        if (!imageBase64) {
            console.log('❌ Отсутствует изображение');
            return res.status(400).json({ 
                error: 'Отсутствует обязательный параметр: imageBase64'
            });
        }

        if (!apiKey) {
            console.log('❌ Отсутствует API ключ');
            return res.status(400).json({ 
                error: 'Отсутствует обязательный параметр: apiKey'
            });
        }

        const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
        
        console.log('🔄 Отправка запроса к Gemini API...');
        
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
                                text: `Ты - эксперт по питанию и шеф-повар. Проанализируй изображение еды и верни ответ в формате JSON.
                                
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

Верни ТОЛЬКО JSON без дополнительного текста.`
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

        const responseTime = Date.now() - startTime;
        console.log(`⏱ Время ответа Gemini: ${responseTime}ms`);
        console.log(`📡 Статус Gemini: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка от Gemini API:', errorText);
            return res.status(response.status).json({ 
                error: `Gemini API error: ${response.status}`,
                details: errorText.substring(0, 500)
            });
        }

        const data = await response.json();
        console.log('✅ Успешный ответ от Gemini API');
        
        res.json(data);
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`🔥 Ошибка за ${responseTime}ms:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            responseTime: responseTime
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'GET /health',
            'GET /proxy/test',
            'GET /proxy/debug', 
            'POST /proxy/gemini-vision'
        ]
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on port ${PORT}`);
    console.log(`📍 Main: http://localhost:${PORT}/`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 Test: http://localhost:${PORT}/proxy/test`);
    console.log(`📍 Debug: http://localhost:${PORT}/proxy/debug`);
});
