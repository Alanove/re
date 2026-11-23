# NetCommerce / Mastercard Credit Card Integration – Gap Analysis

Comparison of the **WooCommerce Mastercard sample** (`lib/gateway-woocommerce-mastercard-module-main`) with **our implementation** (`src/services/paymentGateways/netcommerceService.ts`) and related checkout flow.

---

## 1. API Version

| Aspect | Sample (WooCommerce) | Our solution |
|--------|----------------------|--------------|
| API version | **100** (`version/100`) | **70** (from env `NETCOMMERCE_GATEWAY_URL`) |

**Gap:** We use version 70; the sample uses 100. Newer gateway features and Hosted Checkout behavior may require a specific version. Confirm with Credit Libanais / NetCommerce which version to use and align env or code.

**Action:** Consider upgrading to API version 100 if the gateway supports it, or document that 70 is required.

---

## 2. Create Checkout Session Payload

| Field | Sample | Our solution |
|-------|--------|--------------|
| `apiOperation` | `CREATE_CHECKOUT_SESSION` or `INITIATE_CHECKOUT` | `CREATE_CHECKOUT_SESSION` ✓ |
| `partnerSolutionId` | Yes (e.g. `WC_x.x_FINGENT_1.5.1.1`) | **Missing** |
| `order.notificationUrl` | Yes (webhook URL) | **Missing** |
| `order.reference` | Yes (internal order id) | **Missing** |
| `order.id` | Prefixed gateway order id | We use `ORDER-{orderId}-{timestamp}` ✓ |
| `billing` | Full address (street, city, postcodeZip, country ISO3, etc.) | **Missing** |
| `shipping` | Full address + contact (or null if virtual) | **Missing** |
| `customer` | email, firstName, lastName | **Missing** |
| `transaction` | `reference`, `source: "INTERNET"` | **Missing** |
| `interaction` | returnUrl, displayControl, operation | We send returnUrl, cancelUrl, merchant name, displayControl ✓ |

**Gap:** Our session payload is minimal. The sample sends billing, shipping, customer, transaction, webhook URL, and reference. Omitting these can affect:

- Risk/compliance and 3DS
- Webhook-based confirmation
- Correct order association (reference)

**Action:** Add to `processPayment()` payload (when data is available):

- `order.notificationUrl` (webhook endpoint)
- `order.reference` (our order id)
- `partnerSolutionId` (fixed string for our app)
- `billing` / `shipping` / `customer` from checkout data
- `transaction: { reference: txnRef, source: "INTERNET" }`

---

## 3. Return URL / Callback and Confirmation

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Return URL | Includes query params for `order_id` (gateway), `resultIndicator`, etc. | We use `checkout/complete?orderId={ourId}` ✓ |
| Confirmation method | **retrieveOrder(gateway_order_id)** to get order + transactions and validate result | **retrieveSession(sessionId)** and check `result === 'SUCCESS'` |
| successIndicator | Stored when creating session; compared with resultIndicator on return (Hosted Checkout) | Not used |

**Gap:** Sample confirms payment by **retrieving the order** by gateway order id and checking transaction result. We confirm by **retrieving the session**. Both can work, but:

- **retrieveOrder** returns full order and transaction list (e.g. PAYMENT, CAPTURE) and is what the sample uses for final success/failure and order notes.
- We don’t pass or store the **gateway order id** in the return URL; we only have our internal `orderId` and stored `sessionId`. So we rely on session content for confirmation.

**Action:**

- Keep using `retrieveSession` if the gateway returns enough in the session (e.g. order id, result, transaction id). Ensure we validate `result === 'SUCCESS'` and, if present, transaction type (e.g. PAYMENT/CAPTURE).
- Optionally: store gateway order id when creating the session (from response) and add a **retrieveOrder** path for confirmation and for storing transaction id / auth code for refunds and support.

---

## 4. Webhook (Server-to-Server Notification)

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Webhook URL | Sent as `order.notificationUrl` | Not sent |
| Webhook handler | Validates `x_notification_secret`, parses JSON, updates order status (e.g. CHECKOUT_VIA_WEBSITE, SUCCESS/FAILED) | **None** |

**Gap:** We have no webhook. If the user closes the browser before hitting our return URL, we never mark the order as paid. The sample uses webhooks to update order status even when the user doesn’t return.

**Action:**

- Add a webhook endpoint (e.g. `POST /api/webhooks/netcommerce`).
- Configure a secret and validate `x_notification_secret` (or equivalent header).
- In session creation, set `order.notificationUrl` to this URL.
- In the handler: parse payload, resolve order (e.g. by `order.id` or `order.reference`), verify amount/currency, then update order and transaction status (e.g. paid / failed).

---

## 5. Response Validation

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Session creation | `validateCheckoutSessionResponse`: `result === 'SUCCESS'`, `session.id` present; uses `error.explanation` on failure | We check `result === 'SUCCESS'` and `session.id` ✓ |
| Approval | `isApproved(response)`: `gatewayCode` in `['APPROVED','APPROVED_AUTO']` | Not checked on transaction |

**Gap:** We don’t check gateway approval codes (e.g. APPROVED, APPROVED_AUTO) when confirming payment. We only check session/result.

**Action:** When confirming (in `checkoutComplete` or in a shared validator), if the gateway returns transaction/gatewayCode, ensure we treat only APPROVED/APPROVED_AUTO as success (and map DECLINED, EXPIRED_CARD, etc. to failure).

---

## 6. Refunds

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Refund API | `refund(order_id, txn_id, amount, currency)` – new txn id e.g. `refund-{txn_id}` | **Not implemented** – returns “Refund not fully implemented” |

**Gap:** We cannot refund NetCommerce payments. The sample uses gateway order id + capture/pay transaction id.

**Action:**

- Store gateway order id and capture/pay transaction id when we confirm payment (from session or from retrieveOrder).
- Implement `refundPayment` (or equivalent) with signature like `refundPayment(orderId, transactionId, amount, currency)` and call the gateway refund endpoint (e.g. PUT order/{orderId}/transaction/{refundTxnId} with apiOperation REFUND).

---

## 7. Void / Capture (Auth-and-Capture)

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Auth-only mode | Optional: AUTHORIZE then later CAPTURE or VOID | We only do PURCHASE (immediate capture) |
| Void | voidTxn(order_id, txn_id) | Not implemented |
| Capture | captureTxn(order_id, txn_id, amount, currency) | Not implemented |

**Gap:** We don’t support auth-and-capture or void. Acceptable if you only need immediate charge.

**Action:** Only add if business requires: optional authorize-only flow, then capture or void in admin.

---

## 8. 3D Secure

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| 3DS | Full flow: check3dsEnrollment, redirect to ACS, process3dsResult, then PAY | **Not implemented** |

**Gap:** No 3DS. May be required for some cards or regions (e.g. SCA).

**Action:** If the gateway mandates 3DS for Hosted Checkout, the current Hosted Checkout flow may still run 3DS on the gateway’s page. Confirm with NetCommerce. If you later move to Hosted Session / embedded form, you’ll need to implement 3DS (check enrollment, redirect, process result) similar to the sample.

---

## 9. Saved Cards / Tokenization

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Tokens | createCardToken(session_id), update_session with token, saved payment methods | **Not implemented** |

**Gap:** We don’t support “save card” or paying with a stored token.

**Action:** Defer unless required; then add token creation after payment and use token in future PAY/update_session requests.

---

## 10. Error Handling and User Messages

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Gateway codes | Maps DECLINED, EXPIRED_CARD, TIMED_OUT, ACQUIRER_SYSTEM_ERROR, etc. to user-facing messages | We return generic or gateway explanation only |

**Gap:** We don’t map gateway response codes to clear, localized messages.

**Action:** Map `result.error.explanation` and `response.gatewayCode` (e.g. DECLINED, EXPIRED_CARD) to user-friendly messages and/or locale keys.

---

## 11. Hosted Checkout Redirect URL

| Aspect | Sample | Our solution |
|--------|--------|--------------|
| Redirect | `https://{gatewayHost}/checkout/hostedCheckout?checkout.session.id={session.id}` | Same pattern: we use baseUrl + `/checkout/hostedCheckout?checkout.session.id=...` ✓ |

No gap; alignment is correct.

---

## 12. Session Retrieval URL

We call:

- `GET {gatewayUrl}/merchant/{merchantId}/session/{sessionId}`

Sample uses the same base URL pattern (with their version). Ensure `gatewayUrl` in env includes the path up to and including `merchant/{merchantId}` (e.g. `.../api/rest/version/70/merchant/MERCHANT_ID`) or that we build the path consistently. Current code uses `gatewayUrl` as base and appends `/merchant/.../session/...`; if `gatewayUrl` already contains `merchant/...`, we might double it. Verify `env.config` and netcommerceService URL construction.

---

## Summary: Recommended Fix Order

1. **High:** Add to session payload: `order.reference`, `order.notificationUrl`, `partnerSolutionId`, and optionally `billing`/`shipping`/`customer`/`transaction` when available.
2. **High:** Implement webhook endpoint and set `order.notificationUrl` so payments are confirmed even if the user doesn’t return.
3. **High:** Implement refunds: store gateway order id and transaction id; add refund API and call gateway refund.
4. **Medium:** Confirm payment using gateway approval (e.g. APPROVED/APPROVED_AUTO) when present; optionally use retrieveOrder for confirmation and for storing transaction id.
5. **Medium:** Map gateway error codes to user-facing messages.
6. **Low:** Align API version (70 vs 100) with gateway documentation.
7. **Later:** 3DS (if needed for Hosted Session); void/capture; saved cards.

---

## Implemented (after gap analysis)

- **Session payload:** Added `partnerSolutionId`, `order.reference`, optional `order.notificationUrl` (env `NETCOMMERCE_WEBHOOK_URL`), `customer` (email, firstName, lastName from PaymentData), optional `billing` (from PaymentData.billingAddress), and `transaction.reference` / `transaction.source`.
- **Controller:** Checkout now passes `customerName` and `billingAddress` into `processPayment` for NetCommerce.
- **Error messages:** Gateway codes (DECLINED, EXPIRED_CARD, TIMED_OUT, etc.) are mapped to user-facing messages in `netcommerceService`.

Still to do: webhook endpoint and handler, full refund implementation (store gateway order id + txn id; call refund API), optional retrieveOrder confirmation, API version alignment.

---

## References

- Sample gateway service: `lib/gateway-woocommerce-mastercard-module-main/includes/class-gateway-service.php`
- Sample gateway (flow, return, webhook): `lib/gateway-woocommerce-mastercard-module-main/includes/class-gateway.php`
- Our service: `src/services/paymentGateways/netcommerceService.ts`
- Our checkout complete: `src/controllers/shopController.ts` (`checkoutComplete`)
- Env: `NETCOMMERCE_GATEWAY_URL`, `NETCOMMERCE_MERCHANT_ID`, `NETCOMMERCE_API_PASSWORD`, optional `NETCOMMERCE_WEBHOOK_URL`
