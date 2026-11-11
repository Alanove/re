# Coding Standards

## Security

### CSRF Protection

All forms and state-changing AJAX requests (POST, PUT, DELETE) must include a CSRF token.

**1. Forms (EJS Templates)**
Ensure the CSRF token is included as a hidden input field in all forms:
```html
<input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

**2. AJAX Requests (Fetch/XHR)**
Include the CSRF token in the request headers:
```javascript
fetch('/api/endpoint', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': '<%= csrfToken %>'
    },
    body: JSON.stringify(data)
});
```

The server is configured to look for the token in the `_csrf` body field or the `CSRF-Token` (or `X-CSRF-Token`) header.
