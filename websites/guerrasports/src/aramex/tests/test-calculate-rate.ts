/**
 * Test CalculateRate. Run: npx ts-node src/aramex/tests/test-calculate-rate.ts
 */
import './env';
import { calculateRate } from '../aramexApiClient';

async function main() {
  console.log('=== Aramex CalculateRate (LB -> LB minimal) ===\n');
  try {
    const res = await calculateRate({
      originAddress: {
        Line1: 'Origin',
        City: 'Beirut',
        StateOrProvinceCode: '',
        PostCode: '',
        CountryCode: 'LB'
      },
      destinationAddress: {
        Line1: '',
        City: 'Beirut',
        StateOrProvinceCode: '',
        PostCode: '',
        CountryCode: 'LB'
      },
      shipmentDetails: {
        ActualWeight: { Unit: 'KG', Value: 10 },
        ChargeableWeight: { Unit: 'KG', Value: 10 },
        Dimensions: null,
        NumberOfPieces: 1,
        ProductGroup: 'DOM',
        ProductType: 'CDS',
        PaymentType: 'P',
        PaymentOptions: '',
        GoodsOriginCountry: 'LB',
        DescriptionOfGoods: null,
        CustomsValueAmount: null,
        CashOnDeliveryAmount: null,
        Services: ''
      },
      preferredCurrencyCode: 'USD'
    });
    if (res.HasErrors) {
      console.error('HasErrors:', res.Notifications);
      process.exit(1);
    }
    const total = res.TotalAmount;
    console.log('TotalAmount:', total?.Value, total?.CurrencyCode);
    console.log('\n✓ CalculateRate OK');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
