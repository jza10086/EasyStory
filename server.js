const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

[DATA_DIR, IMAGES_DIR, BACKUPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(IMAGES_DIR));

// File paths
const STORY_FILE = path.join(DATA_DIR, 'story_graph.json');
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');
const WORLD_FILE = path.join(DATA_DIR, 'world_lore.md');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DATABASE_FILE = path.join(DATA_DIR, 'database.json');
const MAP_FILE = path.join(DATA_DIR, 'map_data.json');

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

// Initialize default files if missing
function initFiles() {
  if (!fs.existsSync(STORY_FILE)) {
    fs.writeFileSync(STORY_FILE, JSON.stringify(defaultStory, null, 2), 'utf-8');
  }
  if (!fs.existsSync(CHARACTERS_FILE)) {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(defaultCharacters, null, 2), 'utf-8');
  }
  if (!fs.existsSync(WORLD_FILE)) {
    fs.writeFileSync(WORLD_FILE, defaultWorldLore, 'utf-8');
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), 'utf-8');
  }
  if (!fs.existsSync(MAP_FILE)) {
    fs.writeFileSync(MAP_FILE, JSON.stringify(defaultMapData, null, 2), 'utf-8');
  }
}

initFiles();

// Helper to create rolling backup of story
function backupStory() {
  try {
    if (fs.existsSync(STORY_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUPS_DIR, `story_graph_${timestamp}.json`);
      fs.copyFileSync(STORY_FILE, backupPath);

      // Keep only latest 20 backups
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith('story_graph_') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 20) {
        files.slice(20).forEach(f => {
          try { fs.unlinkSync(path.join(BACKUPS_DIR, f.name)); } catch (e) {}
        });
      }
    }
  } catch (err) {
    console.error('Backup error:', err);
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

// API Routes

// Helper to backup database
function backupDatabase() {
  try {
    if (fs.existsSync(DATABASE_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUPS_DIR, `database_${timestamp}.json`);
      fs.copyFileSync(DATABASE_FILE, backupPath);

      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith('database_') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 20) {
        files.slice(20).forEach(f => {
          try { fs.unlinkSync(path.join(BACKUPS_DIR, f.name)); } catch (e) {}
        });
      }
    }
  } catch (err) {
    console.error('Backup database error:', err);
  }
}

// 1. Get full project
app.get('/api/project', (req, res) => {
  try {
    initFiles();
    const story = JSON.parse(fs.readFileSync(STORY_FILE, 'utf-8'));
    const characters = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf-8'));
    const worldLore = fs.readFileSync(WORLD_FILE, 'utf-8');
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    const database = fs.existsSync(DATABASE_FILE)
      ? JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'))
      : { categories: [], entries: [] };
    const mapData = fs.existsSync(MAP_FILE)
      ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'))
      : defaultMapData;

    res.json({
      success: true,
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

// 1.1 Database routes
app.get('/api/database', (req, res) => {
  try {
    if (!fs.existsSync(DATABASE_FILE)) {
      return res.json({ success: true, database: { categories: [], entries: [] } });
    }
    const database = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'));
    res.json({ success: true, database });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1.2 Map and Timeline routes
app.get('/api/map', (req, res) => {
  try {
    const mapData = fs.existsSync(MAP_FILE)
      ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'))
      : defaultMapData;
    res.json({ success: true, mapData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/map', (req, res) => {
  try {
    const mapData = req.body;
    fs.writeFileSync(MAP_FILE, JSON.stringify(mapData, null, 2), 'utf-8');
    res.json({ success: true, message: '地图与时间轴数据保存成功' });
  } catch (err) {
    console.error('Error saving map data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/database', (req, res) => {
  try {
    const database = req.body;
    backupDatabase();
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(database, null, 2), 'utf-8');

    // Synchronize characters for backward compatibility
    const charCategory = (database.categories || []).find(c => c.isCharacterType || c.id === 'characters');
    if (charCategory) {
      const charEntries = (database.entries || [])
        .filter(e => e.categoryId === charCategory.id)
        .map(e => ({
          id: e.id,
          name: e.name || e.title,
          role: e.role || '',
          bio: e.bio || e.content || e.summary || '',
          avatar: e.avatar || e.image || '',
          color: e.color || '#38bdf8',
          initialAffection: e.initialAffection ?? 50
        }));
      fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(charEntries, null, 2), 'utf-8');
    }

    res.json({ success: true, message: '资料库保存成功', timestamp: new Date() });
  } catch (err) {
    console.error('Error saving database:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save story graph with backup
app.post('/api/story', (req, res) => {
  try {
    const { nodes, edges } = req.body;
    if (!nodes || !edges) {
      return res.status(400).json({ success: false, error: '缺少 nodes 或 edges' });
    }

    backupStory();
    fs.writeFileSync(STORY_FILE, JSON.stringify({ nodes, edges }, null, 2), 'utf-8');
    res.json({ success: true, message: '故事图谱保存成功', timestamp: new Date() });
  } catch (err) {
    console.error('Error saving story:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Save characters
app.post('/api/characters', (req, res) => {
  try {
    const characters = req.body;
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(characters, null, 2), 'utf-8');
    res.json({ success: true, message: '角色设定保存成功' });
  } catch (err) {
    console.error('Error saving characters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Save world lore
app.post('/api/world', (req, res) => {
  try {
    const { content } = req.body;
    fs.writeFileSync(WORLD_FILE, content, 'utf-8');
    res.json({ success: true, message: '世界观设定保存成功' });
  } catch (err) {
    console.error('Error saving world lore:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Save settings
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

app.listen(PORT, () => {
  console.log(`StoryFlow 本地数据服务已在端口 ${PORT} 启动 (http://localhost:${PORT})`);
});
