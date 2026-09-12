import React, { useState } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { X, Download, Copy, Check, FileText, Code2 } from 'lucide-react';

export default function ExportModal() {
  const activeModal = useStoryStore((s) => s.activeModal);
  const setActiveModal = useStoryStore((s) => s.setActiveModal);
  const nodes = useStoryStore((s) => s.nodes);
  const edges = useStoryStore((s) => s.edges);
  const characters = useStoryStore((s) => s.characters);
  const worldLore = useStoryStore((s) => s.worldLore);

  const [format, setFormat] = useState('markdown'); // 'markdown' | 'json'
  const [copied, setCopied] = useState(false);

  if (activeModal !== 'export') return null;

  // Generate Markdown export
  const generateMarkdown = () => {
    let md = `# 游戏多分支剧本大纲总览\n\n`;
    md += `> 导出时间：${new Date().toLocaleString()} | 节点总数：${nodes.length}\n\n`;

    md += `## 一、核心世界观设定\n\n${worldLore || '*暂无*'}\n\n---\n\n`;

    md += `## 二、登场人物设定\n\n`;
    characters.forEach((c) => {
      md += `### 👤 ${c.name} (${c.role || '无'})\n`;
      md += `- **初始好感度**：${c.initialAffection}\n`;
      md += `- **人物背景与性格**：${c.bio || '无'}\n\n`;
    });
    md += `---\n\n`;

    md += `## 三、全剧情分支脉络\n\n`;
    nodes.forEach((n) => {
      const charNames = characters
        .filter((c) => (n.data.characters || []).includes(c.id))
        .map((c) => c.name)
        .join('、');

      const outbound = edges.filter((e) => e.source === n.id);

      md += `### [节点 ${n.data.code}] ${n.data.title}\n`;
      if (n.data.endingType && n.data.endingType !== 'none') {
        md += `> 🚩 **结局标识**：${n.data.endingType === 'true' ? '真结局' : n.data.endingType === 'bad' ? '坏结局' : '普通结局'}\n\n`;
      }
      md += `**场景梗概 (Summary)**：\n\n${n.data.summary || '*无*'}\n\n`;

      if (charNames) {
        md += `**登场人物**：${charNames}\n\n`;
        // Character statuses
        const statuses = (n.data.characters || []).map((cid) => {
          const c = characters.find((char) => char.id === cid);
          const st = n.data.characterStatuses?.[cid];
          return st && c ? `- **${c.name}** 状态: \`${st}\`` : null;
        }).filter(Boolean);
        if (statuses.length > 0) {
          md += `**角色当前状态**：\n${statuses.join('\n')}\n\n`;
        }
      }

      if (n.data.dialogueList && n.data.dialogueList.length > 0) {
        md += `**剧本对白与场记**：\n\n`;
        n.data.dialogueList.forEach((beat) => {
          const sp = beat.speakerId === 'narrator'
            ? '【背景旁白】'
            : (characters.find((c) => c.id === beat.speakerId)?.name || beat.speakerId);
          const state = beat.speakerState ? ` *(${beat.speakerState})*` : '';
          md += `- **${sp}**${state}: ${beat.text}\n`;
        });
        md += `\n`;
      } else if (n.data.content) {
        md += `**正文内容**：\n\n${n.data.content}\n\n`;
      }

      if (outbound.length > 0) {
        md += `**后续分支与触发条件**：\n`;
        outbound.forEach((edge) => {
          const target = nodes.find((node) => node.id === edge.target);
          md += `- ➡️ 通向 [${target?.data?.code || '?'}] ${target?.data?.title || '未命名'} | 条件: \`${edge.data?.condition || '默认'}\`\n`;
        });
      } else {
        md += `*（此分支终结）*\n`;
      }
      md += `\n---\n\n`;
    });

    return md;
  };

  const exportText = format === 'markdown' ? generateMarkdown() : JSON.stringify({ nodes, edges, characters, worldLore }, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([exportText], { type: format === 'markdown' ? 'text/markdown' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'markdown' ? `StoryFlow_Script_${Date.now()}.md` : `StoryFlow_Data_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[850px] h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">导出剧本文档与数据</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs mr-2">
              <button
                onClick={() => setFormat('markdown')}
                className={`flex items-center gap-1 px-3 py-1 rounded ${format === 'markdown' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400'}`}
              >
                <FileText className="w-3.5 h-3.5" /> Markdown 文档
              </button>
              <button
                onClick={() => setFormat('json')}
                className={`flex items-center gap-1 px-3 py-1 rounded ${format === 'json' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400'}`}
              >
                <Code2 className="w-3.5 h-3.5" /> 游戏引擎 JSON
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制！' : '复制全文'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载文件</span>
            </button>

            <button
              onClick={() => setActiveModal(null)}
              className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 p-6 overflow-hidden">
          <textarea
            readOnly
            value={exportText}
            className="w-full h-full bg-slate-950/70 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-300 leading-relaxed outline-none resize-none select-text"
          />
        </div>
      </div>
    </div>
  );
}
