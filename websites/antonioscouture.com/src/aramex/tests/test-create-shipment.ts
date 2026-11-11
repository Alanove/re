/**
 * Test CreateShipments (minimal payload). Creates a real shipment in Aramex.
 * Run: npx ts-node src/aramex/tests/test-create-shipment.ts
 */
import './env';
import { getClientInfo } from '../clientInfo';
import { createShipments, parseCreateShipmentsResponse } from '../aramexApiClient';

const emptyParty = () => ({
  Line1: '', Line2: '', Line3: '', City: '', StateOrProvinceCode: '', PostCode: '', CountryCode: '',
  Longitude: 0, Latitude: 0, BuildingNumber: '', BuildingName: '', Floor: '', Apartment: '', POBox: '', Description: ''
});
const emptyContact = () => ({
  Department: '', PersonName: '', Title: '', CompanyName: '', PhoneNumber1: '', PhoneNumber1Ext: '',
  PhoneNumber2: '', PhoneNumber2Ext: '', FaxNumber: '', CellPhone: '', EmailAddress: '', Type: ''
});

async function main() {
  console.log('=== Aramex CreateShipments (minimal) ===\n');
  try {
    getClientInfo();
    const now = Date.now();
    const due = now + 24 * 60 * 60 * 1000;
    const shipment = {
      Reference1: 'TEST-' + Date.now(),
      Reference2: '',
      Reference3: new Date().toISOString(),
      Shipper: {
        Reference1: 'TEST',
        Reference2: '',
        AccountNumber: process.env.ARAMEX_ACCOUNT_NUMBER,
        PartyAddress: { ...emptyParty(), Line1: 'Test', City: 'Beirut', CountryCode: 'LB' },
        Contact: { ...emptyContact(), PersonName: 'Test', CompanyName: 'Test', PhoneNumber1: '+9611', CellPhone: '+9611', EmailAddress: 'test@test.com' }
      },
      Consignee: {
        Reference1: '',
        Reference2: '',
        AccountNumber: '',
        PartyAddress: { ...emptyParty(), Line1: 'Consignee Address', City: 'Beirut', CountryCode: 'LB' },
        Contact: {
          ...emptyContact(),
          PersonName: 'Test Consignee',
          CompanyName: 'Test Consignee Company',
          PhoneNumber1: '+9611234567',
          CellPhone: '+9611234567',
          EmailAddress: 'consignee@test.com'
        }
      },
      ThirdParty: { Reference1: '', Reference2: '', AccountNumber: '', PartyAddress: emptyParty(), Contact: emptyContact() },
      ShippingDateTime: `/Date(${now})/`,
      DueDate: `/Date(${due})/`,
      Comments: 'Test shipment',
      PickupLocation: 'Reception',
      OperationsInstructions: '',
      AccountingInstrcutions: '',
      Details: {
        Dimensions: { Length: 30, Width: 20, Height: 15, Unit: 'cm' },
        ActualWeight: { Unit: 'KG', Value: 1 },
        ChargeableWeight: { Unit: 'KG', Value: 1 },
        DescriptionOfGoods: 'Test',
        GoodsOriginCountry: 'LB',
        NumberOfPieces: 1,
        ProductGroup: 'DOM',
        ProductType: 'CDS',
        PaymentType: 'P',
        PaymentOptions: '',
        CustomsValueAmount: { CurrencyCode: 'USD', Value: 10 },
        Insurance_Value: { CurrencyCode: 'USD', Value: 10 },
        CashOnDeliveryAmount: { CurrencyCode: 'USD', Value: 0 },
        Items: []
      },
      Attachments: [],
      ForeignHAWB: 'TEST-' + now,
      TransportType: 0,
      PickupGUID: '',
      Number: '',
      ScheduledDelivery: null
    };
    const raw = await createShipments({
      LabelInfo: { ReportID: 9729, ReportType: 'URL' },
      Shipments: [shipment],
      Transaction: { Reference1: '', Reference2: '', Reference3: '', Reference4: '', Reference5: '' }
    });
    const parsed = parseCreateShipmentsResponse(raw);
    if (parsed.hasErrors || !parsed.trackingId) {
      console.error('Errors or no ID:', parsed);
      process.exit(1);
    }
    console.log('Tracking ID:', parsed.trackingId);
    console.log('Label URL:', parsed.labelUrl || '(none)');
    console.log('\n✓ CreateShipments OK');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
