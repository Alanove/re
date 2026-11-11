import logger from './loggerService';

export interface AramexRateRequest {
  originAddress: {
    city: string;
    countryCode: string;
  };
  destinationAddress: {
    city: string;
    countryCode: string;
  };
  weight: number;
  numberOfItems: number;
}

export interface AramexRateResponse {
  success: boolean;
  rate?: number;
  currency?: string | undefined;
  error?: string | undefined;
}

export class AramexService {
  private static instance: AramexService;
  private config: any;

  private constructor() {
    this.config = {
      userName: process.env.ARAMEX_USERNAME,
      password: process.env.ARAMEX_PASSWORD,
      accountNumber: process.env.ARAMEX_ACCOUNT_NUMBER,
      accountPin: process.env.ARAMEX_ACCOUNT_PIN,
      accountEntity: process.env.ARAMEX_ACCOUNT_ENTITY,
      accountCountryCode: process.env.ARAMEX_ACCOUNT_COUNTRY_CODE,
      testMode: process.env.ARAMEX_TEST_MODE === 'true'
    };
  }

  public static getInstance(): AramexService {
    if (!AramexService.instance) {
      AramexService.instance = new AramexService();
    }
    return AramexService.instance;
  }

  /**
   * Calculate Aramex Shipping Rate
   */
  public async calculateRate(data: AramexRateRequest): Promise<AramexRateResponse> {
    try {
      const isMissingConfig = !this.config.userName || !this.config.password || !this.config.accountNumber;
      if (isMissingConfig) {
        console.warn('Aramex configuration is missing. Returning failure.');
        return { success: false, error: 'Aramex configuration missing' };
      }

      const soapRequest = this.constructSoapRequest(data);
      const url = 'https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://ws.aramex.net/ShippingAPI/v1/Service_1_0/CalculateRate'
        },
        body: soapRequest
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('AramexService', `Aramex API Error (Status ${response.status}): ${errorText}`);
        return { success: false, error: `HTTP Error: ${response.status}` };
      }

      const responseXml = await response.text();
      const result = this.parseSoapResponse(responseXml);

      if (!result.success) {
        logger.error('AramexService', `Aramex Business Error: ${result.error}\nXML: ${responseXml}`);
      }

      return result;
    } catch (error: any) {
      logger.error('AramexService', `calculateRate Exception: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private constructSoapRequest(data: AramexRateRequest): string {
    return `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://ws.aramex.net/ShippingAPI/v1/">
   <soapenv:Header/>
   <soapenv:Body>
      <v1:RateCalculatorRequest>
         <v1:ClientInfo>
            <v1:UserName>${this.config.userName}</v1:UserName>
            <v1:Password>${this.config.password}</v1:Password>
            <v1:Version>v1.0</v1:Version>
            <v1:AccountNumber>${this.config.accountNumber}</v1:AccountNumber>
            <v1:AccountPin>${this.config.accountPin}</v1:AccountPin>
            <v1:AccountEntity>${this.config.accountEntity}</v1:AccountEntity>
            <v1:AccountCountryCode>${this.config.accountCountryCode}</v1:AccountCountryCode>
            <v1:Source>0</v1:Source>
         </v1:ClientInfo>
         <v1:Transaction>
            <v1:Reference1>GS-RATE-REQ</v1:Reference1>
            <v1:Reference2></v1:Reference2>
            <v1:Reference3></v1:Reference3>
            <v1:Reference4></v1:Reference4>
            <v1:Reference5></v1:Reference5>
         </v1:Transaction>
         <v1:OriginAddress>
            <v1:Line1>Center</v1:Line1>
            <v1:Line2></v1:Line2>
            <v1:Line3></v1:Line3>
            <v1:City>${data.originAddress.city}</v1:City>
            <v1:StateOrProvinceCode></v1:StateOrProvinceCode>
            <v1:PostCode></v1:PostCode>
            <v1:CountryCode>${data.originAddress.countryCode}</v1:CountryCode>
         </v1:OriginAddress>
         <v1:DestinationAddress>
            <v1:Line1>Center</v1:Line1>
            <v1:Line2></v1:Line2>
            <v1:Line3></v1:Line3>
            <v1:City>${data.destinationAddress.city}</v1:City>
            <v1:StateOrProvinceCode></v1:StateOrProvinceCode>
            <v1:PostCode></v1:PostCode>
            <v1:CountryCode>${data.destinationAddress.countryCode}</v1:CountryCode>
         </v1:DestinationAddress>
         <v1:ShipmentDetails>
            <v1:Dimensions>
               <v1:Length>0</v1:Length>
               <v1:Width>0</v1:Width>
               <v1:Height>0</v1:Height>
               <v1:Unit>cm</v1:Unit>
            </v1:Dimensions>
             <v1:ActualWeight>
                <v1:Unit>KG</v1:Unit>
                <v1:Value>${Math.max(0.5, data.weight)}</v1:Value>
             </v1:ActualWeight>
             <v1:ChargeableWeight>
                <v1:Unit>KG</v1:Unit>
                <v1:Value>${Math.max(0.5, data.weight)}</v1:Value>
             </v1:ChargeableWeight>
             <v1:DescriptionOfGoods>Sporting Goods</v1:DescriptionOfGoods>
             <v1:GoodsOriginCountry>${data.originAddress.countryCode}</v1:GoodsOriginCountry>
             <v1:NumberOfPieces>${data.numberOfItems}</v1:NumberOfPieces>
            <v1:ProductGroup>EXP</v1:ProductGroup>
            <v1:ProductType>PDX</v1:ProductType>
            <v1:PaymentType>P</v1:PaymentType>
            <v1:PaymentCode></v1:PaymentCode>
            <v1:PaymentOptions></v1:PaymentOptions>
         </v1:ShipmentDetails>
      </v1:RateCalculatorRequest>
   </soapenv:Body>
</soapenv:Envelope>`.trim();
  }

  private parseSoapResponse(xml: string): AramexRateResponse {
    // Simple manual parsing since we don't have a library
    // Regex allows optional v1: prefix because response uses default namespace
    const totalAmountMatch = xml.match(/<(?:v1:)?Value>([\d.]+)<\/(?:v1:)?Value>/);
    const currencyMatch = xml.match(/<(?:v1:)?CurrencyCode>([^<]+)<\/(?:v1:)?CurrencyCode>/);
    const hasErrorMatch = xml.match(/<(?:v1:)?HasErrors>true<\/(?:v1:)?HasErrors>/);
    const notificationsMatch = xml.match(/<(?:v1:)?Message>([^<]+)<\/(?:v1:)?Message>/);

    if (hasErrorMatch && notificationsMatch) {
      return { success: false, error: notificationsMatch[1] };
    }

    if (totalAmountMatch) {
      const result: AramexRateResponse = {
        success: true,
        rate: parseFloat(totalAmountMatch[1])
      };
      if (currencyMatch) result.currency = currencyMatch[1];
      return result;
    }

    return { success: false, error: 'Could not parse Aramex response' };
  }
}

export default AramexService.getInstance();
