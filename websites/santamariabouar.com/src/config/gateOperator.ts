/**
 * Frozen Safemate Open keys. No password is stored.
 * Website Open always uses this sub-user; never call user_login.php.
 */
export interface GateDevice {
  name: string;
  mac: string;
  type: string;
  project: string;
  ip: string;
  online: string;
  mode: string;
}

export interface GateOperator {
  account: string;
  account_type: number;
  master_account: string;
  country_code: string;
  region: string;
  domain: string;
  ip: string;
  device_token: string;
  devices: GateDevice[];
}

export const GATE_OPERATOR: GateOperator = {
  account: '66677788',
  account_type: 1,
  master_account: '81768801',
  country_code: 'LB',
  region: 'sg',
  domain: 'www.yaoertaicloud-sg.com',
  ip: '47.74.182.40',
  device_token: '8adc019b6caf46e2',
  devices: [
    {
      name: 'Santa maria gate',
      mac: 'e8:68:e7:77:81:ae',
      type: '7',
      project: '9',
      ip: '192.168.1.2',
      online: '2',
      mode: '1'
    }
  ]
};
