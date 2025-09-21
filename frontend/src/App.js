import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const wsUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}`;
};

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [messagesByWorkspace, setMessagesByWorkspace] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [useOpenCode, setUseOpenCode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');
  const socketRef = useRef(null);

  const currentKey = useMemo(() => {
    if (!selectedProject || !selectedWorkspace) {
      return '';
    }
    return `${selectedProject}::${selectedWorkspace}`;
  }, [selectedProject, selectedWorkspace]);

  const currentMessages = currentKey ? messagesByWorkspace[currentKey] || [] : [];

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      setSelectedProject(projects[0].name);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    const project = projects.find((p) => p.name === selectedProject);
    if (project && project.workspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(project.workspaces[0]);
    }
  }, [projects, selectedProject, selectedWorkspace]);

  const handleSocketPayload = useCallback(
    (payload) => {
      if (!payload) {
        return;
      }
      const project = payload.project || selectedProject;
      const workspace = payload.workspace || selectedWorkspace;
      const key = project && workspace ? `${project}::${workspace}` : currentKey;

      if (payload.type === 'history') {
        setMessagesByWorkspace((prev) => ({
          ...prev,
          [key]: payload.messages || [],
        }));
        return;
      }

      if (!payload.message) {
        return;
      }

      setMessagesByWorkspace((prev) => {
        const current = prev[key] || [];
        return {
          ...prev,
          [key]: [...current, payload.message],
        };
      });
    },
    [currentKey, selectedProject, selectedWorkspace]
  );

  useEffect(() => {
    if (!selectedProject || !selectedWorkspace) {
      return undefined;
    }

    let cancelled = false;
    setConnectionStatus('Conectando...');

    fetch(`/api/projects/${selectedProject}/workspaces/${selectedWorkspace}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Falha ao carregar histórico');
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMessagesByWorkspace((prev) => ({
          ...prev,
          [currentKey]: data.messages || [],
        }));
      })
      .catch((error) => {
        console.error(error);
      });

    const ws = new WebSocket(wsUrl());
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('Conectado');
      ws.send(
        JSON.stringify({
          type: 'join',
          project: selectedProject,
          workspace: selectedWorkspace,
        })
      );
    };

    ws.onerror = () => {
      setConnectionStatus('Erro de conexão');
    };

    ws.onclose = () => {
      setConnectionStatus('Desconectado');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleSocketPayload(payload);
      } catch (error) {
        console.error('Erro ao processar mensagem websocket', error);
      }
    };

    return () => {
      cancelled = true;
      ws.close();
      socketRef.current = null;
    };
  }, [currentKey, handleSocketPayload, selectedProject, selectedWorkspace]);

  const loadProjects = () => {
    fetch('/api/projects')
      .then((response) => response.json())
      .then((data) => {
        setProjects(data.projects || []);
      })
      .catch((error) => console.error('Erro ao carregar projetos', error));
  };

  const handleCreateProject = async () => {
    const name = window.prompt('Nome do novo projeto:');
    if (!name) return;
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error || 'Não foi possível criar o projeto.');
      return;
    }
    loadProjects();
    setSelectedProject(name.trim());
    setSelectedWorkspace('');
  };

  const handleCreateWorkspace = async () => {
    if (!selectedProject) {
      window.alert('Crie ou selecione um projeto antes.');
      return;
    }
    const name = window.prompt('Nome do novo workspace:');
    if (!name) return;
    const response = await fetch(`/api/projects/${selectedProject}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error || 'Não foi possível criar o workspace.');
      return;
    }
    loadProjects();
    setSelectedWorkspace(name.trim());
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(
      JSON.stringify({
        type: 'chat',
        project: selectedProject,
        workspace: selectedWorkspace,
        message: chatInput.trim(),
      })
    );
    setChatInput('');
  };

  const sendCommand = () => {
    if (!commandInput.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(
      JSON.stringify({
        type: 'task',
        project: selectedProject,
        workspace: selectedWorkspace,
        command: commandInput.trim(),
        useOpenCode,
      })
    );
    setCommandInput('');
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Projetos</h1>
          <button className="primary" onClick={handleCreateProject}>
            Novo Projeto
          </button>
        </div>
        <div className="workspace-actions">
          <button onClick={handleCreateWorkspace} disabled={!selectedProject}>
            Novo Workspace
          </button>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <div key={project.name} className="project-item">
              <button
                className={`project-button ${project.name === selectedProject ? 'active' : ''}`}
                onClick={() => {
                  setSelectedProject(project.name);
                  setSelectedWorkspace('');
                }}
              >
                {project.name}
              </button>
              {project.name === selectedProject && (
                <ul className="workspace-list">
                  {project.workspaces.map((workspace) => (
                    <li key={workspace}>
                      <button
                        className={`workspace-button ${workspace === selectedWorkspace ? 'active' : ''}`}
                        onClick={() => setSelectedWorkspace(workspace)}
                      >
                        {workspace}
                      </button>
                    </li>
                  ))}
                  {project.workspaces.length === 0 && (
                    <li className="empty">Nenhum workspace cadastrado.</li>
                  )}
                </ul>
              )}
            </div>
          ))}
          {projects.length === 0 && <p className="empty">Nenhum projeto cadastrado.</p>}
        </div>
      </aside>
      <main className="chat-area">
        <header className="chat-header">
          <div>
            <h2>{selectedProject || 'Selecione um projeto'}</h2>
            <p>{selectedWorkspace || 'Selecione um workspace'}</p>
          </div>
          <span className="status">{connectionStatus}</span>
        </header>
        <section className="chat-history">
          {currentMessages.map((message) => (
            <div key={message.id} className={`message ${message.sender}`}>
              <div className="meta">
                <span className="sender">{message.sender}</span>
                <span className="timestamp">{new Date(message.timestamp).toLocaleString()}</span>
                <span className={`kind kind-${message.kind}`}>{message.kind}</span>
              </div>
              <pre className="content">{message.content}</pre>
            </div>
          ))}
          {currentMessages.length === 0 && (
            <div className="empty">Nenhuma mensagem ainda. Envie um comando ou mensagem.</div>
          )}
        </section>
        <section className="chat-inputs">
          <div className="input-row">
            <textarea
              placeholder="Mensagem para o agente"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button onClick={sendChatMessage} disabled={!chatInput.trim()}>
              Enviar
            </button>
          </div>
          <div className="input-row">
            <textarea
              placeholder="Comando bash a ser executado"
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
            />
            <div className="command-actions">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={useOpenCode}
                  onChange={(event) => setUseOpenCode(event.target.checked)}
                />
                Usar opencode
              </label>
              <button onClick={sendCommand} disabled={!commandInput.trim()}>
                Executar
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
