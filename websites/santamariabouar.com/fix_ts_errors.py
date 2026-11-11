import re

file_path = "admin/controllers/transactionsController.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace all occurrences of "inv =>" inside array functions with "(inv: any) =>"
# Also replace "a =>", "b =>", etc where they are used like that, or just use regex
content = re.sub(r'\binv =>', '(inv: any) =>', content)
content = re.sub(r'\(inv\) =>', '(inv: any) =>', content)
content = re.sub(r'\bcredit =>', '(credit: any) =>', content)
content = re.sub(r'\(a, b\) =>', '(a: any, b: any) =>', content)
content = re.sub(r'\(id\) =>', '(id: any) =>', content)
content = re.sub(r'\b a =>', ' (a: any) =>', content)

# There is a TS2379 error at line 222.
# '{ ... invoiceAmounts: { [key: string]: number; } | undefined; ... }' is not assignable to
# '{ ... invoiceAmounts?: { [invoiceId: string]: number; }; ... }' with 'exactOptionalPropertyTypes: true'.
# The fix is to change `let parsedInvoiceAmounts: { [key: string]: number } | undefined;`
# to conditionally add `invoiceAmounts` to the object, or remove `| undefined` handling if possible,
# or change how the object is passed.

# Find the block around line 222
target = """                const transaction = await TransactionsController.transactionsService.createMultipleInvoicePayment({
                    invoiceIds: invoiceIds.map((id: string) => parseInt(id)),
                    invoiceAmounts: parsedInvoiceAmounts,
                    totalAmount,
                    date,
                    accountId: parseInt(accountId),
                    categoryId: parseInt(categoryId),
                    description: description || `Payment for ${invoiceIds.length} invoice(s)`,
                    createdBy: userId,
                    receiptImage: receiptImage || null
                });"""

replacement = """                
                const paymentReq: any = {
                    invoiceIds: invoiceIds.map((id: string) => parseInt(id)),
                    totalAmount,
                    date,
                    accountId: parseInt(accountId),
                    categoryId: parseInt(categoryId),
                    description: description || `Payment for ${invoiceIds.length} invoice(s)`,
                    createdBy: userId,
                    receiptImage: receiptImage || null
                };
                if (parsedInvoiceAmounts !== undefined) {
                    paymentReq.invoiceAmounts = parsedInvoiceAmounts;
                }
                
                const transaction = await TransactionsController.transactionsService.createMultipleInvoicePayment(paymentReq);"""

content = content.replace(target, replacement)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixes applied.")
