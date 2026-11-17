<%@ WebHandler Language="C#" Class="track" %>

using System;
using System.Web;

using System.IO;
using System.Net;

public class track : IHttpHandler
{

	const string _format = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<CarrierstatusRequest xmlns:xsi=""http://www.w3.org/2001/XMLSchema-instance"" xsi:noNamespaceSchemaLocation=""WWA_Shipment_Search_Request_version_2.0.1.xsd"">
   <CarrierStatusEnvelope>
 <SenderID>edi_oceanairconsolidators_prod</SenderID>
      <ReceiverID>restapi</ReceiverID>
      <Password>tTE@cvj4LqRY7</Password>
      <Type>Shipment_Status_XML_1.0.0</Type>
      <Version>1.0.1</Version>
      <EnvelopeID>20152611104537</EnvelopeID>
   </CarrierStatusEnvelope>
   <CarrierstatusRequestDetails>
		<ContainerNumber>{0}</ContainerNumber>
		<StatusFromDate>{1}</StatusFromDate>
		<StatusToDate>{2}</StatusToDate>
   </CarrierstatusRequestDetails>
</CarrierstatusRequest>";


	//	const string _format = @"<?xml version=""1.0"" encoding=""UTF-8""?>
	//	<ShipmentStatus>                   
	// <Envelope>                        
	//   <SenderID>edi_oceanairconsolidators_prod</SenderID>                                              
	//   <ReceiverID>wwalliance</ReceiverID>                                                              
	//   <Password>tTEcvj4LqRY7yr5Wxlvy</Password>                                                        
	//   <Type>Shipment_Status_XML_1.0.0</Type>                                                           
	//   <Version>1.0.0</Version>        
	//   <EnvelopeID>20152611104537</EnvelopeID>                                                          
	// </Envelope>                       
	// <ShipmentStatusDetails>           
	//   <ShipperReference />            
	//   <ForwarderReference>411103686, ,</ForwarderReference>                         
	//   <ConsigneeReference />          
	//   <CommunicationReference />      
	//   <PickupReference />             
	//   <BookingNumber />
	//   <WWAShipmentReference />        
	//   <LotNumber />                   
	//   <HouseBillOfLadingNumber>2415-01003-05</HouseBillOfLadingNumber>                                 
	// </ShipmentStatusDetails>          
	//</ShipmentStatus>";

	private string URL = "https://www.wwalliance.com/webservice/rest/carrierstatus/search.json";


	public void ProcessRequest(HttpContext context)
	{
		//URL = "http://staging.www.wwalliance.com/webservice/rest/shipment/search.xml";

		context.Response.ContentType = "text/json";

		string data = String.Format(_format,
			context.Request["CountainerNumber"],//"CAIU8318026",//context.Request["ReferenceNumber"]
			context.Request["DateFrom"],//"2015-10-03",
			context.Request["DateTo"]//"2015-10-27"
		);

		//context.Response.Write(data);

		System.Net.HttpWebRequest request = (HttpWebRequest)WebRequest.Create(URL);
		request.Method = "POST";
		request.ContentType = "application/xml";
		request.Headers.Add("Access-Control-Allow-Origin", "*");
		request.ContentLength = data.Length;
		using (System.IO.Stream webStream = request.GetRequestStream())
		{
			using (System.IO.StreamWriter requestWriter = new StreamWriter(webStream, System.Text.Encoding.ASCII))
			{
				requestWriter.Write(data);
			}
		}
		try
		{
			System.Net.WebResponse webResponse = request.GetResponse();
			using (Stream webStream = webResponse.GetResponseStream())
			{
				if (webStream != null)
				{
					using (StreamReader responseReader = new StreamReader(webStream))
					{
						string response = responseReader.ReadToEnd();
						context.Response.Write(response);
					}
				}
			}
		}
		catch (Exception e)
		{
			throw (e);
		}
	}

	public bool IsReusable
	{
		get
		{
			return false;
		}
	}
}