import { create } from 'zustand';
import type { PlatformMode, ViewKey } from '../components/AstraeaLayout';

const VIEW_STORAGE_KEY = 'pm_view';
const PLATFORM_STORAGE_KEY = 'pm_platform';
const PROJECT_STORAGE_KEY = 'ui:lastProjectId';

const VALID_VIEWS: ViewKey[] = [
  'dashboard',
  'requirements',
  'work-items',
  'costs',
  'schedule',
  'resources',
  'risks',
  'ai',
  'notifications',
  'audit',
  'feishu',
  'feishu-users',
  'pm-assistant',
  'global',
  'settings',
  'project-access',
  'milestone-board',
  'sprints',
  'bugs',
  'test-plans',
  'webhooks',
  'api-keys',
  'smart-fill',
  'automation',
  'task-center',
  'capabilities',
  'cost-report',
  'departments',
  'plan-settings',
  'org-settings',
  'org-members',
  'wiki',
  'efficiency'
];

function getInitialView(): ViewKey {
  const raw = localStorage.getItem(VIEW_STORAGE_KEY);
  if (!raw) return 'dashboard';
  return VALID_VIEWS.includes(raw as ViewKey) ? (raw as ViewKey) : 'dashboard';
}

function getInitialPlatform(): PlatformMode {
  const raw = localStorage.getItem(PLATFORM_STORAGE_KEY);
  return raw === 'admin' ? 'admin' : 'workspace';
}

function getInitialProjectId(): number | null {
  const raw = Number(localStorage.getItem(PROJECT_STORAGE_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export type RecoveryContext = {
  source: 'feishu' | 'pm_assistant' | 'automation' | 'ai_chat';
  errorCode?: string | null;
  severity?: 'info' | 'warning' | 'critical' | null;
  recoveryEntry?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  from: 'task-center';
};

interface WorkspaceStore {
  view: ViewKey;
  platform: PlatformMode;
  selectedProjectId: number | null;
  recoveryContext: RecoveryContext | null;
  setView: (view: ViewKey) => void;
  setPlatform: (platform: PlatformMode) => void;
  setSelectedProjectId: (projectId: number | null) => void;
  setRecoveryContext: (context: RecoveryContext | null) => void;
  clearRecoveryContext: () => void;
  clear: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  view: getInitialView(),
  platform: getInitialPlatform(),
  selectedProjectId: getInitialProjectId(),
  recoveryContext: null,

  setView: (view) => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
    set({ view });
  },

  setPlatform: (platform) => {
    localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
    set({ platform });
  },

  setSelectedProjectId: (projectId) => {
    if (projectId) {
      localStorage.setItem(PROJECT_STORAGE_KEY, String(projectId));
    } else {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
    set({ selectedProjectId: projectId });
  },

  setRecoveryContext: (recoveryContext) => {
    set({ recoveryContext });
  },

  clearRecoveryContext: () => {
    set({ recoveryContext: null });
  },

  clear: () => {
    localStorage.removeItem(VIEW_STORAGE_KEY);
    localStorage.removeItem(PLATFORM_STORAGE_KEY);
    localStorage.removeItem(PROJECT_STORAGE_KEY);
    set({
      view: 'dashboard',
      platform: 'workspace',
      selectedProjectId: null,
      recoveryContext: null
    });
  }
}));
