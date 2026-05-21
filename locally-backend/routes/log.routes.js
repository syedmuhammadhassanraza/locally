const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../middleware/logging.middleware');

const frontendErrorLogPath = path.join(LOGS_DIR, 'frontend_errors.log');
const promptHistoryLogPath = path.join(LOGS_DIR, 'prompt_history.json');
const traceHistoryLogPath = path.join(__dirname, '..', '..', 'antigravity_trace.txt');

// 1. Post browser/frontend error logs
router.post('/frontend', (req, res) => {
  const { error, info, userAgent } = req.body;
  const logMsg = `[${new Date().toISOString()}] FRONTEND ERROR: ${error} - Info: ${info} - UA: ${userAgent}\n`;
  
  fs.appendFile(frontendErrorLogPath, logMsg, (err) => {
    if (err) console.error('Failed to write frontend log:', err);
  });
  
  res.json({ success: true });
});

// 2. Post prompt and instruction traces
router.post('/prompt', (req, res) => {
  const { prompt, modifications, filesAffected, result } = req.body;
  
  const logItem = {
    timestamp: new Date().toISOString(),
    prompt,
    modifications,
    filesAffected,
    result
  };

  // 1. Append to prompt_history.json
  let promptHistory = [];
  if (fs.existsSync(promptHistoryLogPath)) {
    try {
      const data = fs.readFileSync(promptHistoryLogPath, 'utf8');
      promptHistory = JSON.parse(data);
    } catch (e) {
      promptHistory = [];
    }
  }
  promptHistory.push(logItem);
  
  fs.writeFileSync(promptHistoryLogPath, JSON.stringify(promptHistory, null, 2));

  // 2. Update antigravity_trace.txt
  const traceMsg = `\n[${logItem.timestamp}] [ROZGO-ANTIGRAVITY-AGENT] Prompt: "${prompt}"\n` +
                   `                      Files affected: ${JSON.stringify(filesAffected)}\n` +
                   `                      Modifications: ${modifications}\n` +
                   `                      Result: ${result}\n` +
                   `------------------------------------------------------------------------\n`;
                   
  fs.appendFile(traceHistoryLogPath, traceMsg, (err) => {
    if (err) console.error('Failed to append to antigravity_trace.txt:', err);
  });

  res.json({ success: true, historyCount: promptHistory.length });
});

module.exports = router;
