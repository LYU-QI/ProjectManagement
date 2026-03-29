import { useEffect, useMemo, useState } from 'react';
import {
  createWikiPage,
  deleteWikiPage,
  listWikiPages,
  updateWikiPage,
  type WikiPage
} from '../api/wiki';
import ThemedSelect from '../components/ui/ThemedSelect';

type Props = {
  selectedProjectId: number | null;
  canWrite: boolean;
};

type WikiNode = WikiPage & { children: WikiNode[] };

function buildTree(pages: WikiPage[]): WikiNode[] {
  const map = new Map<number, WikiNode>();
  const roots: WikiNode[] = [];

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId === null || node.parentId === 0) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  // Sort each level by sortOrder
  function sortNodes(nodes: WikiNode[]) {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) {
      sortNodes(node.children);
    }
  }
  sortNodes(roots);

  return roots;
}

type CreateModalState = {
  open: boolean;
  parentId: number | null;
  type: 'document' | 'folder';
};

export default function WikiView({ selectedProjectId, canWrite }: Props) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [createModal, setCreateModal] = useState<CreateModalState>({
    open: false,
    parentId: null,
    type: 'document'
  });
  const [createTitle, setCreateTitle] = useState('');
  const [createType, setCreateType] = useState<'document' | 'folder'>('document');
  const [creating, setCreating] = useState(false);

  const selectedPage = useMemo(
    () => pages.find((p) => p.id === selectedPageId) ?? null,
    [pages, selectedPageId]
  );

  const tree = useMemo(() => buildTree(pages), [pages]);

  async function loadPages() {
    if (!selectedProjectId) {
      setPages([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await listWikiPages(selectedProjectId);
      setPages(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPages();
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedPage) {
      setEditTitle(selectedPage.title);
      setEditContent(selectedPage.content);
    } else {
      setEditTitle('');
      setEditContent('');
    }
  }, [selectedPage]);

  async function handleSave() {
    if (!selectedPageId || !editTitle.trim()) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await updateWikiPage(selectedPageId, {
        title: editTitle.trim(),
        content: editContent
      });
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSaveMsg('已保存');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedPageId) return;
    if (!window.confirm('确定删除该页面？子页面也会一起删除。')) return;
    try {
      await deleteWikiPage(selectedPageId);
      setPages((prev) => prev.filter((p) => p.id !== selectedPageId));
      setSelectedPageId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  async function handleCreate() {
    if (!selectedProjectId || !createTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createWikiPage({
        projectId: selectedProjectId,
        parentId: createModal.parentId ?? undefined,
        title: createTitle.trim(),
        type: createType,
        content: ''
      });
      setPages((prev) => [...prev, created]);
      setCreateModal({ open: false, parentId: null, type: 'document' });
      setCreateTitle('');
      setCreateType('document');
      setSelectedPageId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  function openCreateModal(parentId: number | null, type: 'document' | 'folder' = 'document') {
    setCreateModal({ open: true, parentId, type });
    setCreateTitle('');
    setCreateType(type);
  }

  function toggleFolder(id: number) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function renderTreeNodes(nodes: WikiNode[], depth: number = 0) {
    return nodes.map((node) => {
      const isFolder = node.type === 'folder';
      const isExpanded = expandedFolders.has(node.id);
      const isSelected = node.id === selectedPageId;

      return (
        <div key={node.id}>
          <div
            className={`wiki-tree-item ${isSelected ? 'wiki-tree-item--selected' : ''}`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => {
              if (isFolder) {
                toggleFolder(node.id);
              } else {
                setSelectedPageId(node.id);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (isFolder) toggleFolder(node.id);
                else setSelectedPageId(node.id);
              }
            }}
          >
            {isFolder ? (
              <>
                <span className="wiki-tree-arrow">{isExpanded ? '▾' : '▸'}</span>
                <span className="wiki-tree-icon">📁</span>
              </>
            ) : (
              <>
                <span className="wiki-tree-arrow" />
                <span className="wiki-tree-icon">📄</span>
              </>
            )}
            <span className="wiki-tree-label">{node.title}</span>
          </div>
          {isFolder && isExpanded && node.children.length > 0 && (
            <div className="wiki-tree-children">
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="wiki-layout">
      {/* Left sidebar */}
      <div className="wiki-sidebar">
        <div className="wiki-sidebar-header">
          <span>页面列表</span>
          {canWrite && (
            <div className="wiki-sidebar-actions">
              <button
                className="btn btn-sm"
                onClick={() => openCreateModal(null, 'document')}
                title="新建页面"
              >
                + 页面
              </button>
              <button
                className="btn btn-sm"
                onClick={() => openCreateModal(null, 'folder')}
                title="新建文件夹"
              >
                + 文件夹
              </button>
            </div>
          )}
        </div>
        <div className="wiki-tree">
          {loading && <div className="wiki-empty">加载中...</div>}
          {!loading && pages.length === 0 && (
            <div className="wiki-empty">
              {selectedProjectId ? '暂无页面，点击上方按钮创建' : '请先选择项目'}
            </div>
          )}
          {!loading && pages.length > 0 && tree.length === 0 && (
            <div className="wiki-empty">暂无页面</div>
          )}
          {!loading && renderTreeNodes(tree)}
        </div>
      </div>

      {/* Right editor */}
      <div className="wiki-editor">
        {selectedPage ? (
          <>
            <div className="wiki-editor-header">
              <input
                className="wiki-title-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="页面标题"
                disabled={!canWrite}
              />
              <div className="wiki-editor-actions">
                {saveMsg && <span className="wiki-save-msg">{saveMsg}</span>}
                {canWrite && (
                  <>
                    <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button className="btn btn-danger" onClick={() => void handleDelete()}>
                      删除
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="wiki-editor-body">
              {selectedPage.type === 'folder' ? (
                <div className="wiki-folder-hint">文件夹：{selectedPage.title}</div>
              ) : (
                <textarea
                  className="wiki-content-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="在此输入页面内容..."
                  disabled={!canWrite}
                />
              )}
            </div>
          </>
        ) : (
          <div className="wiki-editor-empty">
            {loading ? '加载中...' : '请从左侧选择一个页面或新建页面'}
          </div>
        )}
        {error && <div className="warn wiki-error">{error}</div>}
      </div>

      {/* Create modal */}
      {createModal.open && (
        <div className="modal-overlay" onClick={() => setCreateModal({ open: false, parentId: null, type: 'document' })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>新建{createType === 'folder' ? '文件夹' : '页面'}</h3>
            <div className="form">
              <div>
                <label>标题</label>
                <input
                  autoFocus
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreate();
                    if (e.key === 'Escape') setCreateModal({ open: false, parentId: null, type: 'document' });
                  }}
                  placeholder="输入标题"
                />
              </div>
              <div>
                <label>类型</label>
                <ThemedSelect
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as 'document' | 'folder')}
                >
                  <option value="document">页面</option>
                  <option value="folder">文件夹</option>
                </ThemedSelect>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => setCreateModal({ open: false, parentId: null, type: 'document' })}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void handleCreate()}
                disabled={creating || !createTitle.trim()}
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
