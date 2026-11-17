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


        string searchBy = context.Request["SearchBy"];
        string bookingNumber = context.Request["BookingNumber"];

        liteweb.WWATracking tracking = new liteweb.WWATracking();

        context.Response.Write(tracking.ShipmentDetails(searchBy, bookingNumber));
    }

    public bool IsReusable
    {
        get
        {
            return false;
        }
    }
}