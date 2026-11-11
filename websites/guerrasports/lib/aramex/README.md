# Aramex Shipping Service - Complete Node.js Implementation

A comprehensive Node.js service that provides all Aramex shipping functionality including rate calculation, shipment creation, tracking, and label printing. This is a complete port of the WooCommerce Aramex plugin to Node.js.

## Features

- ✅ **Rate Calculation** - Calculate shipping rates for domestic and international shipments
- ✅ **Shipment Creation** - Create shipments with full support for COD, insurance, customs, and attachments
- ✅ **Tracking** - Track one or multiple shipments
- ✅ **Label Printing** - Generate shipping labels
- ✅ RESTful API with Express.js
- ✅ SOAP API integration with Aramex
- ✅ Configurable via environment variables
- ✅ Comprehensive error handling
- ✅ Logging support

## Installation

```bash
cd aramex
npm install
```

## Configuration

Set the following environment variables or modify the config in `api-server.js`:

```bash
# Aramex Credentials
ARAMEX_ACCOUNT_COUNTRY_CODE=LB
ARAMEX_ACCOUNT_ENTITY=BEY
ARAMEX_ACCOUNT_NUMBER=your_account_number
ARAMEX_ACCOUNT_PIN=your_account_pin
ARAMEX_USER_NAME=your_email@example.com
ARAMEX_PASSWORD=your_password

# Shipper Details
ARAMEX_SHIPPER_NAME=Your Company Name
ARAMEX_SHIPPER_COMPANY=Your Company LLC
ARAMEX_SHIPPER_ADDRESS=Your Address
ARAMEX_SHIPPER_CITY=Your City
ARAMEX_SHIPPER_STATE=Your State
ARAMEX_SHIPPER_POSTALCODE=0000
ARAMEX_SHIPPER_COUNTRY=LB
ARAMEX_SHIPPER_PHONE=+1234567890
ARAMEX_SHIPPER_EMAIL=your_email@example.com

# Settings
ARAMEX_SANDBOX=false
ARAMEX_CURRENCY=USD
ARAMEX_ROUND_UP=true
ARAMEX_REPORT_ID=9729
ARAMEX_LOGGING=true
```

## Usage

### Start the API Server

```bash
npm start
```

The server will start on port 3000 (or the port specified in the `PORT` environment variable).

## API Endpoints

### 1. Calculate Shipping Rates

**POST** `/api/calculate-shipping`

Calculate shipping rates for a package.

**Request Body:**
```json
{
  "items": [
    {
      "name": "Product Name",
      "quantity": 2,
      "weight": 1.5,
      "length": 35,
      "width": 15,
      "height": 10,
      "regularPrice": 50.00,
      "salePrice": 45.00,
      "currency": "USD"
    }
  ],
  "destination": {
    "country": "IN",
    "state": "JH",
    "city": "Ranchi",
    "postcode": "834002"
  },
  "weightUnit": "kg",
  "dimensionUnit": "cm"
}
```

**Response:**
```json
{
  "success": true,
  "rates": [
    {
      "id": "PPX_aramex",
      "label": "Aramex Priority Parcel Express",
      "cost": 25.50,
      "currency": "USD",
      "method": "PPX",
      "productGroup": "EXP"
    }
  ],
  "count": 1
}
```

### 2. Create Shipment

**POST** `/api/create-shipment`

Create a new shipment.

**Request Body:**
```json
{
  "shipper": {
    "reference1": "REF001",
    "name": "Sender Name",
    "company": "Sender Company",
    "address": {
      "line1": "123 Main St"
    },
    "city": "Beirut",
    "state": "Beirut",
    "postalcode": "1100",
    "country": "LB",
    "phone": "+9611234567",
    "email": "sender@example.com"
  },
  "consignee": {
    "reference1": "REF002",
    "name": "Receiver Name",
    "company": "Receiver Company",
    "address": {
      "line1": "456 Oak Ave"
    },
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalcode": "400001",
    "country": "IN",
    "phone": "+911234567890",
    "email": "receiver@example.com"
  },
  "items": [
    {
      "name": "Product 1",
      "quantity": 2,
      "weight": 1.5,
      "length": 30,
      "width": 20,
      "height": 10,
      "price": 100.00,
      "currency": "USD",
      "commodityCode": "12345678",
      "weightUnit": "kg",
      "dimensionUnit": "cm"
    }
  ],
  "productGroup": "EXP",
  "productType": "PPX",
  "paymentType": "P",
  "paymentOptions": "",
  "totalWeight": 3.0,
  "weightUnit": "kg",
  "numberOfPieces": 2,
  "descriptionOfGoods": "Electronics",
  "goodsOriginCountry": "LB",
  "reference1": "ORDER-001",
  "services": ["CODS"],
  "cashOnDeliveryAmount": 200.00,
  "cashOnDeliveryCurrency": "USD",
  "customsValue": 200.00,
  "customsValueCurrency": "USD",
  "insuranceAmount": 200.00,
  "insuranceCurrency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "shipmentId": "1234567890",
  "labelUrl": "https://ws.aramex.net/...",
  "reference1": "ORDER-001",
  "reference2": "",
  "reference3": ""
}
```

### 3. Track Shipments

**POST** `/api/track-shipments`

Track one or more shipments.

**Request Body:**
```json
{
  "shipmentNumbers": ["1234567890", "0987654321"],
  "getLastUpdateOnly": false
}
```

**Response:**
```json
{
  "success": true,
  "trackingResults": {
    "1234567890": [
      {
        "updateLocation": "Beirut",
        "updateDateTime": "2025-01-31T10:00:00",
        "updateDescription": "Shipment picked up",
        "comments": ""
      },
      {
        "updateLocation": "Mumbai",
        "updateDateTime": "2025-02-01T15:30:00",
        "updateDescription": "Out for delivery",
        "comments": ""
      }
    ]
  }
}
```

**GET** `/api/track/:shipmentNumber?lastUpdateOnly=true`

Track a single shipment by shipment number.

### 4. Print Label

**POST** `/api/print-label`

Print label for a shipment.

**Request Body:**
```json
{
  "shipmentNumber": "1234567890",
  "reference1": "ORDER-001",
  "reportId": 9729
}
```

**Response:**
```json
{
  "success": true,
  "labelUrl": "https://ws.aramex.net/..."
}
```

### 5. Health Check

**GET** `/api/health`

Health check endpoint.

### 6. Get Configuration

**GET** `/api/config`

Get current configuration (without sensitive data).

## Example cURL Requests

### Calculate Shipping

```bash
curl -X POST http://localhost:3000/api/calculate-shipping \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "name": "Test Product",
      "quantity": 1,
      "weight": 1.0,
      "length": 30,
      "width": 20,
      "height": 10,
      "regularPrice": 100.00,
      "currency": "USD"
    }],
    "destination": {
      "country": "IN",
      "state": "JH",
      "city": "Ranchi",
      "postcode": "834002"
    }
  }'
```

### Create Shipment

```bash
curl -X POST http://localhost:3000/api/create-shipment \
  -H "Content-Type: application/json" \
  -d '{
    "shipper": {
      "name": "Sender",
      "city": "Beirut",
      "country": "LB",
      "phone": "+9611234567"
    },
    "consignee": {
      "name": "Receiver",
      "city": "Mumbai",
      "country": "IN",
      "phone": "+911234567890"
    },
    "items": [{
      "name": "Product",
      "quantity": 1,
      "weight": 1.0,
      "price": 100.00
    }],
    "productGroup": "EXP",
    "productType": "PPX",
    "totalWeight": 1.0
  }'
```

### Track Shipment

```bash
curl -X POST http://localhost:3000/api/track-shipments \
  -H "Content-Type: application/json" \
  -d '{
    "shipmentNumbers": ["1234567890"]
  }'
```

Or using GET:

```bash
curl http://localhost:3000/api/track/1234567890
```

## Code Structure

### aramex-service.js

Core service class that handles:
- Rate calculation
- Shipment creation
- Tracking
- Label printing
- SOAP API communication
- Error handling

### api-server.js

Express.js server that provides:
- RESTful API endpoints
- Request validation
- Error handling
- Configuration management

## Advanced Features

### Cash on Delivery (COD)

Include `cashOnDeliveryAmount` and `cashOnDeliveryCurrency` in the shipment data, and add "CODS" to the services array.

### Insurance

Include `insuranceAmount` and `insuranceCurrency` in the shipment data.

### Customs Information

Include `customsValue` and `customsValueCurrency` in the shipment data.

### Additional Properties

For customs clearance, IOSS, tax IDs, etc., include an `additionalProperties` array:

```json
{
  "additionalProperties": [
    {
      "CategoryName": "CustomsClearance",
      "Name": "IOSS",
      "Value": "IM1234567890"
    },
    {
      "CategoryName": "CustomsClearance",
      "Name": "ShipperTaxIdVATEINNumber",
      "Value": "TAX123456"
    }
  ]
}
```

### Attachments

Include an `attachments` array with file data:

```json
{
  "attachments": [
    {
      "FileName": "invoice",
      "FileExtension": "pdf",
      "FileContents": "base64_encoded_file_content"
    }
  ]
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

## Shipping Methods

### Domestic Methods
BLK, BLT, CDA, CDS, CGO, COM, DEC, EMD, FIX, LGS, OND, ONP, P24, P48, PEC, PEX, SFC, SMD, SMP, SDD, HVY, SPD, SPL, LEX

### International Methods
DPX, EDX, EPX, GDX, GPX, IBD, PDX, PLX, PPX, ABX, PXP, DGX, DGG

## License

MIT
