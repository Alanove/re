using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;
using System.IO;
using lw.Pages;
using lw.Menus;

/// <summary>
/// Summary description for SubPage
/// </summary>
public class SubPage : Current_Page
{
    protected HtmlContainerControl history;

	protected override void Page_PreInit(object sender, EventArgs e)
	{
		string PageURL = this.GetQueryValue("PageURL");

		PagesManager pMgr = new PagesManager();

		var page = pMgr.GetPageView(PageURL);

		PageContext["Page_" + PageURL] = page;

		if (page != null)
			if (!String.IsNullOrWhiteSpace(page.TemplateFileName))
				MasterPageFile = page.TemplateFileName;

		base.Page_PreInit(sender, e);
	}

	public override void DataBind()
	{
		string ParentURL = this.GetQueryValue("ParentURL");
		string SubParentURL = this.GetQueryValue("SubParentURL");
		string PageURL = this.GetQueryValue("PageURL");

		HtmlImage MainImage = FindControl("MainImage") as HtmlImage;

		//if (MainImage != null)
		//{
		//	MainImage.Src = "~/images/headers/" + ParentURL + ".jpg";
		//}

       

		string controlName = PageURL;
		if (!String.IsNullOrWhiteSpace(SubParentURL))
			controlName = ParentURL + "-" + SubParentURL + "-" + PageURL;
		else
		{
			if (!String.IsNullOrWhiteSpace(ParentURL))
				controlName = ParentURL + "-" + PageURL;
		}


		PlaceHolder AdditionalControls = FindControl("AdditionalControls") as PlaceHolder;
		PlaceHolder CategoryAdditionalControls = FindControl("CategoryAdditionalControls") as PlaceHolder;

		if (AdditionalControls != null)
		{
			string path = Server.MapPath(string.Format("{0}/{1}.ascx", lw.CTE.Folders.UserControlsFolder, controlName));
			if (File.Exists(path))
			{
				lw.Base.UserControl control = new lw.Base.UserControl(controlName);
				AdditionalControls.Controls.Add(control);
				control.DataBind();
				foreach (Control childControl in control.Controls)
					childControl.DataBind();
			}
		}


		if (CategoryAdditionalControls != null)
		{
			string path = Server.MapPath(string.Format("{0}/type/{1}.ascx", lw.CTE.Folders.UserControlsFolder, controlName));
			if (File.Exists(path))
			{
				lw.Base.UserControl control = new lw.Base.UserControl("type/" + controlName);
				CategoryAdditionalControls.Controls.Add(control);
			}
		}


		if (ParentURL == "activities")
		{
			IAttributeAccessor slideShow = FindControl("SlideShow") as IAttributeAccessor;
			if (slideShow != null)
				slideShow.SetAttribute("rel", "activities|4");
		}


		base.DataBind();
        

		IAttributeAccessor body = FindControl("body") as IAttributeAccessor;
		if (body != null)
		{
			body.SetAttribute("class", "inside " + ParentURL + " " + PageURL);
		}
	}
}