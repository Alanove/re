# Aramex CreateShipment - Missing Fields Analysis

## Comparison: Working Examples vs Our Implementation

### CRITICAL MISSING FIELDS FOUND:

#### 1. **PartyAddress - Missing Extended Fields**

**Working Example Has:**
```json
"PartyAddress": {
    "Line1": "address",
    "Line2": "",
    "Line3": "",
    "City": "Beirut",
    "StateOrProvinceCode": "",
    "PostCode": "",
    "CountryCode": "LB",
    "Longitude": 0,           // ❌ MISSING IN OUR CODE
    "Latitude": 0,            // ❌ MISSING IN OUR CODE
    "BuildingNumber": null,   // ❌ MISSING IN OUR CODE
    "BuildingName": "",       // ❌ MISSING IN OUR CODE
    "Floor": "",              // ❌ MISSING IN OUR CODE
    "Apartment": null,        // ❌ MISSING IN OUR CODE
    "POBox": null,            // ❌ MISSING IN OUR CODE
    "Description": null       // ❌ MISSING IN OUR CODE
}
```

**Our Current Code:**
```javascript
PartyAddress: {
    Line1: '',
    Line2: '',
    Line3: '',
    City: '',
    StateOrProvinceCode: '',
    PostCode: '',
    CountryCode: ''
    // Missing: Longitude, Latitude, BuildingNumber, BuildingName, Floor, Apartment, POBox, Description
}
```

#### 2. **Details Section - Missing Fields**

**Working Example Has:**
```json
"Details": {
    "CustomsValueAmount": {      // ✅ We have this
        "CurrencyCode": "USD",
        "Value": 0
    },
    "CashAdditionalAmount": {    // ✅ We have this
        "CurrencyCode": "USD",
        " Value": 0.0
    },
    "InsuranceAmount": null,      // ✅ We have this
    "CashAdditionalAmountDescription": "",  // ✅ We have this
    "CollectAmount": null,        // ✅ We have this
    "CashOnDeliveryAmount": {    // ✅ We have this
        "CurrencyCode": "USD",
        "Value": 0.0
    },
    "AdditionalProperties": null,  // ✅ We have this
    "ContainsDangerousGoods": false,  // ❌ MISSING IN OUR CODE
    "DeliveryInstructions": null      // ❌ MISSING IN OUR CODE (might be optional)
}
```

#### 3. **Shipment Level - Missing Fields**

**Working Example Has:**
```json
{
    "Number": "",                      // ❌ MISSING IN OUR CODE
    "ScheduledDelivery": null          // ❌ MISSING IN OUR CODE
}
```

#### 4. **ClientInfo - Missing Field**

**Working Example:**
```json
"ClientInfo": {
    "Source": 0    // ❌ MISSING IN OUR CODE
}
```

**PHP Example:**
```php
'AccountCountryCode' => 'JO',
'AccountEntity' => 'AMM',
'AccountNumber' => '20016',
'AccountPin' => '221321',
'UserName' => 'reem@reem.com',
'Password' => '123456789',
'Version' => '1.0'
// Note: PHP example doesn't show Source field
```

## RECOMMENDED FIXES

### Priority 1 - Add These Required Fields:

1. **Add to ALL PartyAddress objects (Shipper, Consignee, ThirdParty):**
   - Longitude: 0
   - Latitude: 0
   - BuildingNumber: null or ""
   - BuildingName: ""
   - Floor: ""
   - Apartment: null or ""
   - POBox: null or ""
   - Description: null or ""

2. **Add to Details:**
   - ContainsDangerousGoods: false

3. **Add to Shipment root:**
   - Number: ""
   - ScheduledDelivery: null

4. **Add to ClientInfo:**
   - Source: 0 or 52 (check what value we currently use in rates)

### Priority 2 - Verify Field Order

The SOAP library constructs XML based on JavaScript object key order. Aramex uses .NET DataContract which is sensitive to element order. Make sure fields appear in the same order as the working examples.

## CODE CHANGES NEEDED

File: `src/aramex/aramex-service.js`, function `buildShipmentParams`

### Change 1: Update PartyAddress template (3 places: Shipper, Consignee, ThirdParty)

### Change 2: Add ContainsDangerousGoods to Details

### Change 3: Add Number and ScheduledDelivery to shipment root

### Change 4: Verify ClientInfo has Source field
