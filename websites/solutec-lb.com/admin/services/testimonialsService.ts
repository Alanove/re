import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';

export interface Testimonial {
  id: string;
  name: string;
  quote: string;
  location?: string;
  rating?: number;
  sort: number;
  status: 'published' | 'draft';
  lastUpdated?: string;
}

interface TestimonialsFile {
  testimonials: Record<string, Testimonial>;
}

export class TestimonialsService {
  private static instance: TestimonialsService;
  private dataPath: string;
  private data: TestimonialsFile;

  private constructor() {
    this.dataPath = DATA_PATHS.TESTIMONIALS_FILE;
    this.data = this.load();
  }

  public static getInstance(): TestimonialsService {
    if (!TestimonialsService.instance) {
      TestimonialsService.instance = new TestimonialsService();
    }
    return TestimonialsService.instance;
  }

  private load(): TestimonialsFile {
    try {
      const raw = fs.readFileSync(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw);
      return { testimonials: parsed.testimonials || {} };
    } catch {
      return { testimonials: {} };
    }
  }

  private save(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf8');
    this.data = this.load();
  }

  public reload(): void {
    this.data = this.load();
  }

  public getAll(): Testimonial[] {
    return Object.values(this.data.testimonials).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }

  public getPublished(): Testimonial[] {
    return this.getAll().filter((item) => item.status === 'published');
  }

  public getById(id: string): Testimonial | null {
    return this.data.testimonials[id] || null;
  }

  public slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `review-${Date.now()}`;
  }

  public create(item: Omit<Testimonial, 'id' | 'lastUpdated'> & { id?: string }): Testimonial {
    const id = item.id || this.slugify(item.name);
    if (this.data.testimonials[id]) {
      throw new Error('A testimonial with this id already exists');
    }
    const created: Testimonial = {
      id,
      name: item.name,
      quote: item.quote,
      location: item.location || '',
      rating: Math.max(1, Math.min(5, item.rating || 5)),
      sort: item.sort ?? 1000,
      status: item.status || 'draft',
      lastUpdated: new Date().toISOString()
    };
    this.data.testimonials[id] = created;
    this.save();
    return created;
  }

  public update(id: string, updates: Partial<Testimonial>): Testimonial | null {
    const existing = this.data.testimonials[id];
    if (!existing) return null;
    this.data.testimonials[id] = {
      ...existing,
      ...updates,
      id,
      lastUpdated: new Date().toISOString()
    };
    this.save();
    return this.data.testimonials[id];
  }

  public delete(id: string): boolean {
    if (!this.data.testimonials[id]) return false;
    delete this.data.testimonials[id];
    this.save();
    return true;
  }

  public getEmpty(): Testimonial {
    return {
      id: '',
      name: '',
      quote: '',
      location: '',
      rating: 5,
      sort: 1000,
      status: 'published'
    };
  }
}
