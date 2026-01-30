require('dotenv').config();
const express = require('express');
const { Stagehand } = require('@browserbasehq/stagehand');

const app = express();
app.use(express.json());

// Store active Stagehand instance
let stagehand = null;
let page = null;

// Initialize Stagehand with local Chrome
app.post('/init', async (req, res) => {
  try {
    if (stagehand) {
      await stagehand.close();
    }

    console.log('Initializing Stagehand with OpenAI API key:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');

    stagehand = new Stagehand({
      env: 'LOCAL',
      enableCaching: false,
      headless: false,
      modelName: 'gpt-4o',
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY
      }
    });

    await stagehand.init();
    page = stagehand.page;

    console.log('Stagehand initialized successfully');
    res.json({ success: true, message: 'Stagehand initialized' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Navigate to URL
app.post('/goto', async (req, res) => {
  try {
    const { url } = req.body;
    if (!page) {
      return res.status(400).json({ success: false, error: 'Not initialized. Call /init first' });
    }

    await page.goto(url);
    res.json({ success: true, message: `Navigated to ${url}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Act - perform an action described in natural language
app.post('/act', async (req, res) => {
  try {
    const { action } = req.body;
    if (!stagehand) {
      return res.status(400).json({ success: false, error: 'Not initialized. Call /init first' });
    }

    const result = await stagehand.act({ action });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Extract - extract data from the page using natural language
app.post('/extract', async (req, res) => {
  try {
    const { instruction, schema } = req.body;
    if (!stagehand) {
      return res.status(400).json({ success: false, error: 'Not initialized. Call /init first' });
    }

    const result = await stagehand.extract({
      instruction,
      schema: schema || undefined
    });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Observe - get possible actions on the page
app.post('/observe', async (req, res) => {
  try {
    const { instruction } = req.body;
    if (!stagehand) {
      return res.status(400).json({ success: false, error: 'Not initialized. Call /init first' });
    }

    const result = await stagehand.observe({ instruction });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close browser
app.post('/close', async (req, res) => {
  try {
    if (stagehand) {
      await stagehand.close();
      stagehand = null;
      page = null;
    }
    res.json({ success: true, message: 'Browser closed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    initialized: stagehand !== null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Stagehand API server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /init     - Initialize browser');
  console.log('  POST /goto     - Navigate to URL { url: "..." }');
  console.log('  POST /act      - Perform action { action: "..." }');
  console.log('  POST /extract  - Extract data { instruction: "...", schema?: {...} }');
  console.log('  POST /observe  - Observe page { instruction: "..." }');
  console.log('  POST /close    - Close browser');
  console.log('  GET  /health   - Health check');
});
