import { create } from 'zustand';

export interface OrgInfo {
  id: string;
  name: string;
  orgRole: 'owner' | 'admin' | 'member' | 'viewer';
}

interface OrgStore {
  activeOrgId: string | null;
  orgList: OrgInfo[];
  setActiveOrg: (orgId: string) => void;
  setOrgList: (list: OrgInfo[]) => void;
  clear: () => void;
}

export const useOrgStore = create<OrgStore>((set) => ({
  activeOrgId: localStorage.getItem('activeOrgId'),
  orgList: [],

  setActiveOrg: (orgId: string) => {
    localStorage.setItem('activeOrgId', orgId);
    set({ activeOrgId: orgId });
  },

  setOrgList: (list: OrgInfo[]) => {
    set({ orgList: list });
    // Auto-select first org if none selected
    const stored = localStorage.getItem('activeOrgId');
    if (!stored && list.length > 0) {
      localStorage.setItem('activeOrgId', list[0].id);
      set({ activeOrgId: list[0].id });
    } else if (stored && !list.find(o => o.id === stored)) {
      // Selected org no longer in list, reset
      if (list.length > 0) {
        localStorage.setItem('activeOrgId', list[0].id);
        set({ activeOrgId: list[0].id });
      } else {
        localStorage.removeItem('activeOrgId');
        set({ activeOrgId: null });
      }
    }
  },

  clear: () => {
    localStorage.removeItem('activeOrgId');
    set({ activeOrgId: null, orgList: [] });
  }
}));
