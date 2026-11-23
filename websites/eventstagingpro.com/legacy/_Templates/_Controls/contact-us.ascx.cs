using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Data;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;

using lw.Network;
using lw.WebTools;

public partial class _Controls_contact_us : System.Web.UI.UserControl
{
    AjaxResponse resp = new AjaxResponse();
    protected void Page_Load(object sender, EventArgs e)
    {
        if (ContactUs.IsPostBack)
        {
            resp.callBack = ContactUs.AjaxCallback;

            ContactUs.Validate();

            resp.valid = ContactUs.IsValid.Value;
            if (!Captcha.IsValid)
            {
                resp.error = "Please check the reCaptcha.";
            }
            else
            {
                if (resp.valid)
                {
                    NameValueCollection dic = ContactUs.GetValues();

                    lw.Network.Mail m = new lw.Network.Mail("Contact Us Form");
                    m.Data = dic;

                    Config cfg = new Config();

                    m.From = dic["Email"];

                    m.Send();
                    resp.data = "success";
                }
                else
                {
                    resp.data = ContactUs.Messages;
                }
            }
            resp.WriteJson();
        }
    }
}