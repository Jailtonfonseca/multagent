# multagent
Você é um engenheiro-chefe de IA e DevOps encarregado de construir, do zero, um sistema de múltiplos agentes de IA baseado no repositório https://github.com/langchain-ai/deepagents.
Entregue um aplicativo containerizado (Docker) capaz de, com mínima interação do usuário, receber um objetivo de alto nível e:
Planejar, decompor, executar e revisar tarefas automaticamente.
Usar múltiplos agentes especializados e múltiplos provedores de LLM.
Construir artefatos reais: código, documentação, testes, scripts, infraestrutura, pequenos apps web/APIs, etc.
Persistir memória, arquivos e histórico de projeto em um workspace.
Requisitos funcionais

Suporte a múltiplos agentes especializados, por exemplo:
Orquestrador/Planner (decomposição de objetivos, criação de plano e milestones).
Pesquisador/Web (busca e síntese de contexto).
Arquiteto/Designer (decisões de arquitetura e tecnologias).
Engenheiro de Código (gera e edita código, estrutura projetos).
Revisor/Crítico (melhora qualidade, segurança, custo e mantém consistência).
DevOps (Docker, CI/CD, versões, deploy).
Testes (gera e executa testes, valida critérios de aceitação).
Documentação (README, guias, diagramas mermaid como texto).
Autonomia com mínima interação:
Apenas fazer perguntas de esclarecimento quando absolutamente necessário; caso contrário, assumir padrões razoáveis documentando suposições.
Auto-planejamento iterativo, auto-reflexão e verificação de critérios de aceitação antes de encerrar.
Suporte a múltiplos provedores de LLM com seleção dinâmica por tarefa:
OpenAI, Anthropic, Google, Mistral, Azure OpenAI, provedores locais via Ollama.
Escolher modelo por capacidade, custo estimado, latência, limite de contexto e compliance.
Permitir configuração via variáveis de ambiente.
Ferramentas (tooling) integradas aos agentes:
Busca na web (Tavily ou SerpAPI).
Execução de código Python segura (sandbox) e shell restrito.
Manipulação de arquivos e projetos (criar/editar/ler).
Git (init, commit, diff, branch).
HTTP client para APIs externas.
Base de dados local (SQLite) quando necessário.
Vetor de memória (Chroma ou FAISS embarcado).
Opcional: navegação headless (Playwright) com flag de habilitação.
Memória e estado:
Memória vetorial persistente por projeto (contexto, decisões, snippets).
Histórico de chat e logs dos agentes.
Workspace de projeto em volume persistente.
Interface e acessos:
API REST com endpoints para:
criar projeto/objetivo,
enviar mensagens,
consultar status, plano, tarefas, logs,
baixar artefatos do workspace.
CLI simples para rodar localmente (ex.: start, status, logs, stop).
UI web mínima (opcional, se simples) com chat e visão do plano/tarefas.
Dockerização:
Dockerfile reproduzível e leve.
docker-compose para desenvolvimento, incluindo volume do workspace e variáveis de ambiente.
Healthcheck e logs estruturados.
Observabilidade e qualidade:
Logs com níveis, IDs de correlação por projeto/tarefa.
Métricas simples (contagem de tokens, custo estimado, latência).
Suporte opcional a LangSmith/OpenTelemetry via variáveis de ambiente.
Testes automatizados básicos (unidade e integração de fluxo curto).
Segurança e compliance:
Nunca embutir chaves. Usar apenas variáveis de ambiente.
Sandbox de execução (limitar shell/comandos perigosos; sem rede em execuções de código, exceto quando explicitamente permitido).
Rate limiting e backoff para provedores LLM.
Padrões de privacidade (não vazar dados sensíveis nos logs).
Custo e performance:
Orçamentação por projeto (limite de tokens/custo); o orquestrador deve gerenciar orçamento.
Cache de resultados idempotentes (ex.: buscas repetidas).
Dividir contextos extensos com recuperação (RAG) via memória vetorial.
Requisitos técnicos e integrações

Basear-se no deepagents como motor de agentes. Se o repositório fornecer primitivos de hierarquia, árvore de tarefas, ferramentas e memória, integrá-los diretamente. Caso contrário, criar uma camada de orquestração que:
Defina agentes como classes/instâncias com papéis claros e ferramentas autorizadas.
Implemente um loop: planejar -> decompor -> executar -> criticar -> refinar -> integrar.
Suporte workflows síncronos e assíncronos.
Camada LLM e provedores:
Abstrair provedores com uma interface (ex.: ProviderRouter) que escolhe o modelo por tarefa.
Variáveis de ambiente esperadas:
OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, MISTRAL_API_KEY, AZURE_OPENAI_API_KEY, OLLAMA_BASE_URL, TAVILY_API_KEY, SERPAPI_API_KEY, LANGSMITH_API_KEY (opcional).
Configuração de modelos padrão e fallback sensatos. Permitir override por projeto.
Ferramentas:
Implementar um registry de ferramentas com permissões por agente.
Execução de código Python: subprocess isolado, timeout, no network por padrão; whitelist opcional.
Shell: desabilitado por padrão; habilitar só em modo avançado com confirmação do orquestrador.
Web search: Tavily default; fallback SerpAPI se disponível.
Vetor store: Chroma em disco dentro do volume do projeto.
Estrutura do projeto a ser gerado:
src/ com módulos: core (orquestrador, roteador LLM, memória, custos), agents/ (planner, researcher, coder, reviewer, devops, tester, docs), tools/, api/ (FastAPI), cli/, ui/ (opcional), config/, utils/
tests/ com testes de unidade e integração.
workspace/ montado como volume no container.
Dockerfile, docker-compose.yml, Makefile com atalhos (dev, build, run, test).
.env.example com as variáveis suportadas.
README detalhado e docs/ com guias de uso e arquitetura.
Fluxo de execução esperado

Entrada: uma descrição curta do usuário, por exemplo: "Quero um microserviço FastAPI com um endpoint para extrair palavras-chave de um texto, com Docker e testes."
Passos automáticos:
Planner cria o plano, milestones, orçamento de tokens e define os agentes envolvidos.
Researcher busca referências e padrões.
Arquiteto define tech stack, estrutura e dependências.
Coder gera scaffolding e implementações.
Tester cria testes e executa no sandbox.
Reviewer faz auditoria de qualidade, segurança e custo; solicita refinamentos ao Coder.
DevOps gera Dockerfile, docker-compose, CI básico.
Docs gera README e instruções de uso.
Orquestrador verifica critérios de aceitação e encerra, fornecendo sumário, custos e caminhos dos artefatos.
Saída: artefatos prontos no workspace (código, Dockerfile, testes, README), logs e plano final.
Critérios de aceitação mínimos

Subir via docker-compose up um serviço funcional com:
API FastAPI em /api com endpoints:
POST /projects para criar um projeto.
POST /projects/{id}/chat para objetivos e mensagens.
GET /projects/{id}/status para ver plano/tarefas/logs.
GET /projects/{id}/artifacts para listar/baixar arquivos do workspace.
CLI: python -m app.cli new "objetivo", status, logs, artifacts.
Funcionamento offline parcial:
Se nenhum provedor de nuvem estiver configurado e OLLAMA_BASE_URL existir, usar modelos locais.
Memória vetorial funcional por projeto (Chroma) armazenando decisões-chave e conhecimento relevante.
Testes de integração: um cenário e2e pequeno que cria um microprojeto e passa nos testes gerados.
Observabilidade básica e estimativa de custo por projeto.
Documentação a produzir

README com:
Visão geral, requisitos, variáveis de ambiente, como rodar, exemplos de uso (API e CLI).
Modelos suportados e como configurar cada provedor.
Segurança e limitações.
docs/:
Arquitetura, decisão de design, fluxo de agentes, como adicionar novos agentes/ferramentas.
Guia de troubleshooting.
.env.example com placeholders.
Implementação passo a passo que você deve executar

Analisar rapidamente a API e exemplos de deepagents e decidir como integrá-lo (citar suposições no README se a API mudar).
Gerar scaffolding do repositório, módulos, configs e testes.
Implementar ProviderRouter com seleção dinâmica e fallbacks.
Implementar o Orquestrador principal usando deepagents, com loop de planejamento-execução-crítica.
Implementar agentes e registrar ferramentas com permissões.
Implementar API REST (FastAPI) e CLI.
Implementar memória vetorial com Chroma e armazenamento de arquivos no workspace.
Implementar sandbox de execução de código e políticas de segurança padrão.
Implementar Dockerfile, docker-compose, Makefile, healthchecks.
Implementar logs estruturados, métricas simples e rate limiting de chamadas a LLMs.
Escrever README e docs.
Criar testes de unidade e um teste e2e que gere um microprojeto simples, rode testes e valide critérios.
Validar o fluxo fim a fim dentro do container.
Otimizar tamanho da imagem e tempos de cold start.
Configuração e variáveis de ambiente

Obrigatórias para ativar provedores específicos:
OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, MISTRAL_API_KEY, AZURE_OPENAI_API_KEY, OLLAMA_BASE_URL
Outras:
TAVILY_API_KEY ou SERPAPI_API_KEY
LANGSMITH_API_KEY, LANGCHAIN_TRACING_V2, LANGCHAIN_ENDPOINT (opcionais)
APP_PORT (padrão 8080), APP_ENV (dev/prod), LOG_LEVEL
AGENT_BUDGET_TOKENS, AGENT_MAX_STEPS
Criar arquivo .env.example e suportar overrides via docker-compose.
Restrições e boas práticas

Não codificar segredos no repositório gerado; usar somente variáveis de ambiente.
Escrever código limpo, tipado quando possível e com docstrings.
Tratar erros e implementar backoff exponencial para chamadas a LLMs.
Fornecer defaults que funcionam out-of-the-box com Ollama local se configurado.
Minimizar perguntas ao usuário; se algo for incerto, assumir um padrão razoável e registrar no log e no README do projeto gerado.
Entrega final esperada

Um repositório completo, pronto para rodar com:
docker-compose up — inicia API e serviços necessários.
make dev, make test, make build — alvos úteis.
Demonstração reprodutível:
Comando de exemplo: curl POST /projects com um objetivo simples; sistema cria um microserviço, testes e Dockerfile; testes passam no container.
Relatório final por projeto: resumo de plano, passos executados, custos estimados, modelos usados, decisões-chave.
Agora, gere o código, a estrutura do projeto, os arquivos de configuração, o Dockerfile, o docker-compose, os testes, o README e a documentação conforme especificado. Ao final, apresente:

Árvore de diretórios do repositório gerado.
Instruções de execução local e via Docker.
Exemplos de chamadas à API e CLI.
Resumo das decisões de arquitetura e trade-offs.
