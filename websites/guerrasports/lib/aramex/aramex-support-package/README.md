# Aramex CreateShipment - SOAP Request for Support

## Issue Summary

**Error:** `NullReferenceException - Object reference not set to an instance of an object`  
**API:** CreateShipments (SOAP)  
**Account:** 72478367  
**Entity:** BEY  
**Country:** LB  
**Endpoint:** `https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc`

## Error Details

The Aramex API is returning a NullReferenceException but not indicating which field is null or missing.

**Stack Trace indicates error at:**
```
Corp.ShippingAPI.FrontEnd.Shipping.Service_1_0.CreateShipments(ShipmentCreationRequest Request) 
in F:\\Work\\Corp.ShippingAPI\\Corp.ShippingAPI\\Corp.ShippingAPI.FrontEnd.Shipping\\Service_1_0.svc.vb:line  29
```

## What We've Done

✅ Compared with working examples (CODS and PHP samples)  
✅ Added all extended PartyAddress fields (Longitude, Latitude, BuildingNumber, etc.)  
✅ Added ContainsDangerousGoods, Number, and ScheduledDelivery fields  
✅ **Added ActualWeight** to Details section  
✅ **Updated Payment** to Cash on Delivery (Type: C, Option: CASH)  
✅ Ensured all Contact fields have default values  
✅ Verified request structure matches official samples  

## Full SOAP Request (XML)

```xml
<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"  xmlns:i0="http://ws.aramex.net/ShippingAPI/v1/" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" xmlns:msc="http://schemas.microsoft.com/ws/2005/12/wsdl/contract" xmlns:tns="http://ws.aramex.net/ShippingAPI/v1/"><soap:Body><ShipmentCreationRequest xmlns="http://ws.aramex.net/ShippingAPI/v1/"><Shipments><Reference1>ORDER-TEST-JSON-001</Reference1><Reference2>JSON-API-TEST</Reference2><Reference3>2026-02-11T09:27:36.980Z</Reference3><Shipper><Reference1>TEST-SENDER-001</Reference1><Reference2>JSON-API-TEST</Reference2><AccountNumber>72478367</AccountNumber><PartyAddress><Line1>Okaibe Highway</Line1><Line2></Line2><Line3></Line3><City>Tabarja</City><StateOrProvinceCode>Keserwan</StateOrProvinceCode><PostCode>0000</PostCode><CountryCode>LB</CountryCode><Longitude>0</Longitude><Latitude>0</Latitude><BuildingNumber></BuildingNumber><BuildingName></BuildingName><Floor></Floor><Apartment></Apartment><POBox></POBox><Description></Description></PartyAddress><Contact><Department></Department><PersonName>Guerra Sports</PersonName><Title></Title><CompanyName>Skyline Group LLC</CompanyName><PhoneNumber1>+961 3446411</PhoneNumber1><PhoneNumber1Ext></PhoneNumber1Ext><PhoneNumber2></PhoneNumber2><PhoneNumber2Ext></PhoneNumber2Ext><FaxNumber></FaxNumber><CellPhone>+961 3446411</CellPhone><EmailAddress>info@guerrasports.com</EmailAddress><Type></Type></Contact></Shipper><Consignee><Reference1>TEST-RECEIVER-001</Reference1><Reference2></Reference2><AccountNumber></AccountNumber><PartyAddress><Line1>123 Test Street</Line1><Line2>Apartment 4B</Line2><Line3></Line3><City>Beirut</City><StateOrProvinceCode>Beirut</StateOrProvinceCode><PostCode>1100</PostCode><CountryCode>LB</CountryCode><Longitude>0</Longitude><Latitude>0</Latitude><BuildingNumber></BuildingNumber><BuildingName></BuildingName><Floor></Floor><Apartment></Apartment><POBox></POBox><Description></Description></PartyAddress><Contact><Department></Department><PersonName>John Doe</PersonName><Title></Title><CompanyName>Test Company</CompanyName><PhoneNumber1>+9611234567</PhoneNumber1><PhoneNumber1Ext></PhoneNumber1Ext><PhoneNumber2></PhoneNumber2><PhoneNumber2Ext></PhoneNumber2Ext><FaxNumber></FaxNumber><CellPhone>+9611234567</CellPhone><EmailAddress>test@example.com</EmailAddress><Type></Type></Contact></Consignee><ThirdParty><Reference1></Reference1><Reference2></Reference2><AccountNumber></AccountNumber><PartyAddress><Line1></Line1><Line2></Line2><Line3></Line3><City></City><StateOrProvinceCode></StateOrProvinceCode><PostCode></PostCode><CountryCode></CountryCode><Longitude>0</Longitude><Latitude>0</Latitude><BuildingNumber></BuildingNumber><BuildingName></BuildingName><Floor></Floor><Apartment></Apartment><POBox></POBox><Description></Description></PartyAddress><Contact><Department></Department><PersonName></PersonName><Title></Title><CompanyName></CompanyName><PhoneNumber1></PhoneNumber1><PhoneNumber1Ext></PhoneNumber1Ext><PhoneNumber2></PhoneNumber2><PhoneNumber2Ext></PhoneNumber2Ext><FaxNumber></FaxNumber><CellPhone></CellPhone><EmailAddress></EmailAddress><Type></Type></Contact></ThirdParty><ShippingDateTime>2026-02-11T09:27:36.981Z</ShippingDateTime><DueDate>2026-02-12T09:27:36.981Z</DueDate><Comments>Test shipment via JSON API</Comments><PickupLocation>Reception</PickupLocation><OperationsInstructions></OperationsInstructions><AccountingInstrcutions></AccountingInstrcutions><Details><Dimensions><Length>30</Length><Width>20</Width><Height>15</Height><Unit>cm</Unit></Dimensions><ActualWeight><Unit>Kg</Unit><Value>2.5</Value></ActualWeight><ChargeableWeight><Unit>Kg</Unit><Value>2.5</Value></ChargeableWeight><DescriptionOfGoods>Test products for JSON API verification</DescriptionOfGoods><GoodsOriginCountry>LB</GoodsOriginCountry><NumberOfPieces>3</NumberOfPieces><ProductGroup>DOM</ProductGroup><ProductType>OND</ProductType><PaymentType>C</PaymentType><PaymentOptions>CASH</PaymentOptions><Services></Services><Items><PackageType>Box</PackageType><Quantity>1</Quantity><Weight><Unit>Kg</Unit><Value>1.5</Value></Weight><Comments>Test Product 1</Comments><Reference>TEST001</Reference></Items><Items><PackageType>Box</PackageType><Quantity>2</Quantity><Weight><Unit>Kg</Unit><Value>0.5</Value></Weight><Comments>Test Product 2</Comments><Reference>TEST002</Reference></Items><ContainsDangerousGoods>false</ContainsDangerousGoods></Details><ForeignHAWB>ORDER-TEST-JSON-001</ForeignHAWB><TransportType>0</TransportType><PickupGUID></PickupGUID><Number></Number><ScheduledDelivery xsi:nil="true"></ScheduledDelivery></Shipments><q3:ClientInfo xmlns:q3="http://ws.aramex.net/ShippingAPI/v1/"><q3:UserName>info@guerrasports.com</q3:UserName><q3:Password>Aramexguerra25#</q3:Password><q3:Version>v1.0</q3:Version><q3:AccountNumber>72478367</q3:AccountNumber><q3:AccountPin>316198</q3:AccountPin><q3:AccountEntity>BEY</q3:AccountEntity><q3:AccountCountryCode>LB</q3:AccountCountryCode></q3:ClientInfo><q3:Transaction xmlns:q3="http://ws.aramex.net/ShippingAPI/v1/"><q3:Reference1>001</q3:Reference1><q3:Reference2></q3:Reference2><q3:Reference3></q3:Reference3><q3:Reference4></q3:Reference4><q3:Reference5></q3:Reference5></q3:Transaction><q3:LabelInfo xmlns:q3="http://ws.aramex.net/ShippingAPI/v1/"><q3:ReportID>9729</q3:ReportID><q3:ReportType>URL</q3:ReportType></q3:LabelInfo></ShipmentCreationRequest></soap:Body></soap:Envelope>
```

## How to Test in Postman

1. **Create new POST request**
2. **URL:** `https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc`
   - **Important:** Use POST method, NOT GET
   - Do NOT add `?wsdl` to the URL
3. **Headers:**
   - `Content-Type`: `text/xml; charset=utf-8`
   - `SOAPAction`: `http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments`
4. **Body (raw XML):** Copy the SOAP XML above
5. **Send** and share the response with support

## cURL Command

```bash
curl -X POST 'https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments' \
  --data @soap-request.xml
```

## Questions for Aramex Support

1. **Which field is causing the NullReferenceException?**
   - The error message doesn't indicate which field is null/missing

2. **Are all required PartyAddress fields included?**
   - We've added: Longitude, Latitude, BuildingNumber, BuildingName, Floor, Apartment, POBox, Description

3. **Are empty strings acceptable for optional fields or should they be omitted entirely?**
   - Particularly for ThirdParty section where all fields are empty

4. **Does the SOAP Version matter?**
   - We're using `v1.0` in ClientInfo

5. **Is there a minimum test account we can use to validate the request structure?**
