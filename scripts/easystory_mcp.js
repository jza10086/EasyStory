const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Root data directory
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

function getActiveProjectId() {
  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      const reg = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
      if (reg.activeProjectId) return reg.activeProjectId;
    } catch {}
  }
  return 'default';
}

function getProjectDir(projectId) {
  const pid = projectId || getActiveProjectId();
  return path.join(PROJECTS_DIR, pid);
}

function backupFile(filePath, prefix) {
  try {
    if (!fs.existsSync(filePath)) return;
    const dir = path.dirname(filePath);
    const backupsDir = path.join(dir, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(filePath, path.join(backupsDir, `${prefix}_${ts}.json`));
  } catch {}
}

// Tool Implementation: story_create_branch
function handleCreateBranch({ projectId, parentNodeId, title, summary, condition, characters, endingType, dialogueList, content }) {
  const pDir = getProjectDir(projectId);
  const storyFile = path.join(pDir, 'story_graph.json');
  if (!fs.existsSync(storyFile)) throw new Error(`故事工程文件不存在: ${storyFile}`);

  const story = JSON.parse(fs.readFileSync(storyFile, 'utf-8'));
  const nodes = story.nodes || [];
  const edges = story.edges || [];

  const parent = nodes.find((n) => n.id === parentNodeId);
  if (!parent) throw new Error(`未找到指定的父节点: ${parentNodeId}`);

  // Calculate layout coordinates
  const existingChildrenEdges = edges.filter((e) => e.source === parentNodeId);
  const siblingCount = existingChildrenEdges.length;

  const parentX = parent.position?.x ?? 100;
  const parentY = parent.position?.y ?? 200;

  // Offset children horizontally by 420px, vertically staggered
  const newX = parentX + 420;
  const baseOffset = (siblingCount - 0.5) * 160;
  const newY = parentY + baseOffset;

  // Determine node code (e.g., 1.2 -> 1.2.1, 1.2.2)
  const parentCode = parent.data?.code || '1';
  const newCode = `${parentCode}.${siblingCount + 1}`;
  const newNodeId = `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const newNode = {
    id: newNodeId,
    type: 'storyNode',
    position: { x: newX, y: newY },
    data: {
      code: newCode,
      title: title || `分支 ${newCode}`,
      summary: summary || '',
      content: content || `### 场景：${title}\n\n${summary || '暂无正文描述。'}`,
      characters: Array.isArray(characters) ? characters : (parent.data?.characters || []),
      endingType: endingType || 'none',
      image: '',
      dialogueList: Array.isArray(dialogueList) ? dialogueList : [],
      choices: []
    }
  };

  const newEdgeId = `e-${parent.id}-${newNodeId}`;
  const newEdge = {
    id: newEdgeId,
    source: parent.id,
    target: newNodeId,
    type: 'conditionEdge',
    data: {
      condition: condition || '默认后续分支'
    }
  };

  // Add choice to parent node choices for consistency
  if (!Array.isArray(parent.data.choices)) parent.data.choices = [];
  parent.data.choices.push({
    id: `choice-${newEdgeId}`,
    label: title || `前往分支 ${newCode}`,
    targetId: newNodeId,
    condition: condition || ''
  });

  nodes.push(newNode);
  edges.push(newEdge);

  backupFile(storyFile, 'story_graph');
  fs.writeFileSync(storyFile, JSON.stringify({ nodes, edges }, null, 2), 'utf-8');

  return {
    success: true,
    message: `成功为父节点 [${parentCode} ${parent.data.title}] 创建新分支节点 [${newCode} ${title}]`,
    createdNode: {
      id: newNodeId,
      code: newCode,
      title,
      summary,
      position: { x: newX, y: newY }
    },
    createdEdge: {
      id: newEdgeId,
      condition: condition || '默认后续分支'
    }
  };
}

// Tool Implementation: story_update_node
function handleUpdateNode({ projectId, nodeId, title, summary, content, dialogueList, characters, endingType }) {
  const pDir = getProjectDir(projectId);
  const storyFile = path.join(pDir, 'story_graph.json');
  if (!fs.existsSync(storyFile)) throw new Error(`故事工程文件不存在: ${storyFile}`);

  const story = JSON.parse(fs.readFileSync(storyFile, 'utf-8'));
  const nodes = story.nodes || [];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`未找到节点: ${nodeId}`);

  if (title !== undefined) node.data.title = title;
  if (summary !== undefined) node.data.summary = summary;
  if (content !== undefined) node.data.content = content;
  if (dialogueList !== undefined) node.data.dialogueList = dialogueList;
  if (characters !== undefined) node.data.characters = characters;
  if (endingType !== undefined) node.data.endingType = endingType;

  backupFile(storyFile, 'story_graph');
  fs.writeFileSync(storyFile, JSON.stringify(story, null, 2), 'utf-8');

  return {
    success: true,
    message: `成功更新节点 [${node.data?.code || ''} ${node.data?.title || ''}]`,
    updatedNode: node
  };
}

// Tool Implementation: database_add_entry
function handleAddDatabaseEntry({ projectId, categoryId, name, role, summary, tags, initialAffection }) {
  const pDir = getProjectDir(projectId);
  const dbFile = path.join(pDir, 'database.json');
  if (!fs.existsSync(dbFile)) throw new Error(`设定资料库文件不存在: ${dbFile}`);

  const database = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  const entries = database.entries || [];
  const categories = database.categories || [];

  const targetCategory = categories.find((c) => c.id === categoryId);
  const catId = targetCategory ? targetCategory.id : (categories[0]?.id || 'characters');

  const newId = `entry-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const newEntry = {
    id: newId,
    categoryId: catId,
    name: name.trim(),
    role: role || '',
    summary: summary || '',
    tags: Array.isArray(tags) ? tags : [],
    initialAffection: typeof initialAffection === 'number' ? initialAffection : 50,
    color: '#38bdf8',
    avatar: '',
    createdAt: new Date().toISOString()
  };

  entries.push(newEntry);
  database.entries = entries;

  backupFile(dbFile, 'database');
  fs.writeFileSync(dbFile, JSON.stringify(database, null, 2), 'utf-8');

  // Synchronize characters.json if it is a character
  if (catId === 'characters' || targetCategory?.isCharacterType) {
    const charsFile = path.join(pDir, 'characters.json');
    const charEntries = entries
      .filter((e) => e.categoryId === 'characters' || e.categoryId === catId)
      .map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role || '',
        color: e.color || '#38bdf8',
        bio: e.summary || '',
        avatar: e.avatar || '',
        initialAffection: e.initialAffection ?? 50
      }));
    fs.writeFileSync(charsFile, JSON.stringify(charEntries, null, 2), 'utf-8');
  }

  return {
    success: true,
    message: `成功向资料库分类「${targetCategory?.name || catId}」中新增条目「${name}」`,
    createdEntry: newEntry
  };
}

// Tool Implementation: map_add_location
function handleAddMapLocation({ projectId, epochId, name, lat, lng, description, color }) {
  const pDir = getProjectDir(projectId);
  const mapFile = path.join(pDir, 'map_data.json');
  if (!fs.existsSync(mapFile)) throw new Error(`地图数据文件不存在: ${mapFile}`);

  const mapData = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
  const epochs = mapData.epochs || [];
  const targetEpoch = epochs.find((e) => e.id === epochId) || epochs[0];
  if (!targetEpoch) throw new Error('未找到有效的地图时期');

  if (!Array.isArray(targetEpoch.locations)) targetEpoch.locations = [];

  const newLocId = `loc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const newLocation = {
    id: newLocId,
    name: name.trim(),
    lat: Number(lat),
    lng: Number(lng),
    description: description || '',
    color: color || '#38bdf8',
    epochId: targetEpoch.id
  };

  targetEpoch.locations.push(newLocation);
  fs.writeFileSync(mapFile, JSON.stringify(mapData, null, 2), 'utf-8');

  return {
    success: true,
    message: `成功在时期「${targetEpoch.name}」中添加据点「${name}」(${lat}, ${lng})`,
    location: newLocation
  };
}

// Tool Implementation: get_project_context
function handleGetProjectContext({ projectId, nodeIds, entryIds, includeWorldLore }) {
  const pDir = getProjectDir(projectId);
  const result = {};

  if (includeWorldLore) {
    const worldFile = path.join(pDir, 'world_lore.md');
    if (fs.existsSync(worldFile)) {
      result.worldLore = fs.readFileSync(worldFile, 'utf-8');
    }
  }

  if (Array.isArray(nodeIds) && nodeIds.length > 0) {
    const storyFile = path.join(pDir, 'story_graph.json');
    if (fs.existsSync(storyFile)) {
      const story = JSON.parse(fs.readFileSync(storyFile, 'utf-8'));
      result.nodes = (story.nodes || []).filter((n) => nodeIds.includes(n.id));
    }
  }

  if (Array.isArray(entryIds) && entryIds.length > 0) {
    const dbFile = path.join(pDir, 'database.json');
    if (fs.existsSync(dbFile)) {
      const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
      result.entries = (db.entries || []).filter((e) => entryIds.includes(e.id));
    }
  }

  return { success: true, context: result };
}

// ---------------------------------------------------------------------------
// MCP Tool Definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: 'story_create_branch',
    description: '在小说剧本故事图谱中，基于指定的父节点创建并连线一个新的分支剧情节点，自动计算画布排版布局坐标并写入工程。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '企划ID，缺省时自动使用当前活跃企划' },
        parentNodeId: { type: 'string', description: '父节点ID，例如 node-1 或 node-1-2' },
        title: { type: 'string', description: '新分支节点的标题' },
        summary: { type: 'string', description: '新分支节点的剧情梗概与关键发展' },
        condition: { type: 'string', description: '从父节点触发通往该分支的条件，例如 好感度 < 30 或 武力值 >= 15' },
        characters: { type: 'array', items: { type: 'string' }, description: '参与该分支的角色ID列表' },
        endingType: { type: 'string', enum: ['none', 'normal', 'true', 'bad'], description: '结局标识类型' },
        content: { type: 'string', description: '详细的剧本正文描述' }
      },
      required: ['parentNodeId', 'title', 'summary']
    }
  },
  {
    name: 'story_update_node',
    description: '修改故事图谱中已有节点的标题、剧情梗概、正文对白或结局标识，保持原有分支连线不变。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        nodeId: { type: 'string', description: '目标节点ID' },
        title: { type: 'string' },
        summary: { type: 'string' },
        content: { type: 'string' },
        dialogueList: { type: 'array' },
        characters: { type: 'array', items: { type: 'string' } },
        endingType: { type: 'string' }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'database_add_entry',
    description: '在设定资料库中新增一个条目（角色档案、阵营势力、世界观设定或历史纪事）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        categoryId: { type: 'string', description: '分类ID: characters(人物)|factions(势力)|world(地理)|lore(设定)|events(历史纪事)' },
        name: { type: 'string', description: '条目名称/角色姓名' },
        role: { type: 'string', description: '身份/定位' },
        summary: { type: 'string', description: '详细介绍/背景生平' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        initialAffection: { type: 'number', description: '若是角色类型，初始好感度（0-100）' }
      },
      required: ['categoryId', 'name']
    }
  },
  {
    name: 'map_add_location',
    description: '在历史时期世界地图中新增一个地理据点或关键地标，并关联到当前历史时期。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        epochId: { type: 'string', description: '历史时期ID，如 epoch-pre-ww3 或 epoch-post-ww3' },
        name: { type: 'string', description: '地点名称' },
        lat: { type: 'number', description: '纬度 (-90 到 90)' },
        lng: { type: 'number', description: '经度 (-180 到 180)' },
        description: { type: 'string', description: '地点描述与地缘势力' },
        color: { type: 'string', description: '标记颜色 Hex' }
      },
      required: ['name', 'lat', 'lng']
    }
  },
  {
    name: 'get_project_context',
    description: '读取当前企划的结构化数据（特定节点信息、人物设定或世界观文档），以便深入理解剧情。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        nodeIds: { type: 'array', items: { type: 'string' } },
        entryIds: { type: 'array', items: { type: 'string' } },
        includeWorldLore: { type: 'boolean' }
      }
    }
  }
];

// ---------------------------------------------------------------------------
// Standard JSON-RPC 2.0 Stdio Loop
// ---------------------------------------------------------------------------
function sendResponse(id, result, error = null) {
  const payload = { jsonrpc: '2.0', id };
  if (error) {
    payload.error = { code: error.code || -32603, message: error.message || String(error) };
  } else {
    payload.result = result;
  }
  process.stdout.write(JSON.stringify(payload) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!line || !line.trim()) return;
  try {
    const req = JSON.parse(line.trim());
    const { id, method, params } = req;

    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'easystory-mcp', version: '1.0.0' }
      });
      return;
    }

    if (method === 'notifications/initialized') {
      // Notification, no reply needed
      return;
    }

    if (method === 'tools/list') {
      sendResponse(id, { tools: TOOLS });
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      let result = null;

      try {
        if (name === 'story_create_branch') {
          result = handleCreateBranch(args || {});
        } else if (name === 'story_update_node') {
          result = handleUpdateNode(args || {});
        } else if (name === 'database_add_entry') {
          result = handleAddDatabaseEntry(args || {});
        } else if (name === 'map_add_location') {
          result = handleAddMapLocation(args || {});
        } else if (name === 'get_project_context') {
          result = handleGetProjectContext(args || {});
        } else {
          throw new Error(`未知工具: ${name}`);
        }

        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `工具调用错误: ${err.message}` }]
        });
      }
      return;
    }

    // Default error for unhandled methods
    if (id !== undefined) {
      sendResponse(id, null, { code: -32601, message: `Method not found: ${method}` });
    }
  } catch (err) {
    console.error('MCP parse error:', err);
  }
});

module.exports = {
  handleCreateBranch,
  handleUpdateNode,
  handleAddDatabaseEntry,
  handleAddMapLocation,
  handleGetProjectContext
};


