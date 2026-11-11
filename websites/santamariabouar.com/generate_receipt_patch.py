import os

file_path = "admin/controllers/transactionsController.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the end of the class
target = """            res.status(500).json({ 
                success: false, 
                message: 'Error generating receipt' 
            });
        }
    }
}
"""

replacement = """            res.status(500).json({ 
                success: false, 
                message: 'Error generating receipt' 
            });
        }
    }

    static async generateCombinedReceiptPost(req: Request, res: Response) {
        try {
            const { transactionIds } = req.body;
            
            if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Transaction IDs are required' 
                });
            }

            // Mark all transactions as having receipt generated
            for (const id of transactionIds) {
                const transaction = await TransactionsController.transactionsService.getTransactionById(parseInt(id));
                if (transaction && transaction.type === 'income') {
                    await TransactionsController.transactionsService.updateTransaction(transaction.id, {
                        receiptGenerated: true
                    });
                }
            }

            const receiptUrl = `/admin/transactions/combined-receipt?ids=${transactionIds.join(',')}`;

            res.json({
                success: true,
                receiptUrl: receiptUrl,
                message: 'Combined receipt generated successfully'
            });
        } catch (error) {
            console.error('Error generating combined receipt:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error generating combined receipt' 
            });
        }
    }

    static async viewCombinedReceipt(req: Request, res: Response) {
        try {
            const idsStr = req.query.ids as string;
            if (!idsStr) {
                return res.status(400).render('admin/error', { message: 'No transaction IDs provided', error: null });
            }

            const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length === 0) {
                return res.status(400).render('admin/error', { message: 'Invalid transaction IDs', error: null });
            }

            // Fetch all transactions
            const transactions = [];
            for (const id of ids) {
                const tx = await TransactionsController.transactionsService.getTransactionById(id);
                if (tx) transactions.push(tx);
            }

            if (transactions.length === 0) {
                return res.status(404).render('admin/error', { message: 'Transactions not found', error: null });
            }

            // Aggregate transaction data
            const firstTx = transactions[0];
            let totalAmount = 0;
            const descriptions: string[] = [];
            let latestDate = new Date(0);

            transactions.forEach(tx => {
                totalAmount += tx.amount;
                if (tx.description && !descriptions.includes(tx.description)) {
                    descriptions.push(tx.description);
                }
                const txDate = new Date(tx.date);
                if (txDate > latestDate) {
                    latestDate = txDate;
                }
            });

            // Prevent descriptions array from getting too absurdly long on the receipt (which fits max ~1 line)
            let combinedDesc = descriptions.join(' + ');
            if (combinedDesc.length > 100) {
               combinedDesc = combinedDesc.substring(0, 97) + '...';
            }

            const combinedTransaction = {
                id: ids.join('-'),
                amount: totalAmount,
                description: combinedDesc || 'Combined Payment',
                date: latestDate.toISOString(),
                categoryId: firstTx.categoryId,
                apartmentId: firstTx.apartmentId,
                type: 'income',
                accountId: firstTx.accountId,
                createdAt: firstTx.createdAt
            };

            // Get site settings for logo
            const siteSettings = await TransactionsController.siteSettingsService.getAllSettings();
            
            // Get category
            const category = await TransactionsController.categoriesService.getCategoryById(firstTx.categoryId);
            
            // Get apartment and owner info
            let apartment = null;
            let owner = null;
            let apartmentPayments: any[] = [];
            let allApartmentPayments: any[] = [];
            let unpaidYears: number[] = [];
            let unpaidInvoices: any[] = [];
            let creditInvoices: any[] = [];
            let lastPaidInvoice: any = null;
            let currentPaidInvoices: any[] = [];
            let allCategories: any[] = [];
            
            if (firstTx.apartmentId) {
                apartment = await TransactionsController.apartmentsService.getApartmentById(firstTx.apartmentId);
                if (apartment) {
                    owner = await TransactionsController.usersService.getUserById(apartment.ownerId);
                    allCategories = await TransactionsController.categoriesService.getAllCategories();
                    
                    const InvoicesService = require('../services/invoicesService').InvoicesService;
                    const invoicesService = InvoicesService.getInstance();
                    const apartmentInvoices = await invoicesService.getInvoicesByApartment(apartment.id);
                    
                    // Filter for unpaid and partial
                    unpaidInvoices = apartmentInvoices
                        .filter(inv => inv.status === 'unpaid' || inv.status === 'partial')
                        .map(inv => {
                            const invCategory = allCategories.find(c => c.id === inv.categoryId);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                balance: inv.amount - inv.amountPaid
                            };
                        })
                        .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                    
                    // Filter for credits
                    const overpaidInvoices = apartmentInvoices
                        .filter(inv => inv.amountPaid > inv.amount)
                        .map(inv => {
                            const invCategory = allCategories.find(c => c.id === inv.categoryId);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                creditAmount: inv.amountPaid - inv.amount,
                                isUnallocatedCredit: false
                            };
                        });
                    
                    const InvoiceTransactionsService = require('../services/invoiceTransactionsService').InvoiceTransactionsService;
                    const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
                    const unallocatedCredits = await invoiceTransactionsService.getCreditsByApartmentId(apartment.id);
                    
                    const unallocatedCreditInvoices = unallocatedCredits.map(credit => ({
                        id: credit.id,
                        apartmentId: credit.apartmentId,
                        categoryId: null,
                        amount: 0,
                        description: 'Unallocated Credit',
                        invoiceDate: credit.createdAt,
                        amountPaid: credit.amount,
                        status: 'paid' as 'paid',
                        categoryName: 'Credit',
                        creditAmount: credit.amount,
                        isUnallocatedCredit: true
                    }));
                    
                    creditInvoices = [...overpaidInvoices, ...unallocatedCreditInvoices]
                        .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                    
                    const paidInvoices = apartmentInvoices
                        .filter(inv => inv.status === 'paid')
                        .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                    
                    if (paidInvoices.length > 0) {
                        const lastPaid = paidInvoices[0];
                        const invCategory = allCategories.find(c => c.id === lastPaid.categoryId);
                        lastPaidInvoice = {
                            ...lastPaid,
                            categoryName: invCategory ? invCategory.name : 'Unknown'
                        };
                    }
                    
                    // Combine allocations for all transactions
                    let allAllocations: any[] = [];
                    for (const txId of ids) {
                        const allocations = await invoiceTransactionsService.getByTransactionId(txId);
                        allAllocations = allAllocations.concat(allocations);
                    }
                    
                    // Aggregate allocations per invoiceId
                    const allocationSums: { [invoiceId: number]: number } = {};
                    allAllocations.forEach(a => {
                        if (a.invoiceId !== null) {
                            allocationSums[a.invoiceId] = (allocationSums[a.invoiceId] || 0) + a.amount;
                        }
                    });
                    
                    const paidInvoiceIds = Object.keys(allocationSums).map(id => parseInt(id));
                        
                    const currentPaidInvoicesRaw = await Promise.all(
                        paidInvoiceIds.map(id => invoicesService.getInvoiceById(id))
                    );
                    
                    currentPaidInvoices = currentPaidInvoicesRaw
                        .filter(inv => inv !== null)
                        .map(inv => {
                            const invCategory = allCategories.find(c => c.id === inv!.categoryId);
                            return {
                                ...inv,
                                categoryName: invCategory ? invCategory.name : 'Unknown',
                                currentPayment: allocationSums[inv!.id]
                            };
                        });
                    
                    const currentPaidIds = currentPaidInvoices.map(inv => inv.id);
                    unpaidInvoices = unpaidInvoices.filter(inv => !currentPaidIds.includes(inv.id));
                    creditInvoices = creditInvoices.filter(inv => !currentPaidIds.includes(inv.id));
                    
                    if (category && category.name.toLowerCase().includes('common expense')) {
                        const commonExpenseInvoices = apartmentInvoices.filter(inv => 
                            inv.categoryId === category.id && inv.year !== null
                        );
                        
                        apartmentPayments = commonExpenseInvoices.map(inv => ({
                            id: inv.id,
                            year: inv.year,
                            totalAmount: inv.amount,
                            amountPaid: inv.amountPaid,
                            status: inv.status,
                            updatedAt: inv.updatedAt
                        }));
                        
                        allApartmentPayments = apartmentPayments;
                        
                        unpaidYears = commonExpenseInvoices
                            .filter(inv => inv.status !== 'paid' && inv.year !== null)
                            .map(inv => inv.year!)
                            .sort();
                    }
                }
            } else {
                const name = req.query.name as string;
                if (name) {
                    owner = { name: name };
                }
            }
            
            const maxId = Math.max(...ids);
            const receiptNumber = 516 + maxId;

            let receiptName = combinedTransaction.description;
            if (apartment && owner) {
                receiptName = `Block-${apartment.block}-${apartment.unitNumberOfficial}-${apartment.unitNumberUnofficial}-${owner.name}`;
            } else if (req.query.name) {
                receiptName = req.query.name as string;
            }
            
            const urlFriendlyName = receiptName
                .toLowerCase()
                .replace(/[^a-z0-9\\s-]/g, '')
                .replace(/\\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            
            const receiptFilename = `C${receiptNumber}-${urlFriendlyName}`;

            res.render('transactions/receipt', {
                title: 'Combined Transaction Receipt',
                transaction: combinedTransaction,
                category,
                apartment,
                owner,
                siteSettings,
                receiptNumber,
                receiptFilename,
                apartmentPayments,
                allApartmentPayments,
                unpaidYears,
                unpaidInvoices,
                creditInvoices,
                lastPaidInvoice,
                currentPaidInvoices,
                allCategories,
                layout: false
            });
        } catch (error) {
            console.error('Error generating combined receipt view:', error);
            res.status(500).render('admin/error', { 
                message: 'Error generating combined receipt view',
                error: error
            });
        }
    }
}
"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Patched successfully")
else:
    print("Target not found")
