import { User } from '../../admin/services/usersService';
export interface OAuthProfile {
    provider: 'google' | 'microsoft' | 'facebook';
    providerId: string;
    email: string;
    name: string;
    picture?: string;
}
export interface OAuthUser extends User {
    oauth_provider?: string;
    oauth_id?: string;
}
export declare class OAuthService {
    private static instance;
    private constructor();
    static getInstance(): OAuthService;
    findOrCreateUser(profile: OAuthProfile, role?: string): Promise<OAuthUser | null>;
    private createUserFromOAuth;
    private linkOAuthAccount;
    unlinkOAuthAccount(userId: number, provider: string): Promise<void>;
    getUserOAuthAccounts(userId: number): Promise<Array<{
        provider: string;
        provider_id: string;
        email: string;
        name: string;
        created_at: Date;
    }>>;
    hasOAuthAccount(userId: number, provider: string): Promise<boolean>;
}
declare const _default: OAuthService;
export default _default;
//# sourceMappingURL=oauthService.d.ts.map