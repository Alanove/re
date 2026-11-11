# Postman Setup for CreateShipments API

## Correct Configuration

### Step 1: Create New Request
1. Open Postman
2. Click **New** → **HTTP Request**
3. Set method to **POST** (not GET!)

### Step 2: Set URL

**Try these endpoints in order:**

1. **Production Endpoint (Recommended):**
   ```
   https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc
   ```

2. **Alternative Production Endpoint:**
   ```
   https://ws.aramex.net/shippingapi/shipping/service_1_0.svc
   ```

3. **Dev Endpoint (if available):**
   ```
   https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc
   ```

⚠️ **Important:**
- Do NOT add `?wsdl` at the end
- Use POST method (not GET)
- The URL should end with `.svc` only
- If you get a timeout, try the production endpoint instead

### Step 3: Set Headers
Go to **Headers** tab and add:

| Key | Value |
|-----|-------|
| `Content-Type` | `text/xml; charset=utf-8` |
| `SOAPAction` | `http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments` |

### Step 4: Set Body
1. Go to **Body** tab
2. Select **raw**
3. Select **XML** from the dropdown (or leave as "Text")
4. Copy and paste the entire contents of `soap-request.xml`

### Step 5: Send Request
Click **Send** button

---

## Common Mistakes

❌ **Wrong:** Using GET method → Returns WSDL  
✅ **Correct:** Use POST method

❌ **Wrong:** URL with `?wsdl` → Returns WSDL  
✅ **Correct:** URL without `?wsdl`

❌ **Wrong:** Missing SOAPAction header → May not route to correct method  
✅ **Correct:** Include SOAPAction header

❌ **Wrong:** Empty body → No data sent  
✅ **Correct:** Include SOAP XML in body

---

## Expected Response

If configured correctly, you should receive either:
- **Success:** Shipment creation response with shipment details
- **Error:** Error response (not WSDL) indicating what's wrong with the data

If you still get WSDL back, check:
1. ✅ Method is POST (not GET)
2. ✅ URL doesn't have `?wsdl`
3. ✅ Headers are set correctly
4. ✅ Body contains the SOAP XML

---

## Troubleshooting Timeout Errors

If you get **"Request timed out"** error:

### 1. Try Production Endpoint Instead
The dev endpoint (`ws.dev.aramex.net`) might be slow or unavailable. Try:
```
https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc
```

### 2. Increase Postman Timeout
1. Go to **Settings** (gear icon) in Postman
2. Under **General**, increase **Request timeout** to 30000ms (30 seconds) or more

### 3. Check Network/Firewall
- Ensure your firewall isn't blocking the request
- Try from a different network if possible
- Check if VPN is interfering

### 4. Verify URL Format
Make sure the URL matches exactly (case-sensitive):
- ✅ `https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc`
- ❌ `https://ws.aramex.net/shippingapi.v2/shipping/service_1_0.svc` (wrong case)

### 5. Test with cURL
Try the same request with cURL to see if it's a Postman-specific issue:
```bash
curl -X POST 'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments' \
  --data @soap-request.xml \
  --max-time 30
```

### 6. Check SOAP Body Size
If your SOAP body is very large, it might be timing out. Try simplifying the request first.
