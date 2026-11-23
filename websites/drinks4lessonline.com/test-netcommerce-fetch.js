
// Using global fetch

async function testFetch() {
    const url = 'https://test-creditlibanais-netcommerce.gateway.mastercard.com/api/rest/version/70/merchant/TEST/session';
    console.log('Testing fetch to:', url);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from('merchant.TEST:PASSWORD').toString('base64')
            },
            body: JSON.stringify({
                apiOperation: "CREATE_CHECKOUT_SESSION",
                interaction: {
                    operation: "PURCHASE"
                }
            })
        });
        console.log('Response status:', response.status);
        const text = await response.text();
        console.log('Response text:', text.substring(0, 500));
    } catch (error) {
        console.error('Fetch caught error:', error);
        console.error('Error name:', error.name);
        console.error('Error stack:', error.stack);
    }
}

testFetch();
