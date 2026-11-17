<%@ WebHandler Language="C#" Class="track" %>

using System;
using System.Web;

using System.IO;
using System.Net;
using System.Net.Http;

public class track : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        try
        {
            //URL = "http://staging.www.wwalliance.com/webservice/rest/shipment/search.xml";

            context.Response.ContentType = "text/json";
            var searchBy = context.Request["SearchBy"];
            var referenceNumber = context.Request["ReferenceNumber"];

            liteweb.WWATracking tracking = new liteweb.WWATracking();
            
            context.Response.Write(tracking.TrackShipment(searchBy, referenceNumber));
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