const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const WebSocket = require('ws');

const PORT = process.env.PORT || 4000;
const PROJECTS_DIR = path.resolve(__dirname, '../projects');
const STATE_FILE = path.resolve(__dirname, 'state.json');
const OPENCODE_DIR = path.resolve(__dirname, 'opencode');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

ensureDirectory(PROJECTS_DIR);
const state = loadState();

maybeCloneOpenCode();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const workspaceClients = new Map();

app.get('/api/projects', (req, res) => {
  const projects = Object.keys(state.projects).map((name) => ({
    name,
    workspaces: Object.keys(state.projects[name].workspaces)
  }));
  res.json({ projects });
});

app.post('/api/projects', (req, res) => {
  const { name } = req.body || {};
  if (!isValidName(name)) {
    return res.status(400).json({ error: 'Nome de projeto inválido. Use apenas letras, números, hífens e underscores.' });
  }
  if (state.projects[name]) {
    return res.status(409).json({ error: 'Projeto já existe.' });
  }

  const projectPath = path.join(PROJECTS_DIR, name);
  try {
    ensureDirectory(projectPath);
    state.projects[name] = { workspaces: {} };
    persistState();
    res.status(201).json({ name });
  } catch (error) {
    console.error('Erro ao criar projeto', error);
    res.status(500).json({ error: 'Não foi possível criar o projeto.' });
  }
});

app.post('/api/projects/:project/workspaces', (req, res) => {
  const { project } = req.params;
  const { name } = req.body || {};
  if (!state.projects[project]) {
    return res.status(404).json({ error: 'Projeto não encontrado.' });
  }
  if (!isValidName(name)) {
    return res.status(400).json({ error: 'Nome de workspace inválido.' });
  }
  if (state.projects[project].workspaces[name]) {
    return res.status(409).json({ error: 'Workspace já existe.' });
  }

  state.projects[project].workspaces[name] = { messages: [] };
  persistState();
  res.status(201).json({ name });
});

app.get('/api/projects/:project/workspaces/:workspace', (req, res) => {
  const { project, workspace } = req.params;
  const projectState = state.projects[project];
  if (!projectState) {
    return res.status(404).json({ error: 'Projeto não encontrado.' });
  }
  const workspaceState = projectState.workspaces[workspace];
  if (!workspaceState) {
    return res.status(404).json({ error: 'Workspace não encontrado.' });
  }
  res.json({ messages: workspaceState.messages });
});

app.use(express.static(path.resolve(__dirname, '../frontend/build')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/build/index.html'));
});

wss.on('connection', (ws) => {
  let subscriptionKey = null;

  ws.on('message', (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch (error) {
      console.warn('Mensagem inválida recebida via websocket', error);
      return;
    }

    const { type, project, workspace } = payload;
    if (type === 'join') {
      if (!validateWorkspace(project, workspace, ws)) {
        return;
      }
      subscriptionKey = workspaceKey(project, workspace);
      addClient(subscriptionKey, ws);
      const history = state.projects[project].workspaces[workspace].messages || [];
      ws.send(JSON.stringify({ type: 'history', project, workspace, messages: history }));
      return;
    }

    if (!subscriptionKey || !validateWorkspace(project, workspace, ws)) {
      return;
    }

    if (type === 'chat') {
      const { message } = payload;
      if (!message) {
        return;
      }
      const entry = buildMessage('user', 'chat', message);
      appendMessage(project, workspace, entry);
      broadcast(subscriptionKey, { type: 'chat', project, workspace, message: entry });
      return;
    }

    if (type === 'task') {
      const { command, useOpenCode } = payload;
      if (!command) {
        return;
      }
      const entry = buildMessage('user', 'task', command);
      appendMessage(project, workspace, entry);
      broadcast(subscriptionKey, { type: 'task', project, workspace, message: entry });
      runTask(project, workspace, command, Boolean(useOpenCode));
      return;
    }
  });

  ws.on('close', () => {
    if (subscriptionKey) {
      removeClient(subscriptionKey, ws);
    }
  });
});

function runTask(project, workspace, command, useOpenCode) {
  const key = workspaceKey(project, workspace);
  const projectPath = path.join(PROJECTS_DIR, project);
  if (!fs.existsSync(projectPath)) {
    const errorEntry = buildMessage('system', 'error', `Diretório do projeto "${project}" não encontrado.`);
    appendMessage(project, workspace, errorEntry);
    broadcast(key, { type: 'error', project, workspace, message: errorEntry });
    return;
  }

  let shellCommand = command;
  if (useOpenCode) {
    if (!fs.existsSync(OPENCODE_DIR)) {
      const warning = buildMessage('system', 'error', 'Repositório opencode não está disponível.');
      appendMessage(project, workspace, warning);
      broadcast(key, { type: 'error', project, workspace, message: warning });
      return;
    }
    const opencodeBin = path.join(OPENCODE_DIR, 'packages', 'opencode', 'bin', 'opencode');
    shellCommand = `${JSON.stringify(opencodeBin)} ${command}`;
  }

  const taskEntry = buildMessage('system', 'info', `Executando comando: ${shellCommand}`);
  appendMessage(project, workspace, taskEntry);
  broadcast(key, { type: 'info', project, workspace, message: taskEntry });

  const child = spawn('bash', ['-lc', shellCommand], {
    cwd: projectPath,
    env: process.env,
  });

  child.on('error', (error) => {
    const message = buildMessage('system', 'error', `Falha ao iniciar comando: ${error.message}`);
    appendMessage(project, workspace, message);
    broadcast(key, { type: 'error', project, workspace, message });
  });

  child.stdout.on('data', (chunk) => {
    const output = chunk.toString();
    if (!output.trim()) {
      return;
    }
    const message = buildMessage('system', 'output', output.trim());
    appendMessage(project, workspace, message);
    broadcast(key, { type: 'output', project, workspace, message });
  });

  child.stderr.on('data', (chunk) => {
    const output = chunk.toString();
    if (!output.trim()) {
      return;
    }
    const message = buildMessage('system', 'error', output.trim());
    appendMessage(project, workspace, message);
    broadcast(key, { type: 'error', project, workspace, message });
  });

  child.on('close', (code) => {
    const resultMessage = buildMessage('system', code === 0 ? 'info' : 'error', `Comando finalizado com código ${code}.`);
    appendMessage(project, workspace, resultMessage);
    broadcast(key, { type: 'result', project, workspace, message: resultMessage });
  });
}

function appendMessage(project, workspace, message) {
  if (!state.projects[project]) {
    state.projects[project] = { workspaces: {} };
  }
  if (!state.projects[project].workspaces[workspace]) {
    state.projects[project].workspaces[workspace] = { messages: [] };
  }
  state.projects[project].workspaces[workspace].messages.push(message);
  persistState();
}

function buildMessage(sender, kind, content) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sender,
    kind,
    content,
    timestamp: new Date().toISOString(),
  };
}

function validateWorkspace(project, workspace, ws) {
  if (!project || !workspace) {
    ws.send(JSON.stringify({ type: 'error', message: 'Projeto e workspace são obrigatórios.' }));
    return false;
  }
  if (!state.projects[project]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Projeto não encontrado.' }));
    return false;
  }
  if (!state.projects[project].workspaces[workspace]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Workspace não encontrado.' }));
    return false;
  }
  return true;
}

function workspaceKey(project, workspace) {
  return `${project}::${workspace}`;
}

function addClient(key, ws) {
  if (!workspaceClients.has(key)) {
    workspaceClients.set(key, new Set());
  }
  workspaceClients.get(key).add(ws);
}

function removeClient(key, ws) {
  if (!workspaceClients.has(key)) {
    return;
  }
  const clients = workspaceClients.get(key);
  clients.delete(ws);
  if (clients.size === 0) {
    workspaceClients.delete(key);
  }
}

function broadcast(key, payload) {
  const clients = workspaceClients.get(key);
  if (!clients) {
    return;
  }
  const serialized = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { projects: {} };
  }
  try {
    const content = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Falha ao carregar estado, iniciando novo estado.', error);
    return { projects: {} };
  }
}

function persistState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Erro ao salvar estado', error);
  }
}

function isValidName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(name);
}

function maybeCloneOpenCode() {
  if (fs.existsSync(path.join(OPENCODE_DIR, '.git'))) {
    return;
  }
  console.log('Clonando repositório opencode...');
  try {
    const result = spawnSync('git', ['clone', '--depth', '1', 'https://github.com/sst/opencode.git', OPENCODE_DIR], {
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.warn('Falha ao clonar opencode. Execuções que dependem do opencode podem falhar.');
    }
  } catch (error) {
    console.warn('Não foi possível clonar o repositório opencode.', error);
  }
}

server.listen(PORT, () => {
  console.log(`Servidor em execução na porta ${PORT}`);
});
