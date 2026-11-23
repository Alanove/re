using System;
using System.Data;
using System.Configuration;
using System.Web;
using System.Web.Security;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;
using System.Web.UI.WebControls.WebParts;

using lw.WebTools;
using lw.CTE.Enum;

public class Current_Page : lw.Base.CustomPage
{

	public SiteMenu Menu;
	public Current_Page()
	{
	}
	public override void DataBind()
	{
		Menu = new SiteMenu(this);
		this.Editable = false;
		base.DataBind();
	}
}