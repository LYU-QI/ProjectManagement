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
  // Don't seed activeOrgId from localStorage at boot — a stale value from a
  // previous session/DB would otherwise flash as the active org (and trigger
  // 404s on /organizations/:id) before setOrgList has a chance to validate it.
  // The correct value is re-established by the login flow (which calls
  // clear() then setOrgList+setActiveOrg), and by setOrgList's own validation
  // branch for already-authenticated users who re-load the page.
  activeOrgId: null,
  orgList: [],

  setActiveOrg: (orgId: string) => {
    // Defensive: ignore empty/null/undefined so we never poison localStorage with a
    // bogus value (e.g. 'default' written by an old token, or an orgId that no
    // longer exists in the DB).
    if (!orgId || typeof orgId !== 'string') return;
    const current = useOrgStore.getState();
    if (current.orgList.length > 0 && !current.orgList.find(o => o.id === orgId)) {
      // orgId not in known list — log and refuse to persist
      console.warn('[useOrgStore] setActiveOrg ignored: orgId not in orgList', orgId);
      return;
    }
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
