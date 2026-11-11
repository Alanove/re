import * as fs from 'fs/promises';
import { DATA_PATHS } from '../constants/data-paths';

export const PARKING_PLAN_IMAGE_URL = '/santa%20maria%20parking.jpg';

const MAX_BAYS = 20;
const MIN_AREA = 0.05;

const HIGHLIGHT_COLORS = ['#c9a227', '#2f6fed', '#1f8a4c', '#d4533b', '#6b4c9a', '#0e8a8a', '#b86e00', '#3d5a80'];

export interface ParkingPoint {
  x: number;
  y: number;
}

export interface ParkingBay {
  points: ParkingPoint[];
}

export interface ParkingApartmentRef {
  id: number;
  block?: string;
  unitNumberOfficial?: string;
  unitNumberUnofficial?: string;
}

export interface ParkingHighlight {
  apartmentId: number;
  label: string;
  color: string;
  bays: ParkingBay[];
}

export interface MemberParkingMap {
  highlights: ParkingHighlight[];
  unmarkedLabels: string[];
  imageUrl: string;
}

export class ParkingMapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParkingMapValidationError';
  }
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function polygonArea(points: ParkingPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    sum += points[i].x * next.y - next.x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function isPoint(value: unknown): value is ParkingPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as ParkingPoint;
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function apartmentParkingLabel(apartment: ParkingApartmentRef): string {
  return `Block ${apartment.block || ''} ${apartment.unitNumberOfficial || ''}`.replace(/\s+/g, ' ').trim();
}

function normalizeStoredBays(value: unknown): ParkingBay[] {
  if (!Array.isArray(value)) return [];
  const bays: ParkingBay[] = [];
  value.forEach((item) => {
    const points = item && typeof item === 'object' ? (item as ParkingBay).points : null;
    if (!Array.isArray(points) || points.length !== 4) return;
    if (!points.every((point) => isPoint(point) && point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100)) {
      return;
    }
    if (polygonArea(points) < MIN_AREA) return;
    bays.push({
      points: points.map((point) => ({ x: roundPercent(point.x), y: roundPercent(point.y) }))
    });
  });
  return bays;
}

export class ParkingMapService {
  private static instance: ParkingMapService;
  private writeChain: Promise<void> = Promise.resolve();

  static getInstance(): ParkingMapService {
    if (!ParkingMapService.instance) {
      ParkingMapService.instance = new ParkingMapService();
    }
    return ParkingMapService.instance;
  }

  validateBays(value: unknown): ParkingBay[] {
    if (!Array.isArray(value)) {
      throw new ParkingMapValidationError('Parking bays must be a list.');
    }
    if (value.length > MAX_BAYS) {
      throw new ParkingMapValidationError(`An apartment can have at most ${MAX_BAYS} parking bays.`);
    }

    return value.map((item, index) => {
      const points = item && typeof item === 'object' ? (item as ParkingBay).points : null;
      if (!Array.isArray(points) || points.length !== 4) {
        throw new ParkingMapValidationError(`Bay ${index + 1} needs four corners.`);
      }

      const normalized = points.map((point) => {
        if (!isPoint(point)) {
          throw new ParkingMapValidationError(`Bay ${index + 1} has a corner that is not a point on the plan.`);
        }
        const x = roundPercent(point.x);
        const y = roundPercent(point.y);
        if (x < 0 || x > 100 || y < 0 || y > 100) {
          throw new ParkingMapValidationError(`Bay ${index + 1} sits outside the plan.`);
        }
        return { x, y };
      });

      if (polygonArea(normalized) < MIN_AREA) {
        throw new ParkingMapValidationError(`Bay ${index + 1} is too small. Drag a longer side, then set the width.`);
      }

      return { points: normalized };
    });
  }

  async getAll(): Promise<Record<string, ParkingBay[]>> {
    const raw = await this.readFile();
    const spots: Record<string, ParkingBay[]> = {};
    Object.keys(raw).forEach((key) => {
      const bays = normalizeStoredBays(raw[key]);
      if (bays.length) spots[key] = bays;
    });
    return spots;
  }

  async highlightsFor(apartments: ParkingApartmentRef[]): Promise<MemberParkingMap> {
    const spots = await this.getAll();
    const highlights: ParkingHighlight[] = [];
    const unmarkedLabels: string[] = [];

    apartments.forEach((apartment) => {
      const label = apartmentParkingLabel(apartment);
      const bays = spots[String(apartment.id)] || [];
      if (!bays.length) {
        unmarkedLabels.push(label);
        return;
      }
      highlights.push({
        apartmentId: apartment.id,
        label,
        color: HIGHLIGHT_COLORS[highlights.length % HIGHLIGHT_COLORS.length],
        bays
      });
    });

    return {
      highlights,
      unmarkedLabels,
      imageUrl: PARKING_PLAN_IMAGE_URL
    };
  }

  async saveForApartment(apartmentId: number, bays: ParkingBay[]): Promise<void> {
    const validated = this.validateBays(bays);
    await this.enqueue(async () => {
      const raw = await this.readFile();
      const key = String(apartmentId);
      if (validated.length) {
        raw[key] = validated;
      } else {
        delete raw[key];
      }
      await this.writeFile(raw);
    });
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.writeChain.then(task, task);
    this.writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async readFile(): Promise<Record<string, unknown>> {
    try {
      const text = await fs.readFile(DATA_PATHS.PARKING_SPOTS_FILE, 'utf8');
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Parking spot file is not an object.');
      }
      return parsed as Record<string, unknown>;
    } catch (error: any) {
      if (error && error.code === 'ENOENT') return {};
      throw error;
    }
  }

  private async writeFile(data: Record<string, unknown>): Promise<void> {
    const file = DATA_PATHS.PARKING_SPOTS_FILE;
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.copyFile(tmp, file);
    await fs.unlink(tmp).catch(() => undefined);
  }
}

export const parkingMapService = ParkingMapService.getInstance();
