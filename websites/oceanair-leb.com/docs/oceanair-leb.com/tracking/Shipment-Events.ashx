<%@ WebHandler Language="C#" Class="track" %>

using System;
using System.Web;

using System.IO;
using System.Net;

public class track : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "text/json";


        string shipmentId = context.Request["ShipmentId"];
        string bookingNumber = context.Request["BookingNumber"];

        liteweb.WWATracking tracking = new liteweb.WWATracking();

        context.Response.Write(tracking.ShipmentEvents(shipmentId, bookingNumber));
    }

    public bool IsReusable
    {
        get
        {
            return false;
        }
    }
}