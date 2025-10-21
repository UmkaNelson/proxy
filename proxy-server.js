const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Прокси для Gemini Vision API
app.post('/proxy/gemini-vision', async (req, res) => {
    try {
        console.log('📨 Получен запрос на анализ изображения...');
        
        const { imageBase64, apiKey } = req.body;
        
        if (!imageBase64 || !apiKey) {
            return res.status(400).json({ 
                error: 'Отсутствуют обязательные параметры: imageBase64, apiKey' 
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
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка от Gemini API:', errorText);
            return res.status(response.status).json({ 
                error: `Gemini API error: ${response.status} ${response.statusText}`,
                details: errorText
            });
        }

        const data = await response.json();
        console.log('✅ Успешный ответ от Gemini API');
        
        res.json(data);
    } catch (error) {
        console.error('🔥 Ошибка прокси:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Тестовый эндпоинт
app.get('/proxy/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Прокси-сервер работает!',
        timestamp: new Date().toISOString()
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

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on port ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 Test: http://localhost:${PORT}/proxy/test`);
});
