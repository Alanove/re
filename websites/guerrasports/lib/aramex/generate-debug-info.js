/**
 * SOAP XML Debug Helper for Aramex Support
 * 
 * This script helps you capture and format the SOAP XML request
 * to send to Aramex support for debugging NullReferenceException
 */

const fs = require('fs');
const path = require('path');

console.log('=== Aramex SOAP Debug Helper ===\n');

const debugDir = path.join(__dirname, 'debug');

// Check if debug files exist
const requestFile = path.join(debugDir, 'last-soap-request.xml');
const responseFile = path.join(debugDir, 'last-soap-response.xml');

if (fs.existsSync(requestFile)) {
    const requestXml = fs.readFileSync(requestFile, 'utf8');

    console.log('✓ Found SOAP Request XML\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RAW SOAP REQUEST (Send this to Aramex Support):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(requestXml);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Create Postman collection
    const postmanCollection = {
        "info": {
            "name": "Aramex CreateShipments Debug",
            "description": "Debug request for NullReferenceException issue",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            {
                "name": "CreateShipments SOAP Request",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "text/xml; charset=utf-8"
                        },
                        {
                            "key": "SOAPAction",
                            "value": "http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": requestXml
                    },
                    "url": {
                        "raw": "https://ws.aramex.net/shippingapi.v2/shipping/service_1_0.svc",
                        "protocol": "https",
                        "host": ["ws", "aramex", "net"],
                        "path": ["shippingapi.v2", "shipping", "service_1_0.svc"]
                    }
                },
                "response": []
            }
        ]
    };

    const collectionFile = path.join(debugDir, 'aramex-debug-postman-collection.json');
    fs.writeFileSync(collectionFile, JSON.stringify(postmanCollection, null, 2));
    console.log(`✓ Postman Collection saved to: ${collectionFile}\n`);

    // Create curl command
    const curlCommand = `curl -X POST 'https://ws.aramex.net/shippingapi.v2/shipping/service_1_0.svc' \\
  -H 'Content-Type: text/xml; charset=utf-8' \\
  -H 'SOAPAction: http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CreateShipments' \\
  --data '${requestXml.replace(/'/g, "'\\''")}'\n`;

    const curlFile = path.join(debugDir, 'aramex-debug-curl.sh');
    fs.writeFileSync(curlFile, curlCommand);
    console.log(`✓ cURL Command saved to: ${curlFile}\n`);

} else {
    console.log('✗ No debug files found. Run the test first to generate SOAP request:\n');
    console.log('  cd lib/aramex');
    console.log('  node test-create-shipment.js\n');
}

if (fs.existsSync(responseFile)) {
    const responseXml = fs.readFileSync(responseFile, 'utf8');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SOAP RESPONSE (Error Details):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(responseXml);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

console.log('\n=== How to Send to Aramex Support ===\n');
console.log('Option 1 - Use Postman:');
console.log('  1. Import the collection: lib/aramex/debug/aramex-debug-postman-collection.json');
console.log('  2. Send the request and share the screenshot with Aramex\n');
console.log('Option 2 - Use cURL:');
console.log('  1. Run the command in: lib/aramex/debug/aramex-debug-curl.sh');
console.log('  2. Share the output with Aramex\n');
console.log('Option 3 - Copy Raw XML:');
console.log('  1. Copy the SOAP Request XML shown above');
console.log('  2. Tell Aramex support you\'re getting NullReferenceException');
console.log('  3. Ask them which field is missing/null in your request\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
