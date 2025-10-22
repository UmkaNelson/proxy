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

// Прокси для Gemini Vision API
app.post('/proxy/gemini-vision', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('📨 Получен запрос на анализ изображения...');
        console.log(`📊 Размер данных: ${JSON.stringify(req.body).length} байт`);
        
        const { imageBase64, apiKey } = req.body;
        
        if (!imageBase64 || !apiKey) {
            console.log('❌ Отсутствуют обязательные параметры');
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
                                text: `Ты - эксперт по питанию. Проанализируй изображение еды и верни JSON.`
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
        console.log(`📄 Длина ответа: ${JSON.stringify(data).length} байт`);
        
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

// Детальный тестовый эндпоинт
app.get('/proxy/debug', (req, res) => {
    const serverInfo = {
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        endpoints: [
            '/health',
            '/proxy/test', 
            '/proxy/debug',
            '/proxy/gemini-vision (POST)'
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

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'FoodAI Proxy Server',
        timestamp: new Date().toISOString(),
        region: process.env.REGION || 'unknown'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /proxy/test',
            'GET /proxy/debug', 
            'POST /proxy/gemini-vision'
        ]
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on port ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 Test: http://localhost:${PORT}/proxy/test`);
    console.log(`📍 Debug: http://localhost:${PORT}/proxy/debug`);
});
