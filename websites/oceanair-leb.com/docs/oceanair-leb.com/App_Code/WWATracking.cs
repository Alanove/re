using System;
using System.IO;
using System.Net;
using System.Security.Policy;
using System.Text;
using System.Web.Script.Serialization;

namespace liteweb
{
    public class WWATracking
    {
        public bool IsStaging = false;

        public WWATracking()
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        }

        public string ShipmentEvents(string shipmentId, string bookingNumber)
        {
            string jsonData = string.Format(@"
{{
    ""ShipmentwatchRequest"": {{
        ""Type"": ""ShipmentwatchRequest"",
        ""Version"": ""2.0.1"",
        ""SenderID"": ""username"",
        ""receiverID"": ""WWA"",
        ""ShipmentwatchRequestDetails"": {{
            ""Id"":""12"",
            ""ShipmentID"":""{0}"",
            ""Bookingnumber"":""{1}""
        }}
    }}
}}",
                shipmentId,
                bookingNumber);

            string result = "";

            try
            {
                // Create a request to the URL
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(ShipmentEventUrl);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Accept = "application/json";

                request.Headers["Authorization"] = Login();

                // Write the JSON data to the request body
                using (StreamWriter streamWriter = new StreamWriter(request.GetRequestStream()))
                {
                    streamWriter.Write(jsonData);
                    streamWriter.Flush();
                    streamWriter.Close();
                }

                // Get the response
                HttpWebResponse response = (HttpWebResponse)request.GetResponse();
                using (StreamReader streamReader = new StreamReader(response.GetResponseStream()))
                {
                    result = streamReader.ReadToEnd();
                }
            }
            catch (WebException ex)
            {
                // Handle the error response
                if (ex.Response != null)
                {
                    using (StreamReader reader = new StreamReader(ex.Response.GetResponseStream()))
                    {
                        result = reader.ReadToEnd();
                    }
                }
                else
                {
                    result = ex.Message;
                }
            }

            return result;
        }

        public string ShipmentDetails(string searchBy, string referenceNumber)
        {
            string jsonData = string.Format(@"
{{
    ""ShipmentDetailsRequest"": {{
        ""Type"": ""ShipmentDetailsRequest"",
        ""Version"": ""2.0.1"",
        ""senderID"": ""username"",
        ""receiverID"": ""WWA"",
        ""ShipmentRequestDetails"": {{
            ""SearchBy"": ""{0}"",
            ""Reference"": ""{1}""
        }}
    }}
}}",
                searchBy,
                referenceNumber);

            string result = "";

            try
            {
                // Create a request to the URL
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(ShipmentDetailsUrl);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Accept = "application/json";

                request.Headers["Authorization"] = Login();

                // Write the JSON data to the request body
                using (StreamWriter streamWriter = new StreamWriter(request.GetRequestStream()))
                {
                    streamWriter.Write(jsonData);
                    streamWriter.Flush();
                    streamWriter.Close();
                }

                // Get the response
                HttpWebResponse response = (HttpWebResponse)request.GetResponse();
                using (StreamReader streamReader = new StreamReader(response.GetResponseStream()))
                {
                    result = streamReader.ReadToEnd();
                }
            }
            catch (WebException ex)
            {
                // Handle the error response
                if (ex.Response != null)
                {
                    using (StreamReader reader = new StreamReader(ex.Response.GetResponseStream()))
                    {
                        result = reader.ReadToEnd();
                    }
                }
                else
                {
                    result = ex.Message;
                }
            }

            return result;
        }

        public string TrackShipment(string searchBy, string referenceNumber)
        {
            string jsonData = string.Format(@"
{{
    ""ShipmentRequest"": {{
        ""Type"": ""ShipmentRequest"",
        ""Version"": ""2.0.1"",
        ""senderID"": ""username"",
        ""receiverID"": ""WWA"",
        ""ShipmentRequestDetails"": {{
            ""SearchBy"": ""{0}"",
            ""Reference"": ""{1}""
        }}
    }}
}}",
                searchBy,
                referenceNumber);

            string result = "";

            try
            {
                // Create a request to the URL
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(TrackShipmentUrl);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Accept = "application/json";

                request.Headers["Authorization"] = Login();

                // Write the JSON data to the request body
                using (StreamWriter streamWriter = new StreamWriter(request.GetRequestStream()))
                {
                    streamWriter.Write(jsonData);
                    streamWriter.Flush();
                    streamWriter.Close();
                }

                // Get the response
                HttpWebResponse response = (HttpWebResponse)request.GetResponse();
                using (StreamReader streamReader = new StreamReader(response.GetResponseStream()))
                {
                    result = streamReader.ReadToEnd();
                }
            }
            catch (WebException ex)
            {
                // Handle the error response
                if (ex.Response != null)
                {
                    using (StreamReader reader = new StreamReader(ex.Response.GetResponseStream()))
                    {
                        result = reader.ReadToEnd();
                    }
                }
                else
                {
                    result = ex.Message;
                }
            }

            return result;
        }

        public string Login() //returns authorization header
        {
            string jsonData = string.Format("{{\"username\": \"{0}\",\"password\": \"{1}\"}}",
                _credentials.userName,
                _credentials.password);


            string result = "";
            string token = "";

            try
            {
                // Create a request to the URL
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(LoginUrl);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Accept = "application/json";

                // Write the JSON data to the request body
                using (StreamWriter streamWriter = new StreamWriter(request.GetRequestStream()))
                {
                    streamWriter.Write(jsonData);
                    streamWriter.Flush();
                    streamWriter.Close();
                }

                // Get the response
                HttpWebResponse response = (HttpWebResponse)request.GetResponse();
                using (StreamReader streamReader = new StreamReader(response.GetResponseStream()))
                {
                    result = streamReader.ReadToEnd();

                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    var jsonObject = serializer.Deserialize<dynamic>(result);

                    // Access the auth_token from the JSON structure
                    token = jsonObject["data"]["result"]["auth_token"];
                }
            }
            catch (WebException ex)
            {
                // Handle the error response
                if (ex.Response != null)
                {
                    using (StreamReader reader = new StreamReader(ex.Response.GetResponseStream()))
                    {
                        result = reader.ReadToEnd();
                    }
                }
                else
                {
                    result =  ex.Message;
                }
            }
            return token;
        }

        public string LoginUrl
        {
            get
            {
                if (IsStaging)
                {
                    return "https://apistaging.wwalliance.com/auth/login";
                }
                return "https://api.wwalliance.com/auth/login";
            }
        }

        public string TrackShipmentUrl
        {
            get
            {
                if (IsStaging)
                {
                    return "https://apistaging.wwalliance.com/tracking/webservice/track_ShipmentSearch";
                }
                return "https://api.wwalliance.com/tracking/webservice/track_ShipmentSearch";
            }
        }
        public string ShipmentEventUrl
        {
            get
            {
                if (IsStaging)
                {
                    return "https://apistaging.wwalliance.com/tracking/webservice/track_ShipmentWatch";
                }
                return "https://api.wwalliance.com/tracking/webservice/track_ShipmentWatch";
            }
        }

        public string ShipmentDetailsUrl
        {
            get
            {
                if (IsStaging)
                {
                    return "https://apistaging.wwalliance.com/tracking/webservice/track_ShipmentdetailSearch";
                }
                return "https://api.wwalliance.com/tracking/webservice/track_ShipmentdetailSearch";
            }
        }

        Credentials _credentials
        {
            get
            {
                if (IsStaging)
                {
                    return new Credentials()
                    {
                        userName = "oceanair_webservice_staging",
                        password = "Oceanair@123"
                    };
                }
                return new Credentials()
                {
                    userName = "oceanair_webservice",
                    password = "Oceanair@123"
                };
            }
        }

        class Credentials
        {
            public string userName;
            public string password;
        }
    }

}