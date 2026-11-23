export interface Customer {
    id: number;
    username: string;
    email: string;
    status: string;
    role: string;
    created_at: Date;
    updated_at: Date;
    total_orders?: number;
    total_spent?: number;
    last_order_date?: Date;
}
export declare class CustomerManagementService {
    private static instance;
    private constructor();
    static getInstance(): CustomerManagementService;
    getAllCustomers(page?: number, limit?: number, filters?: {
        search?: string;
        status?: string;
    }): Promise<{
        customers: Customer[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getCustomerById(id: number): Promise<Customer | null>;
    getCustomerOrders(customerId: number): Promise<any[]>;
    getCustomerAddresses(customerId: number): Promise<any[]>;
    updateCustomerStatus(customerId: number, status: string): Promise<void>;
}
//# sourceMappingURL=customerManagementService.d.ts.map