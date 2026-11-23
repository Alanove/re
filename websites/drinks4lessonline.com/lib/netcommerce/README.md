# Netcommerce / Mastercard Payment Gateway

This folder holds resources for the **Mastercard Payment Gateway** (Netcommerce / Credit Libanais) integration.

## Where do I enter my card?

We use **Hosted Checkout**: the customer does **not** enter the card on our site. After you click **Place order** with Credit Card selected, you are redirected to **Mastercard’s hosted payment page** (Credit Libanais / gateway). You enter the card number, expiry, and CVV **on that page**, then complete or cancel. You are then sent back to our site (`/checkout/complete` or `/checkout/cancel`).

## Test card numbers (for Hosted Checkout)

Use these **only** in the gateway’s test environment (e.g. with test merchant ID and test gateway URL). Do not use real cards in test.

**Mastercard test PANs:**

| Card number         | Use |
|---------------------|-----|
| 5186001700008785    | General test |
| 5186001700009726    | General test |
| 5186001700009908    | General test |
| 5186001700008876    | General test |
| 5186001700001434    | General test |

- **Expiry:** Any future date (e.g. 12/30).
- **CVV:** Any 3 digits (e.g. 123).

Your bank (Credit Libanais) or Mastercard may provide different test cards for your region; use those if specified.

## Contents

- **MastercardGatewayAPIPostmanCollection.json** – Postman collection for the Gateway API (Hosted Checkout, Hosted Session, Direct Payment, tokens, 3DS, etc.). Use with Postman; set environment variables: `host`, `merchantId`, `apiPassword`, `currency`, and others as described in the collection.

## Related code

- Payment gateway service: `src/services/paymentGateways/netcommerceService.ts`
- Env config in `.env.development` / `.env.production`:
  - `NETCOMMERCE_MERCHANT_ID`, `NETCOMMERCE_API_PASSWORD`, `NETCOMMERCE_GATEWAY_URL`
  - `NETCOMMERCE_MERCHANT_NAME` – display name on the gateway payment page
  - `NETCOMMERCE_PARTNER_SOLUTION_ID` – (optional) partner/solution identifier
  - `NETCOMMERCE_API_VERSION` – (optional) API version in path, default `100` (matches Postman collection). Try `70` if your gateway uses an older version.

The integration uses **INITIATE_CHECKOUT** with `checkoutMode: WEBSITE` and payload matching the Mastercard Postman collection (`order.id`, `order.amount`, `order.currency`, `order.description`, `interaction.operation`, `interaction.returnUrl`, `interaction.merchant`). If your gateway rejects these parameters, request the exact API specification from Credit Libanais/NetCommerce—some gateways use a customized API.
