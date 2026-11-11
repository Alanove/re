/**
 * Test CalculateRate international: LB -> UAE Dubai. Run: npm run aramex:test:rate-international
 */
import './env';
import { calculateRate } from '../aramexApiClient';

async function main() {
  console.log('=== Aramex CalculateRate (LB -> UAE Dubai, international) ===\n');
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
        Line1: 'Destination',
        City: 'Dubai',
        StateOrProvinceCode: '',
        PostCode: '',
        CountryCode: 'AE'
      },
      shipmentDetails: {
        ActualWeight: { Unit: 'KG', Value: 1 },
        ChargeableWeight: { Unit: 'KG', Value: 1 },
        Dimensions: null,
        NumberOfPieces: 1,
        ProductGroup: 'EXP',
        ProductType: 'PDX',
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
    console.log('\n✓ CalculateRate (international) OK');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
