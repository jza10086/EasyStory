const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  handleCreateBranch,
  handleUpdateNode,
  handleAddDatabaseEntry,
  handleAddMapLocation,
  handleGetProjectContext
} = require('./scripts/easystory_mcp.js');

const AGENTAPI_EXE = 'C:\\Users\\81010\\AppData\\Local\\Programs\\antigravity\\resources\\bin\\language_server.exe';
const GEMINI_BRAIN_DIR = 'C:\\Users\\81010\\.gemini\\antigravity\\brain';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

[DATA_DIR, IMAGES_DIR, PROJECTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(IMAGES_DIR));

// Default initial data if files do not exist
const defaultMapData = {
  timelineSettings: {
    minYear: 2000,
    maxYear: 2100,
    leftBound: 2000,
    rightBound: 2042,
    currentTime: 2024
  },
  currentEpochId: 'epoch-pre-ww3',
  epochs: [
    {
      id: 'epoch-pre-ww3',
      name: '三战前',
      timeRange: [2000, 2042],
      mapVariant: 'pre-ww3',
      description: '第三次世界大战爆发前的全球地缘格局与国际秩序（2000 ~ 2042年）。',
      regionColors: {},
      locations: [],
      platesData: {}
    },
    {
      id: 'epoch-post-ww3',
      name: '三战后',
      timeRange: [2042, 2100],
      mapVariant: 'post-ww3',
      description: '第三次世界大战后的世界新秩序、地缘版图重组与战后重建（2042 ~ 2100年）。',
      regionColors: {},
      locations: [],
      platesData: {}
    }
  ],
  locations: [],
  timeline: []
};
const defaultStory = {
  nodes: [
    {
      id: 'node-1',
      type: 'storyNode',
      position: { x: 100, y: 220 },
      data: {
        code: '1',
        title: '遗迹初遇',
        summary: '在古代以太遗迹深处，主角发现了昏迷的银发少女艾莉丝，周边有异化魔物苏醒的异动。',
        content: `### 场景：崩塌的以太回廊

空气中弥漫着刺鼻的焦硫味。蓝色的以太微光在破损的石柱间明灭不定。

主角握紧手中的短剑，缓步穿过碎石。在祭坛边缘，一个娇小的身影倒在血泊中——那是一位银发少女，身上穿着带有王国禁卫军纹章的残破斗篷。

突然，地底深处传来沉闷的低吼，三头【岩甲噬魂兽】从阴影中缓缓爬出，猩红的复眼死死盯住了倒地的少女。

> "唔……快走……别管我……" 少女微弱地呢喃着，手指无力地抓着石板。

此时此刻，主角必须做出决断。`,
        characters: ['char-alice'],
        endingType: 'none', // none, normal, true, bad
        image: '',
        choices: [
          { id: 'choice-1-1', label: '救助少女并迅速撤退', targetId: 'node-1-1', condition: '好感度 +15 / 需消耗体力' },
          { id: 'choice-1-2', label: '先拔刀消灭逼近的魔物', targetId: 'node-1-2', condition: '武力值 >= 12' },
          { id: 'choice-1-3', label: '静观其变，暗中调查身份', targetId: 'node-1-3', condition: '洞察 >= 14 / 潜行模式' }
        ]
      }
    },
    {
      id: 'node-1-1',
      type: 'storyNode',
      position: { x: 620, y: 60 },
      data: {
        code: '1.1',
        title: '并肩脱险',
        summary: '主角抱起少女冲出崩塌通道。少女苏醒，得知主角身份后放下防备，赠予护身符。',
        content: `主角毫不犹豫地冲上前，一把抱起冰冷的银发少女，顺手甩出一枚烟雾弹阻挡魔物的视线，借着风势狂奔冲向侧翼的安全通道！

巨石在身后接连轰鸣塌陷，彻底阻断了怪物的追击。

在安全庇护所内，艾莉丝缓缓睁开了淡紫色的眼眸。
"谢谢你……我还以为自己再也见不到阳光了。" 她轻声说着，脸颊微红。`,
        characters: ['char-alice'],
        endingType: 'none',
        image: '',
        choices: []
      }
    },
    {
      id: 'node-1-2',
      type: 'storyNode',
      position: { x: 620, y: 220 },
      data: {
        code: '1.2',
        title: '险胜魔物',
        summary: '主角拔刀斩杀魔物，展现惊人战力。少女惊醒，对主角力量感到震撼并略带戒备。',
        content: `主角眼神一凛，拔刀横斩！凌厉的剑气精准劈碎了领头噬魂兽的硬甲。

经过一番苦战，三头怪物尽数毙命。

少女此时被打斗声惊醒，捂着伤口后退半步，警惕地打量着浑身浴血的主角：
"好强的剑术……你到底是什么人？也是为了王室秘宝而来的吗？"`,
        characters: ['char-alice'],
        endingType: 'none',
        image: '',
        choices: []
      }
    },
    {
      id: 'node-1-3',
      type: 'storyNode',
      position: { x: 620, y: 380 },
      data: {
        code: '1.3',
        title: '探问虚实',
        summary: '主角隐于阴影观察，发现了遗落的信物与符文，洞悉了王国叛乱的惊人线索。',
        content: `主角藏身于石柱阴影中冷静观察。魔物扑向少女的一刹那，少女脖颈间的吊坠突然爆发出剧烈的金色结界，将魔物震退！

从那枚坠子的纹样来看，这绝非普通贵族之物，而是已经失落百年的【圣辉王印】。

"原来传闻是真的……王都叛乱中逃脱的真正王储，就是她。" 主角心中暗忖。`,
        characters: ['char-alice'],
        endingType: 'none',
        image: '',
        choices: []
      }
    }
  ],
  edges: [
    {
      id: 'e-1-1.1',
      source: 'node-1',
      target: 'node-1-1',
      type: 'conditionEdge',
      data: { condition: '好感度 +15 / 需消耗体力' }
    },
    {
      id: 'e-1-1.2',
      source: 'node-1',
      target: 'node-1-2',
      type: 'conditionEdge',
      data: { condition: '武力值 >= 12' }
    },
    {
      id: 'e-1-1.3',
      source: 'node-1',
      target: 'node-1-3',
      type: 'conditionEdge',
      data: { condition: '洞察 >= 14 / 潜行' }
    }
  ]
};

const defaultCharacters = [
  {
    id: 'char-alice',
    name: '艾莉丝 (Alice)',
    role: '落难王储 / 圣术使',
    bio: '身负圣辉血脉的银发少女，在王都政变中逃脱。性格外柔内刚，善良但对陌生人带有防备心。好感度高时会展现极大的依赖与信任。',
    avatar: '',
    color: '#ec4899',
    initialAffection: 50
  },
  {
    id: 'char-reyn',
    name: '雷恩 (Reyn)',
    role: '佣兵副官',
    bio: '经验丰富的退伍军官，主角信赖的左右手。性格沉稳、务实，擅长战术分析，对主角绝对忠诚。',
    avatar: '',
    color: '#3b82f6',
    initialAffection: 80
  }
];

const defaultWorldLore = `# 世界观核心设定：以太纪元

## 1. 核心背景
千年前的“天裂灾变”导致古代超以太文明崩解，地表遗留大量蕴藏未知能量的古代遗迹与失控魔物。
大陆当前由【神圣罗恩帝国】与【商盟联邦】分立，表面维持和平，暗流涌动。

## 2. 核心势力与关键阵营
- **圣辉王族**：传承古代光之以太血脉，但近期王都被权臣发动军事政变，正统血脉四散流亡。
- **黑鸦猎兵团**：拿钱办事的精锐佣兵组织，主角与其有深厚羁绊。
- **深渊秘教**：企图收集以太圣石唤醒古神的邪恶隐秘组织。

## 3. 剧情分支重要数值/属性规则
- **好感度体系**：
  - < 30：冷漠/敌对（容易触发背叛或冷眼相待分支）
  - 30 ~ 60：普通伙伴
  - 60 ~ 85：深受信赖（解锁隐藏秘密对话与重要掩护剧情）
  - \> 85：誓约羁绊（达成 True Ending 专属结局前置条件）
- **主角属性检定**：
  - 武力（Combat）、智谋（Intelligence）、洞察（Perception）、魅力（Charm）
`;

const defaultSettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  temperature: 0.7
};

// ---------------------------------------------------------------------------
// Multi-Project Management & Legacy Migration
// ---------------------------------------------------------------------------

function getProjectsRegistry() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  } catch (err) {
    console.error('Error reading projects.json:', err);
    return null;
  }
}

function saveProjectsRegistry(registry) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(registry, null, 2), 'utf-8');
}

function migrateAndInitProjects() {
  let registry = getProjectsRegistry();

  if (!registry || !Array.isArray(registry.projects) || registry.projects.length === 0) {
    console.log('✨ 检测到首次开启多企划模式，正在无缝平移现有数据至「默认企划」...');
    const defaultProjectId = 'default';
    const defaultProjDir = path.join(PROJECTS_DIR, defaultProjectId);
    if (!fs.existsSync(defaultProjDir)) {
      fs.mkdirSync(defaultProjDir, { recursive: true });
    }

    const legacyFiles = [
      { name: 'story_graph.json', defaultContent: () => JSON.stringify(defaultStory, null, 2) },
      { name: 'characters.json', defaultContent: () => JSON.stringify(defaultCharacters, null, 2) },
      { name: 'world_lore.md', defaultContent: () => defaultWorldLore },
      { name: 'database.json', defaultContent: () => JSON.stringify({ categories: [], entries: [] }, null, 2) },
      { name: 'map_data.json', defaultContent: () => JSON.stringify(defaultMapData, null, 2) }
    ];

    legacyFiles.forEach(({ name, defaultContent }) => {
      const legacyPath = path.join(DATA_DIR, name);
      const targetPath = path.join(defaultProjDir, name);

      if (fs.existsSync(legacyPath)) {
        fs.copyFileSync(legacyPath, targetPath);
      } else if (!fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, defaultContent(), 'utf-8');
      }
    });

    const legacyBackups = path.join(DATA_DIR, 'backups');
    const targetBackups = path.join(defaultProjDir, 'backups');
    if (fs.existsSync(legacyBackups)) {
      if (!fs.existsSync(targetBackups)) {
        fs.mkdirSync(targetBackups, { recursive: true });
      }
      try {
        const files = fs.readdirSync(legacyBackups);
        files.forEach((f) => {
          fs.copyFileSync(path.join(legacyBackups, f), path.join(targetBackups, f));
        });
      } catch (e) {
        console.warn('Backup copy error:', e);
      }
    }

    const now = new Date().toISOString();
    const defaultMeta = {
      id: defaultProjectId,
      name: '以太纪元 · 崩塌圣座',
      description: '默认小说剧本企划（包含世界地图与设定资料库）',
      createdAt: now,
      updatedAt: now
    };

    fs.writeFileSync(path.join(defaultProjDir, 'project.json'), JSON.stringify(defaultMeta, null, 2), 'utf-8');

    registry = {
      activeProjectId: defaultProjectId,
      projects: [defaultMeta]
    };
    saveProjectsRegistry(registry);
    console.log('✅ 数据平移完成，默认企划已成功初始化！');
  }

  if (!registry.activeProjectId || !registry.projects.find((p) => p.id === registry.activeProjectId)) {
    registry.activeProjectId = registry.projects[0]?.id || 'default';
    saveProjectsRegistry(registry);
  }

  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), 'utf-8');
  }

  return registry;
}

// Initialize registry & migration on startup
migrateAndInitProjects();

function getActiveProjectId() {
  const registry = getProjectsRegistry() || migrateAndInitProjects();
  return registry.activeProjectId || registry.projects[0]?.id || 'default';
}

function getProjectDir(projectId) {
  const pid = projectId || getActiveProjectId();
  const dir = path.join(PROJECTS_DIR, pid);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getProjectFilePath(filename, projectId = null) {
  const dir = getProjectDir(projectId);
  return path.join(dir, filename);
}

function getProjectBackupsDir(projectId = null) {
  const dir = path.join(getProjectDir(projectId), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function touchProjectUpdated(projectId = null) {
  const pid = projectId || getActiveProjectId();
  const now = new Date().toISOString();
  const registry = getProjectsRegistry();
  if (registry) {
    const p = registry.projects.find((x) => x.id === pid);
    if (p) {
      p.updatedAt = now;
      saveProjectsRegistry(registry);
    }
  }
  const metaFile = getProjectFilePath('project.json', pid);
  if (fs.existsSync(metaFile)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      meta.updatedAt = now;
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {}
  }
}

function getProjectSummary(pMeta) {
  const pid = pMeta.id;
  const dir = getProjectDir(pid);
  let nodeCount = 0;
  let entryCount = 0;
  let epochCount = 0;

  try {
    const storyFile = path.join(dir, 'story_graph.json');
    if (fs.existsSync(storyFile)) {
      const data = JSON.parse(fs.readFileSync(storyFile, 'utf-8'));
      nodeCount = (data.nodes || []).length;
    }
  } catch {}

  try {
    const dbFile = path.join(dir, 'database.json');
    if (fs.existsSync(dbFile)) {
      const data = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
      entryCount = (data.entries || []).length;
    }
  } catch {}

  try {
    const mapFile = path.join(dir, 'map_data.json');
    if (fs.existsSync(mapFile)) {
      const data = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
      epochCount = (data.epochs || []).length;
    }
  } catch {}

  return {
    ...pMeta,
    nodeCount,
    entryCount,
    epochCount
  };
}

// Rolling backup helpers for project
function backupStory(projectId = null) {
  try {
    const storyFile = getProjectFilePath('story_graph.json', projectId);
    const backupsDir = getProjectBackupsDir(projectId);
    if (fs.existsSync(storyFile)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `story_graph_${timestamp}.json`);
      fs.copyFileSync(storyFile, backupPath);

      const files = fs
        .readdirSync(backupsDir)
        .filter((f) => f.startsWith('story_graph_') && f.endsWith('.json'))
        .map((f) => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 20) {
        files.slice(20).forEach((f) => {
          try {
            fs.unlinkSync(path.join(backupsDir, f.name));
          } catch (e) {}
        });
      }
    }
  } catch (err) {
    console.error('Backup story error:', err);
  }
}

function backupDatabase(projectId = null) {
  try {
    const dbFile = getProjectFilePath('database.json', projectId);
    const backupsDir = getProjectBackupsDir(projectId);
    if (fs.existsSync(dbFile)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `database_${timestamp}.json`);
      fs.copyFileSync(dbFile, backupPath);

      const files = fs
        .readdirSync(backupsDir)
        .filter((f) => f.startsWith('database_') && f.endsWith('.json'))
        .map((f) => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 20) {
        files.slice(20).forEach((f) => {
          try {
            fs.unlinkSync(path.join(backupsDir, f.name));
          } catch (e) {}
        });
      }
    }
  } catch (err) {
    console.error('Backup database error:', err);
  }
}

// Multer storage for images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, IMAGES_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (!file.originalname.match(allowed)) {
      return cb(new Error('只允许上传图片文件 (jpg, png, gif, webp, svg)'), false);
    }
    cb(null, true);
  }
});

// ---------------------------------------------------------------------------
// API Routes: Project Management
// ---------------------------------------------------------------------------

// 1. List all projects
app.get('/api/projects', (req, res) => {
  try {
    const registry = migrateAndInitProjects();
    const summaries = registry.projects.map((p) => getProjectSummary(p));
    res.json({
      success: true,
      activeProjectId: registry.activeProjectId,
      projects: summaries
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Create new project
app.post('/api/projects', (req, res) => {
  try {
    const { name, description, template } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: '企划名称不能为空' });
    }

    const registry = migrateAndInitProjects();
    const newId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newDir = path.join(PROJECTS_DIR, newId);
    fs.mkdirSync(newDir, { recursive: true });

    const now = new Date().toISOString();
    const meta = {
      id: newId,
      name: name.trim(),
      description: (description || '').trim(),
      createdAt: now,
      updatedAt: now
    };

    fs.writeFileSync(path.join(newDir, 'project.json'), JSON.stringify(meta, null, 2), 'utf-8');

    if (template === 'default') {
      fs.writeFileSync(path.join(newDir, 'story_graph.json'), JSON.stringify(defaultStory, null, 2), 'utf-8');
      fs.writeFileSync(path.join(newDir, 'characters.json'), JSON.stringify(defaultCharacters, null, 2), 'utf-8');
      fs.writeFileSync(path.join(newDir, 'world_lore.md'), defaultWorldLore, 'utf-8');
      fs.writeFileSync(
        path.join(newDir, 'database.json'),
        JSON.stringify(
          {
            categories: [
              { id: 'characters', name: '人物档案', icon: 'Users', description: '登场角色及好感度记录', isCharacterType: true },
              { id: 'world', name: '地理与势力', icon: 'Globe', description: '国家、城邦与地缘势力' },
              { id: 'lore', name: '世界观设定', icon: 'BookOpen', description: '历史源流、能量体系与禁忌' },
              { id: 'events', name: '历史纪事', icon: 'Clock', description: '时空变迁、战役与关键转折', isEventType: true }
            ],
            entries: []
          },
          null,
          2
        ),
        'utf-8'
      );
      fs.writeFileSync(path.join(newDir, 'map_data.json'), JSON.stringify(defaultMapData, null, 2), 'utf-8');
    } else {
      fs.writeFileSync(path.join(newDir, 'story_graph.json'), JSON.stringify({ nodes: [], edges: [] }, null, 2), 'utf-8');
      fs.writeFileSync(path.join(newDir, 'characters.json'), JSON.stringify([], null, 2), 'utf-8');
      fs.writeFileSync(
        path.join(newDir, 'world_lore.md'),
        `# ${meta.name} · 世界观设定\n\n在此记录该企划的核心世界观、势力设定与故事规则...\n`,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(newDir, 'database.json'),
        JSON.stringify(
          {
            categories: [
              { id: 'characters', name: '人物档案', icon: 'Users', description: '登场角色及好感度记录', isCharacterType: true },
              { id: 'factions', name: '势力阵营', icon: 'Shield', description: '组织、派系与国家地缘' },
              { id: 'world', name: '地理据点', icon: 'Globe', description: '大陆、板块与秘境据点' },
              { id: 'items', name: '宝物道具', icon: 'Sparkles', description: '神秘圣遗物、兵刃与法器' },
              { id: 'events', name: '历史纪事', icon: 'Clock', description: '重大历史战役与时空纪事', isEventType: true }
            ],
            entries: []
          },
          null,
          2
        ),
        'utf-8'
      );
      fs.writeFileSync(path.join(newDir, 'map_data.json'), JSON.stringify(defaultMapData, null, 2), 'utf-8');
    }

    registry.projects.push(meta);
    registry.activeProjectId = newId;
    saveProjectsRegistry(registry);

    res.json({
      success: true,
      project: getProjectSummary(meta),
      activeProjectId: newId,
      message: `企划「${meta.name}」创建成功`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Switch active project
app.post('/api/projects/switch', (req, res) => {
  try {
    const { projectId } = req.body;
    const registry = migrateAndInitProjects();
    const target = registry.projects.find((p) => p.id === projectId);
    if (!target) {
      return res.status(404).json({ success: false, error: '指定企划不存在' });
    }
    registry.activeProjectId = projectId;
    saveProjectsRegistry(registry);
    res.json({
      success: true,
      activeProjectId: projectId,
      project: getProjectSummary(target),
      message: `已切换至企划「${target.name}」`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update project metadata
app.put('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const registry = migrateAndInitProjects();
    const p = registry.projects.find((x) => x.id === id);
    if (!p) {
      return res.status(404).json({ success: false, error: '企划不存在' });
    }
    if (name && name.trim()) p.name = name.trim();
    if (description !== undefined) p.description = description.trim();
    p.updatedAt = new Date().toISOString();

    saveProjectsRegistry(registry);

    const metaFile = path.join(getProjectDir(id), 'project.json');
    if (fs.existsSync(metaFile)) {
      fs.writeFileSync(metaFile, JSON.stringify(p, null, 2), 'utf-8');
    }

    res.json({ success: true, project: getProjectSummary(p) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Duplicate project
app.post('/api/projects/:id/duplicate', (req, res) => {
  try {
    const { id } = req.params;
    const registry = migrateAndInitProjects();
    const sourceMeta = registry.projects.find((p) => p.id === id);
    if (!sourceMeta) {
      return res.status(404).json({ success: false, error: '源企划不存在' });
    }

    const srcDir = getProjectDir(id);
    const newId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newDir = path.join(PROJECTS_DIR, newId);
    fs.mkdirSync(newDir, { recursive: true });

    // Copy all project files
    const files = fs.readdirSync(srcDir);
    files.forEach((f) => {
      const srcPath = path.join(srcDir, f);
      const destPath = path.join(newDir, f);
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    });

    const now = new Date().toISOString();
    const newMeta = {
      id: newId,
      name: `${sourceMeta.name} (副本)`,
      description: sourceMeta.description || '',
      createdAt: now,
      updatedAt: now
    };

    fs.writeFileSync(path.join(newDir, 'project.json'), JSON.stringify(newMeta, null, 2), 'utf-8');

    registry.projects.push(newMeta);
    saveProjectsRegistry(registry);

    res.json({
      success: true,
      project: getProjectSummary(newMeta),
      message: `已成功复制企划「${newMeta.name}」`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete project
app.delete('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const registry = migrateAndInitProjects();

    if (registry.projects.length <= 1) {
      return res.status(400).json({ success: false, error: '不能删除最后一个企划' });
    }

    const idx = registry.projects.findIndex((p) => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: '企划不存在' });
    }

    registry.projects.splice(idx, 1);

    let switched = false;
    if (registry.activeProjectId === id) {
      registry.activeProjectId = registry.projects[0].id;
      switched = true;
    }
    saveProjectsRegistry(registry);

    const dir = path.join(PROJECTS_DIR, id);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        console.warn('Failed to delete project directory:', dir, err);
      }
    }

    res.json({
      success: true,
      activeProjectId: registry.activeProjectId,
      switched,
      message: '企划已成功删除'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes: Project Data Read & Write
// ---------------------------------------------------------------------------

// Get full project data
app.get('/api/project', (req, res) => {
  try {
    const registry = migrateAndInitProjects();
    const reqPid = req.query.projectId;
    const activePid = reqPid && registry.projects.some((p) => p.id === reqPid)
      ? reqPid
      : registry.activeProjectId;

    if (reqPid && reqPid !== registry.activeProjectId && registry.projects.some((p) => p.id === reqPid)) {
      registry.activeProjectId = reqPid;
      saveProjectsRegistry(registry);
    }

    const pMeta = registry.projects.find((p) => p.id === activePid) || registry.projects[0];
    const storyFile = getProjectFilePath('story_graph.json', activePid);
    const charsFile = getProjectFilePath('characters.json', activePid);
    const worldFile = getProjectFilePath('world_lore.md', activePid);
    const dbFile = getProjectFilePath('database.json', activePid);
    const mapFile = getProjectFilePath('map_data.json', activePid);

    const story = fs.existsSync(storyFile) ? JSON.parse(fs.readFileSync(storyFile, 'utf-8')) : defaultStory;
    const characters = fs.existsSync(charsFile) ? JSON.parse(fs.readFileSync(charsFile, 'utf-8')) : defaultCharacters;
    const worldLore = fs.existsSync(worldFile) ? fs.readFileSync(worldFile, 'utf-8') : defaultWorldLore;
    const database = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf-8')) : { categories: [], entries: [] };
    const mapData = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf-8')) : defaultMapData;

    const settings = fs.existsSync(SETTINGS_FILE)
      ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
      : defaultSettings;

    res.json({
      success: true,
      project: getProjectSummary(pMeta),
      activeProjectId: activePid,
      story,
      characters,
      worldLore,
      settings,
      database,
      mapData
    });
  } catch (err) {
    console.error('Error reading project:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Database routes
app.get('/api/database', (req, res) => {
  try {
    const pid = req.query.projectId || getActiveProjectId();
    const dbFile = getProjectFilePath('database.json', pid);
    if (!fs.existsSync(dbFile)) {
      return res.json({ success: true, database: { categories: [], entries: [] } });
    }
    const database = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    res.json({ success: true, database });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/database', (req, res) => {
  try {
    const pid = req.query.projectId || req.body.projectId || getActiveProjectId();
    const database = req.body.database || req.body;
    backupDatabase(pid);

    const dbFile = getProjectFilePath('database.json', pid);
    fs.writeFileSync(dbFile, JSON.stringify(database, null, 2), 'utf-8');

    // Synchronize characters for backward compatibility
    const charCategory = (database.categories || []).find((c) => c.isCharacterType || c.id === 'characters');
    if (charCategory) {
      const charEntries = (database.entries || [])
        .filter((e) => e.categoryId === charCategory.id)
        .map((e) => ({
          id: e.id,
          name: e.name || e.title,
          role: e.role || '',
          bio: e.bio || e.content || e.summary || '',
          avatar: e.avatar || e.image || '',
          color: e.color || '#38bdf8',
          initialAffection: e.initialAffection ?? 50
        }));
      fs.writeFileSync(getProjectFilePath('characters.json', pid), JSON.stringify(charEntries, null, 2), 'utf-8');
    }

    touchProjectUpdated(pid);
    res.json({ success: true, message: '资料库保存成功', timestamp: new Date() });
  } catch (err) {
    console.error('Error saving database:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Map and Timeline routes
app.get('/api/map', (req, res) => {
  try {
    const pid = req.query.projectId || getActiveProjectId();
    const mapFile = getProjectFilePath('map_data.json', pid);
    const mapData = fs.existsSync(mapFile)
      ? JSON.parse(fs.readFileSync(mapFile, 'utf-8'))
      : defaultMapData;
    res.json({ success: true, mapData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/map', (req, res) => {
  try {
    const pid = req.query.projectId || req.body.projectId || getActiveProjectId();
    const mapData = req.body.mapData || req.body;
    const mapFile = getProjectFilePath('map_data.json', pid);
    fs.writeFileSync(mapFile, JSON.stringify(mapData, null, 2), 'utf-8');

    touchProjectUpdated(pid);
    res.json({ success: true, message: '地图与时间轴数据保存成功' });
  } catch (err) {
    console.error('Error saving map data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save story graph with backup
app.post('/api/story', (req, res) => {
  try {
    const pid = req.query.projectId || req.body.projectId || getActiveProjectId();
    const { nodes, edges } = req.body;
    if (!nodes || !edges) {
      return res.status(400).json({ success: false, error: '缺少 nodes 或 edges' });
    }

    backupStory(pid);
    const storyFile = getProjectFilePath('story_graph.json', pid);
    fs.writeFileSync(storyFile, JSON.stringify({ nodes, edges }, null, 2), 'utf-8');

    touchProjectUpdated(pid);
    res.json({ success: true, message: '故事图谱保存成功', timestamp: new Date() });
  } catch (err) {
    console.error('Error saving story:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save characters
app.post('/api/characters', (req, res) => {
  try {
    const pid = req.query.projectId || req.body.projectId || getActiveProjectId();
    const characters = req.body;
    fs.writeFileSync(getProjectFilePath('characters.json', pid), JSON.stringify(characters, null, 2), 'utf-8');

    touchProjectUpdated(pid);
    res.json({ success: true, message: '角色设定保存成功' });
  } catch (err) {
    console.error('Error saving characters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save world lore
app.post('/api/world', (req, res) => {
  try {
    const pid = req.query.projectId || req.body.projectId || getActiveProjectId();
    const { content } = req.body;
    fs.writeFileSync(getProjectFilePath('world_lore.md', pid), content, 'utf-8');

    touchProjectUpdated(pid);
    res.json({ success: true, message: '世界观设定保存成功' });
  } catch (err) {
    console.error('Error saving world lore:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global settings
app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    res.json({ success: true, message: '系统设置保存成功' });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未接收到图片' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. AI generation proxy
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));

    if (!settings.apiKey) {
      return res.status(400).json({
        success: false,
        error: '请先在顶部【⚙️ AI设置】中配置 API Key（如 DeepSeek 或 OpenAI 兼容 Key）'
      });
    }

    const baseUrl = (settings.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: settings.temperature || 0.7,
        messages: [
          { role: 'system', content: systemPrompt || '你是一位专业的游戏叙事策划与互动小说编剧。' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `AI 接口返回错误 (${response.status}): ${errText}`
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    res.json({ success: true, reply });
  } catch (err) {
    console.error('AI generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 8. Story Copilot (Antigravity Agent Integration)
// ---------------------------------------------------------------------------

function getCopilotSessionsFile(projectId = null) {
  const pDir = getProjectDir(projectId);
  return path.join(pDir, 'copilot_sessions.json');
}

function getCopilotSessionsData(projectId = null) {
  const file = getCopilotSessionsFile(projectId);
  if (!fs.existsSync(file)) {
    return { activeSessionId: null, sessions: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return { activeSessionId: null, sessions: [] };
  }
}

function saveCopilotSessionsData(data, projectId = null) {
  const file = getCopilotSessionsFile(projectId);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// 8.1 List all sessions for project
app.get('/api/copilot/sessions', (req, res) => {
  try {
    const pid = req.query.projectId || getActiveProjectId();
    const data = getCopilotSessionsData(pid);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.2 Create new session
app.post('/api/copilot/sessions', (req, res) => {
  try {
    const pid = req.body.projectId || getActiveProjectId();
    const title = (req.body.title || '新剧情推演会话').trim();
    const data = getCopilotSessionsData(pid);

    const now = new Date().toISOString();
    const newSession = {
      id: `session-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      conversationId: null,
      createdAt: now,
      updatedAt: now,
      messages: []
    };

    data.sessions.unshift(newSession);
    data.activeSessionId = newSession.id;
    saveCopilotSessionsData(data, pid);

    res.json({ success: true, session: newSession, activeSessionId: newSession.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.3 Switch active session
app.post('/api/copilot/sessions/switch', (req, res) => {
  try {
    const pid = req.body.projectId || getActiveProjectId();
    const { sessionId } = req.body;
    const data = getCopilotSessionsData(pid);
    if (data.sessions.some((s) => s.id === sessionId)) {
      data.activeSessionId = sessionId;
      saveCopilotSessionsData(data, pid);
    }
    res.json({ success: true, activeSessionId: data.activeSessionId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.4 Delete session
app.delete('/api/copilot/sessions/:id', (req, res) => {
  try {
    const pid = req.query.projectId || getActiveProjectId();
    const { id } = req.params;
    const data = getCopilotSessionsData(pid);

    data.sessions = data.sessions.filter((s) => s.id !== id);
    if (data.activeSessionId === id) {
      data.activeSessionId = data.sessions[0]?.id || null;
    }
    saveCopilotSessionsData(data, pid);

    res.json({ success: true, activeSessionId: data.activeSessionId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.5 Send message to Copilot (via Antigravity agentapi)
app.post('/api/copilot/chat', async (req, res) => {
  try {
    const pid = req.body.projectId || getActiveProjectId();
    let { sessionId, prompt, model, contextEntities } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: '提示词不能为空' });
    }

    const data = getCopilotSessionsData(pid);
    let session = data.sessions.find((s) => s.id === sessionId);

    if (!session) {
      const now = new Date().toISOString();
      session = {
        id: `session-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        title: prompt.trim().substring(0, 20) || '新剧情推演',
        conversationId: null,
        createdAt: now,
        updatedAt: now,
        messages: []
      };
      data.sessions.unshift(session);
      data.activeSessionId = session.id;
    }

    // Build context description
    let contextBlock = '';
    if (Array.isArray(contextEntities) && contextEntities.length > 0) {
      contextBlock += '\n【用户注入的当前创作实体上下文】：\n';
      contextEntities.forEach((entity, idx) => {
        if (entity.type === 'node') {
          contextBlock += `\n[注入节点 ${idx + 1}] 编号: ${entity.code || entity.id}, 标题: ${entity.title}\n`;
          if (entity.summary) contextBlock += `梗概: ${entity.summary}\n`;
          if (entity.content) contextBlock += `正文: ${entity.content}\n`;
          if (Array.isArray(entity.characters) && entity.characters.length > 0) {
            contextBlock += `登场角色ID: ${entity.characters.join(', ')}\n`;
          }
        } else if (entity.type === 'character' || entity.type === 'entry') {
          contextBlock += `\n[注入资料卡片 ${idx + 1}] 名称: ${entity.name || entity.title}, 身份: ${entity.role || '无'}\n`;
          if (entity.summary || entity.bio) contextBlock += `背景生平: ${entity.summary || entity.bio}\n`;
          if (entity.initialAffection !== undefined) contextBlock += `当前好感度: ${entity.initialAffection}\n`;
        } else if (entity.type === 'location') {
          contextBlock += `\n[注入地图地点 ${idx + 1}] 名称: ${entity.name}, 坐标: (${entity.lat}, ${entity.lng})\n`;
          if (entity.description) contextBlock += `描述: ${entity.description}\n`;
        } else if (entity.type === 'event') {
          contextBlock += `\n[注入历史纪事 ${idx + 1}] 年份: ${entity.year}, 标题: ${entity.title}\n`;
          if (entity.description) contextBlock += `描述: ${entity.description}\n`;
        }
      });
    }

    const instructionsBlock = `
你是一位专业的游戏叙事策划与互动小说副驾驶 (Story Copilot)。
请结合用户提供的上述上下文实体进行深度剧情推演、对白润色或设定设计。

【工程修改指令规则】：
如果你在推演中需要向故事图谱中创建新分支、修改节点或新增资料库条目，请直接调用 easystory MCP 工具（如 story_create_branch），或在回复末尾附带如下格式的标准动作块，前端会自动将其应用到画布中：
\`\`\`json:action
{
  "action": "story_create_branch",
  "params": {
    "parentNodeId": "<父节点ID>",
    "title": "<分支标题>",
    "summary": "<剧情梗概与关键走向>",
    "condition": "<分支触发条件，如 好感度 < 30 或 武力 >= 12>"
  }
}
\`\`\`
请给出引人入胜的剧情构思与精彩的对白。
`;

    const fullPrompt = `${contextBlock}\n【用户创作需求】：\n${prompt.trim()}\n${instructionsBlock}`;

    // Append user message
    const userMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: prompt.trim(),
      injectedEntities: contextEntities || [],
      timestamp: new Date().toISOString()
    };
    session.messages.push(userMsg);
    session.updatedAt = new Date().toISOString();
    saveCopilotSessionsData(data, pid);

    if (model) {
      session.model = model;
    }

    // Call agentapi
    const isNew = !session.conversationId;
    let modelArg = [];
    if (isNew) {
      if (model && model !== 'inherit' && model !== 'default') {
        modelArg = [`--model=${model}`];
      }
    }
    const args = isNew
      ? ['agentapi', 'new-conversation', ...modelArg, `--title=${session.title}`, fullPrompt]
      : ['agentapi', 'send-message', session.conversationId, fullPrompt];

    const child = spawn(AGENTAPI_EXE, args, {
      cwd: path.resolve(__dirname),
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0 && isNew) {
        try {
          const resJson = JSON.parse(stdout.trim());
          const cid = resJson.response?.newConversation?.conversationId;
          if (cid) {
            session.conversationId = cid;
            saveCopilotSessionsData(data, pid);
          }
        } catch (e) {
          console.error('Failed to parse new conversation output:', e, stdout);
        }
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      conversationId: session.conversationId,
      message: 'Agent 已启动思考推演'
    });
  } catch (err) {
    console.error('Copilot chat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.6 Poll conversation response from Antigravity transcript
app.get('/api/copilot/poll', (req, res) => {
  try {
    const pid = req.query.projectId || getActiveProjectId();
    const { sessionId } = req.query;
    let { conversationId } = req.query;

    const data = getCopilotSessionsData(pid);
    const session = data.sessions.find((s) => s.id === sessionId);

    if (!conversationId && session?.conversationId) {
      conversationId = session.conversationId;
    }

    if (!conversationId) {
      return res.json({ success: true, isDone: false, message: '等待会话初始化...' });
    }

    const logFile = path.join(GEMINI_BRAIN_DIR, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(logFile)) {
      return res.json({ success: true, isDone: false, conversationId });
    }

    const fileContent = fs.readFileSync(logFile, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(Boolean);
    const steps = [];

    for (const line of lines) {
      try {
        steps.push(JSON.parse(line));
      } catch {}
    }

    const plannerSteps = steps.filter((s) => s.type === 'PLANNER_RESPONSE');
    const latestStep = plannerSteps[plannerSteps.length - 1];

    if (!latestStep) {
      return res.json({ success: true, isDone: false, conversationId });
    }

    const isDone = latestStep.status === 'DONE';
    const content = latestStep.content || '';
    const thinking = latestStep.thinking || '';
    const toolCalls = latestStep.tool_calls || [];

    // Detect action blocks in content
    const actions = [];
    const actionRegex = /```json:action\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = actionRegex.exec(content)) !== null) {
      try {
        const act = JSON.parse(match[1]);
        if (act && act.action) actions.push(act);
      } catch {}
    }

    // If done and message not recorded in session, record it
    if (isDone && session) {
      const lastMsg = session.messages[session.messages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        const assistantMsg = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          role: 'assistant',
          content,
          thinking,
          toolCalls,
          actions,
          model: session.model || 'flash',
          timestamp: new Date().toISOString()
        };
        session.messages.push(assistantMsg);
        session.updatedAt = new Date().toISOString();
        saveCopilotSessionsData(data, pid);
      }
    }

    res.json({
      success: true,
      isDone,
      conversationId,
      content,
      thinking,
      actions,
      toolCalls
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.7 Direct tool execution endpoint for Copilot actions
app.post('/api/copilot/tools/execute', (req, res) => {
  try {
    const pid = req.body.projectId || getActiveProjectId();
    const action = req.body.action || req.body.tool;
    const params = req.body.params || req.body.args || {};
    let result = null;

    if (action === 'story_create_branch') {
      result = handleCreateBranch({ ...params, projectId: pid });
    } else if (action === 'story_update_node') {
      result = handleUpdateNode({ ...params, projectId: pid });
    } else if (action === 'database_add_entry') {
      result = handleAddDatabaseEntry({ ...params, projectId: pid });
    } else if (action === 'map_add_location') {
      result = handleAddMapLocation({ ...params, projectId: pid });
    } else {
      return res.status(400).json({ success: false, error: `不支持的动作: ${action}` });
    }

    touchProjectUpdated(pid);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Copilot tool execute error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.8 List available Antigravity models
app.get('/api/copilot/models', (req, res) => {
  const models = [
    {
      id: 'flash',
      name: 'Gemini 3.8 Flash (High)',
      shortName: 'Gemini 3.8 Flash',
      tag: '极速推演 · 推荐',
      description: 'Google 原生主力极速模型 · 响应极其迅速，长文本理解优秀，适合日常主线剧情推演与即兴创作。',
      isDefault: true
    },
    {
      id: 'pro',
      name: 'Gemini 3.8 Pro',
      shortName: 'Gemini 3.8 Pro',
      tag: '深度思考 · 强逻辑',
      description: 'Google 原生旗舰深度思考模型 · 具备强劲思维链，适合复杂分支架构、长线伏笔与严密设定推演。'
    },
    {
      id: 'flash_lite',
      name: 'Gemini 3.8 Flash-Lite',
      shortName: 'Gemini 3.8 Flash-Lite',
      tag: '超低延迟 · 极速',
      description: 'Google 原生轻量模型 · 极低响应延迟，适合快速对白润色、局部修辞润色与语法打磨。'
    },
    {
      id: 'inherit',
      name: '跟随 Antigravity 全局配置',
      shortName: '系统默认 (Inherit)',
      tag: '跟随主程序',
      description: '自动同步您当前在 Antigravity 客户端设置中所选的全局活跃模型（当前为 Gemini 3.8 Flash (High)）。'
    }
  ];
  res.json({ success: true, models });
});

app.listen(PORT, () => {
  console.log(`StoryFlow 本地数据服务已在端口 ${PORT} 启动 (http://localhost:${PORT})`);
});

