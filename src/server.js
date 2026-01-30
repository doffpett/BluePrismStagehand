require('dotenv').config();
const express = require('express');
const { Stagehand } = require('@browserbasehq/stagehand');
const { z } = require('zod');

const app = express();
app.use(express.json());

// Helper: Convert JSON schema definition to Zod schema
function jsonToZod(schema) {
  if (!schema || !schema.properties) return null;

  const zodShape = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    if (value.type === 'string') {
      zodShape[key] = z.string().describe(value.description || key);
    } else if (value.type === 'number') {
      zodShape[key] = z.number().describe(value.description || key);
    } else if (value.type === 'boolean') {
      zodShape[key] = z.boolean().describe(value.description || key);
    } else if (value.type === 'array') {
      if (value.items?.type === 'string') {
        zodShape[key] = z.array(z.string()).describe(value.description || key);
      } else if (value.items?.type === 'object') {
        zodShape[key] = z.array(jsonToZod(value.items) || z.any()).describe(value.description || key);
      } else {
        zodShape[key] = z.array(z.any()).describe(value.description || key);
      }
    }
  }
  return z.object(zodShape);
}

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
    // In v3, get page from context
    page = stagehand.context.pages()[0];

    console.log('Stagehand initialized successfully');
    console.log('Page object:', page ? 'SET' : 'NOT SET');
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
    const { action, instruction } = req.body;
    if (!stagehand) {
      return res.status(400).json({ success: false, error: 'Not initialized. Call /init first' });
    }

    // v3 uses 'instruction', but we support both for convenience
    const result = await stagehand.act(instruction || action);
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

    console.log('Extract called with instruction:', instruction);
    console.log('Schema provided:', schema ? 'YES' : 'NO');

    let result;
    if (schema) {
      // Convert JSON schema to Zod and use structured extraction
      const zodSchema = jsonToZod(schema);
      result = await stagehand.extract({
        instruction,
        schema: zodSchema
      });
    } else {
      // Simple extraction without schema
      result = await stagehand.extract(instruction);
    }

    res.json({ success: true, result });
  } catch (error) {
    console.log('Extract error:', error.message);
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

    console.log('Observe called with instruction:', instruction);
    // v3 observe takes instruction string directly
    const result = await stagehand.observe(instruction);
    res.json({ success: true, result });
  } catch (error) {
    console.log('Observe error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Agent - execute autonomous multi-step tasks
app.post('/agent', async (req, res) => {
  try {
    const { task, maxSteps } = req.body;
    if (!stagehand) {
      return res.status(400).json({ success: false, error: 'Not initialized. Call /init first' });
    }

    console.log('Agent called with task:', task);
    console.log('Max steps:', maxSteps || 'default');

    // Create agent and execute task
    const agent = stagehand.agent({
      modelName: 'gpt-4o',
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY
      }
    });

    const result = await agent.execute(task, {
      maxSteps: maxSteps || 10
    });

    res.json({ success: true, result });
  } catch (error) {
    console.log('Agent error:', error.message);
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
  console.log('  POST /agent    - Autonomous multi-step task { task: "...", maxSteps?: 10 }');
  console.log('  POST /close    - Close browser');
  console.log('  GET  /health   - Health check');
});
