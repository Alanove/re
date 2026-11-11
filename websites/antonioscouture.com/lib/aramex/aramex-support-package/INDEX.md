# Aramex Support Package - Contents

This folder contains all the necessary files to troubleshoot the NullReferenceException error with Aramex CreateShipment API.

## Files Included

1. **soap-request.xml** - The complete SOAP XML request that's causing the error
2. **request-data.json** - JSON representation of the same request data
3. **README.md** - Complete documentation with error details, Postman/cURL instructions, and questions for support

## Quick Start

### Option 1: Test in Postman
1. Open Postman
2. Create a new **POST** request to: `https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc`
   - **Important:** Do NOT add `?wsdl` to the URL
   - Make sure it's a POST request, not GET
3. Add headers:
   - `Content-Type: text/xml; charset=utf-8`
   - `SOAPAction: http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments`
4. In Body tab:
   - Select **raw**
   - Select **XML** from the dropdown (or leave as text)
   - Paste the contents of `soap-request.xml`
5. Click **Send** and share the response

### Option 2: Test with cURL
```bash
curl -X POST 'https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments' \
  --data @soap-request.xml
```

## Error Summary

**Error:** NullReferenceException - Object reference not set to an instance of an object  
**Account:** 72478367  
**Entity:** BEY  
**Country:** LB  

The error occurs at line 29 of Aramex's `Service_1_0.svc.vb` file but doesn't indicate which field is causing the issue.

## What We've Done

✅ Compared with working examples (CODS and PHP samples)  
✅ Added all extended PartyAddress fields (Longitude, Latitude, BuildingNumber, etc.)  
✅ Added ContainsDangerousGoods, Number, and ScheduledDelivery fields  
✅ Ensured all Contact fields have default values  
✅ Verified request structure matches official samples  

## Questions for Aramex Support

1. Which specific field is causing the NullReferenceException?
2. Are empty strings acceptable for optional fields or should they be omitted?
3. Is there any issue with the ThirdParty section having all empty fields?
4. Does the Version format matter? (we're using "v1.0")

See **README.md** for complete details and formatted documentation.
