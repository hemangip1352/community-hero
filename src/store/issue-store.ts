import { create } from 'zustand';
import { Issue, IssueStatus, IssueCategory } from '@/types';

interface IssueFilters {
  status?: IssueStatus;
  category?: IssueCategory;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  dateRange?: { start: Date; end: Date };
}

interface IssueState {
  issues: Issue[];
  selectedIssue: Issue | null;
  filters: IssueFilters;
  isLoading: boolean;
  setIssues: (issues: Issue[]) => void;
  addIssue: (issue: Issue) => void;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  setSelectedIssue: (issue: Issue | null) => void;
  setFilters: (filters: IssueFilters) => void;
  setLoading: (loading: boolean) => void;
  getFilteredIssues: () => Issue[];
}

export const useIssueStore = create<IssueState>((set, get) => ({
  issues: [],
  selectedIssue: null,
  filters: {},
  isLoading: false,
  setIssues: (issues) => set({ issues }),
  addIssue: (issue) => set((state) => ({ issues: [issue, ...state.issues] })),
  updateIssue: (id, updates) =>
    set((state) => ({
      issues: state.issues.map((issue) => (issue.id === id ? { ...issue, ...updates } : issue)),
      selectedIssue:
        state.selectedIssue?.id === id ? { ...state.selectedIssue, ...updates } : state.selectedIssue,
    })),
  setSelectedIssue: (issue) => set({ selectedIssue: issue }),
  setFilters: (filters) => set({ filters }),
  setLoading: (loading) => set({ isLoading: loading }),
  getFilteredIssues: () => {
    const { issues, filters } = get();
    return issues.filter((issue) => {
      if (filters.status && issue.status !== filters.status) return false;
      if (filters.category && issue.category !== filters.category) return false;
      if (filters.urgency && issue.urgency !== filters.urgency) return false;
      if (filters.dateRange) {
        const issueDate = new Date(issue.created_at);
        if (issueDate < filters.dateRange.start || issueDate > filters.dateRange.end) return false;
      }
      return true;
    });
  },
}));
