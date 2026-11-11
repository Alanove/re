import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';

export interface TeamCompanyAssignment {
  key: string;
  sort: number;
  description?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  description?: string;
  bio?: string;
  photo?: string;
  companies: TeamCompanyAssignment[];
  status: 'published' | 'draft';
  lastUpdated?: string;
}

interface TeamFile {
  members: Record<string, TeamMember>;
}

export const COMPANY_KEYS = [
  { key: 'advisory', title: 'Advisory' },
  { key: 'taxes', title: 'Taxes' },
  { key: 'bookkeeping', title: 'Bookkeeping' },
  { key: 'wealth-management', title: 'Wealth' },
  { key: 'income-replacement', title: 'Insure' }
] as const;

export class TeamService {
  private static instance: TeamService;
  private dataPath: string;
  private data: TeamFile;

  private constructor() {
    this.dataPath = DATA_PATHS.TEAM_FILE;
    this.data = this.load();
  }

  public static getInstance(): TeamService {
    if (!TeamService.instance) {
      TeamService.instance = new TeamService();
    }
    return TeamService.instance;
  }

  private load(): TeamFile {
    try {
      const raw = fs.readFileSync(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw);
      return { members: parsed.members || {} };
    } catch {
      return { members: {} };
    }
  }

  private save(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf8');
    this.data = this.load();
  }

  public reload(): void {
    this.data = this.load();
  }

  public getAll(): TeamMember[] {
    return Object.values(this.data.members);
  }

  public getPublished(): TeamMember[] {
    return this.getAll().filter((member) => member.status === 'published');
  }

  public getById(id: string): TeamMember | null {
    return this.data.members[id] || null;
  }

  public getByCompany(companyKey: string): TeamMember[] {
    return this.getPublished()
      .filter((member) => member.companies?.some((c) => c.key === companyKey))
      .sort((a, b) => {
        const sortA = a.companies.find((c) => c.key === companyKey)?.sort ?? 999;
        const sortB = b.companies.find((c) => c.key === companyKey)?.sort ?? 999;
        return sortA - sortB;
      });
  }

  public slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `member-${Date.now()}`;
  }

  public create(item: Omit<TeamMember, 'id' | 'lastUpdated'> & { id?: string }): TeamMember {
    const id = item.id || this.slugify(item.name);
    if (this.data.members[id]) {
      throw new Error('A team member with this id already exists');
    }
    const created: TeamMember = {
      ...item,
      id,
      companies: item.companies || [],
      lastUpdated: new Date().toISOString()
    };
    this.data.members[id] = created;
    this.save();
    return created;
  }

  public update(id: string, updates: Partial<TeamMember>): TeamMember | null {
    const existing = this.data.members[id];
    if (!existing) return null;
    this.data.members[id] = {
      ...existing,
      ...updates,
      id,
      lastUpdated: new Date().toISOString()
    };
    this.save();
    return this.data.members[id];
  }

  public delete(id: string): boolean {
    if (!this.data.members[id]) return false;
    delete this.data.members[id];
    this.save();
    return true;
  }

  public getEmpty(): TeamMember {
    return {
      id: '',
      name: '',
      description: '',
      bio: '',
      photo: '',
      companies: [],
      status: 'published'
    };
  }
}
