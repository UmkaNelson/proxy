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

// Прокси для Gemini Vision API с правильной моделью
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

        // Используем актуальные модели Gemini
        const geminiURLs = [
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
            `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`
        ];

        let lastError = null;

        for (const geminiURL of geminiURLs) {
            try {
                console.log(`🔄 Пробуем модель: ${geminiURL.split('/models/')[1].split(':')[0]}`);
                
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
                                        text: `Ты - эксперт по питанию. Проанализируй изображение еды и верни JSON в формате:
{
  "dish_name": "название блюда",
  "ingredients": ["ингредиент1", "ингредиент2"],
  "calories": число,
  "protein": число,
  "fat": число,
  "carbs": число,
  "confidence": число от 0 до 1,
  "description": "описание",
  "estimated_weight": число
}

Верни ТОЛЬКО JSON.`
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
                    return res.json(data);
                } else {
                    const errorText = await response.text();
                    lastError = `Модель ${geminiURL.split('/models/')[1].split(':')[0]}: ${response.status} - ${errorText.substring(0, 200)}`;
                    console.log(`❌ ${lastError}`);
                    // Продолжаем пробовать следующую модель
                }
            } catch (error) {
                lastError = error.message;
                console.log(`❌ Ошибка с моделью: ${error.message}`);
                // Продолжаем пробовать следующую модель
            }
        }

        // Если все модели не сработали
        throw new Error(`Все модели Gemini недоступны. Последняя ошибка: ${lastError}`);

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
});
