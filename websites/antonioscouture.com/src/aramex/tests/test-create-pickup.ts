/**
 * Test CreatePickup with ExistingShipments. Requires at least one tracking number in ARAMEX_TEST_TRACKING (or comma-separated).
 * Run: npx ts-node src/aramex/tests/test-create-pickup.ts
 */
import './env';
import { getClientInfo } from '../clientInfo';
import { createPickup } from '../aramexApiClient';

const emptyAddr = () => ({
  Line1: '', Line2: '', Line3: '', City: '', StateOrProvinceCode: '', PostCode: '', CountryCode: '',
  Longitude: 0, Latitude: 0, BuildingNumber: null, BuildingName: null, Floor: null, Apartment: null, POBox: null, Description: null
});
const emptyContact = () => ({
  Department: '', PersonName: '', Title: '', CompanyName: '', PhoneNumber1: '', PhoneNumber1Ext: '',
  PhoneNumber2: '', PhoneNumber2Ext: '', FaxNumber: '', CellPhone: '', EmailAddress: '', Type: ''
});

async function main() {
  const trackingList = process.env.ARAMEX_TEST_TRACKING || '';
  if (!trackingList.trim()) {
    console.error('Set ARAMEX_TEST_TRACKING (one or comma-separated tracking numbers).');
    process.exit(1);
  }
  const numbers = trackingList.split(',').map((s) => s.trim()).filter(Boolean);
  const entity = (process.env.ARAMEX_ACCOUNT_ENTITY || 'BEY').trim().toUpperCase();
  const existingShipments = numbers.map((Number) => ({ Number, OriginEntity: entity, ProductGroup: 'DOM' }));

  console.log('=== Aramex CreatePickup (ExistingShipments) ===\n');
  try {
    getClientInfo();
    const pickupDate = new Date();
    const readyTime = new Date(pickupDate);
    readyTime.setHours(10, 0, 0, 0);
    const closingTime = new Date(pickupDate);
    closingTime.setHours(17, 0, 0, 0);
    const body = {
      LabelInfo: null,
      Pickup: {
        PickupAddress: { ...emptyAddr(), Line1: 'Test', City: 'Beirut', CountryCode: 'LB' },
        PickupContact: { ...emptyContact(), PersonName: 'Test', PhoneNumber1: '+9611', CellPhone: '+9611', EmailAddress: 'test@test.com' },
        PickupLocation: 'Reception',
        PickupDate: `/Date(${pickupDate.getTime()})/`,
        ReadyTime: `/Date(${readyTime.getTime()})/`,
        LastPickupTime: `/Date(${closingTime.getTime()})/`,
        ClosingTime: `/Date(${closingTime.getTime()})/`,
        Comments: 'Test pickup',
        Reference1: 'TEST',
        Reference2: '',
        Vehicle: '0',
        Shipments: [],
        PickupItems: [{ ProductGroup: 'DOM', ProductType: 'CDS', NumberOfShipments: numbers.length, PackageType: 'Box', Payment: 'P', ShipmentWeight: { Unit: 'KG', Value: 1 }, ShipmentVolume: null, NumberOfPieces: 1, CashAmount: null, ExtraCharges: null, ShipmentDimensions: { Length: 0.1, Width: 0.1, Height: 0.1, Unit: 'cm' }, Comments: 'Test' }],
        Status: 'Ready',
        ExistingShipments: existingShipments,
        Branch: '',
        RouteCode: ''
      },
      Transaction: { Reference1: '', Reference2: '', Reference3: '', Reference4: '', Reference5: '' }
    };
    const res = await createPickup(body);
    if (res.HasErrors) {
      console.error('HasErrors:', res.Notifications);
      process.exit(1);
    }
    const id = res.ProcessedPickup?.ID ?? res.ProcessedPickup?.Reference1;
    console.log('Pickup ID / Reference:', id);
    console.log('GUID:', res.ProcessedPickup?.GUID);
    console.log('\n✓ CreatePickup OK');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
main();
