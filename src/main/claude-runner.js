'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

let claudeProcess = null;
let proxyProcess = null;
let claudeInputStream = null;

async function startClaudeCode(config, mainWindow) {
  try {
    await stopClaudeCode();
    
    await setupProxy(config, mainWindow);
    
    const env = { ...process.env };
    env.CLAUDE_API_URL = `http://localhost:${config.proxyPort}/v1`;
    env.CLAUDE_API_KEY = 'proxy-key';
    
    claudeProcess = spawn('claude', ['chat'], {
      env,
      shell: true
    });
    
    claudeProcess.stdout.on('data', (data) => {
      mainWindow.webContents.send('terminal-data', data.toString());
    });
    
    claudeProcess.stderr.on('data', (data) => {
      mainWindow.webContents.send('terminal-data', data.toString());
    });
    
    claudeProcess.on('close', (code) => {
      mainWindow.webContents.send('terminal-data', `\nClaude Code 已退出 (代码: ${code})\n`);
      claudeProcess = null;
      claudeInputStream = null;
    });
    
    claudeInputStream = claudeProcess.stdin;
    
    return {
      success: true,
      message: 'Claude Code 已启动'
    };
  } catch (error) {
    return {
      success: false,
      message: `启动失败: ${error.message}`
    };
  }
}

async function setupProxy(config, mainWindow) {
  const proxyScript = `
const http = require('http');
const https = require('https');
const url = require('url');

const server = http.createServer((req, res) => {
  const targetUrl = '${config.apiUrl}' + req.url;
  const parsedUrl = url.parse(targetUrl);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.path,
    method: req.method,
    headers: {
      ...req.headers,
      'Authorization': 'Bearer ${config.apiKey}',
      'Host': parsedUrl.hostname
    }
  };
  
  delete options.headers['host'];
  
  const protocol = parsedUrl.protocol === 'https:' ? https : http;
  
  const proxyReq = protocol.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('代理错误:', err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  });
  
  req.pipe(proxyReq);
});

server.listen(${config.proxyPort}, () => {
  console.log('代理服务器已启动在端口 ${config.proxyPort}');
});

server.on('error', (err) => {
  console.error('服务器错误:', err);
});
`;

  const proxyPath = path.join(os.tmpdir(), 'miaoda-proxy.js');
  await fs.writeFile(proxyPath, proxyScript);
  
  proxyProcess = spawn('node', [proxyPath], {
    detached: false
  });
  
  proxyProcess.stdout.on('data', (data) => {
    mainWindow.webContents.send('terminal-data', `[代理] ${data.toString()}`);
  });
  
  proxyProcess.stderr.on('data', (data) => {
    mainWindow.webContents.send('terminal-data', `[代理错误] ${data.toString()}`);
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function stopClaudeCode() {
  if (claudeProcess) {
    claudeProcess.kill();
    claudeProcess = null;
  }
  
  if (proxyProcess) {
    proxyProcess.kill();
    proxyProcess = null;
  }
}

function sendInputToClaudeCode(data) {
  if (claudeInputStream && !claudeInputStream.destroyed) {
    claudeInputStream.write(data);
  }
}

module.exports = {
  startClaudeCode,
  stopClaudeCode,
  sendInputToClaudeCode
};