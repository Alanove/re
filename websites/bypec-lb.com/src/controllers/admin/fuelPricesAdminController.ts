import type { Request, Response } from 'express';
import type { FuelProduct } from '../../domain/models.js';
import { safeParseFields } from '../../middleware/validate.js';
import { fuelPriceFormSchema } from '../../schemas/adminSchemas.js';
import { formatOfficialDate, fuelPriceService } from '../../services/fuelPriceService.js';
import { formErrorState, render, setFlash } from './helpers.js';

interface ProductRow {
  key: string;
  label: string;
  officialPrice: number | null;
  override: string;
  visible: boolean;
  sort: number | string;
  overrideUpdatedAt: string | null;
}

function toRow(product: FuelProduct): ProductRow {
  return {
    key: product.key,
    label: product.label,
    officialPrice: product.officialPrice,
    override: product.override === null ? '' : new Intl.NumberFormat('en-US').format(product.override),
    visible: product.visible,
    sort: product.sort,
    overrideUpdatedAt: product.overrideUpdatedAt
  };
}

export class FuelPricesAdminController {
  public static async editForm(_req: Request, res: Response): Promise<void> {
    const prices = await fuelPriceService.getSettings();
    await FuelPricesAdminController.renderForm(res, {
      syncEnabled: prices.sync.enabled,
      unit: prices.unit,
      products: prices.products.map(toRow)
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(fuelPriceFormSchema, body);
    if (!parsed.ok) {
      res.status(422);
      await FuelPricesAdminController.renderForm(res, await FuelPricesAdminController.formFromBody(body), 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      await fuelPriceService.updateSettings(parsed.data);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      res.status(422);
      await FuelPricesAdminController.renderForm(res, await FuelPricesAdminController.formFromBody(body), state.message, state.fields);
      return;
    }
    setFlash(req, 'success', 'Fuel price settings saved.');
    res.redirect('/admin/fuel-prices');
  }

  public static async sync(req: Request, res: Response): Promise<void> {
    const result = await fuelPriceService.syncNow();
    setFlash(req, result.ok ? 'success' : 'warning', result.message);
    res.redirect('/admin/fuel-prices');
  }

  private static async formFromBody(body: Record<string, unknown>): Promise<{ syncEnabled: boolean; unit: string; products: ProductRow[] }> {
    const saved = new Map((await fuelPriceService.getSettings()).products.map((product) => [product.key, product]));
    const raw = body.products && typeof body.products === 'object' ? Object.values(body.products as Record<string, Record<string, unknown>>) : [];
    const text = (value: unknown): string => (typeof value === 'string' ? value : '');
    return {
      syncEnabled: Boolean(body.syncEnabled),
      unit: text(body.unit),
      products: raw.map((row) => {
        const product = saved.get(text(row.key) as FuelProduct['key']);
        return {
          key: text(row.key),
          label: text(row.label),
          officialPrice: product?.officialPrice ?? null,
          override: text(row.override),
          visible: Boolean(row.visible),
          sort: text(row.sort),
          overrideUpdatedAt: product?.overrideUpdatedAt ?? null
        };
      })
    };
  }

  private static async renderForm(
    res: Response,
    form: { syncEnabled: boolean; unit: string; products: ProductRow[] },
    error: string | null = null,
    errors: Record<string, string> = {}
  ): Promise<void> {
    const [status, prices] = await Promise.all([fuelPriceService.status(), fuelPriceService.getSettings()]);
    render(res, 'fuel-prices/edit', {
      pageTitle: 'Fuel Prices',
      form,
      status,
      history: [...prices.history].reverse().map((entry) => ({ ...entry, officialDateLabel: formatOfficialDate(entry.officialDate) })),
      productLabels: Object.fromEntries(prices.products.map((product) => [product.key, product.label])),
      error,
      errors
    });
  }
}
