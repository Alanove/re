using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Data;

using lw.CTE.Enum;
using lw.WebTools;
using lw.CTE;
using lw.Members;

/// <summary>
/// Summary description for MemberHome
/// </summary>
public class MemberPage : SubPage
{
	public MemberPage()
	{

	}

	protected override void OnPreInit(EventArgs e)
	{
		
		base.OnPreInit(e);
		lw.Members.Security.User.CheckAccess();

		if (WebContext.Profile.CurrentUserStatus == (int)UserStatus.Incomplete)
		{
			Response.Redirect(string.Format("{0}/member/complete-registration", WebContext.Root));
		} 

		//if (WebContext.Profile.CurrentUserStatus == (int)UserStatus.Pending)
		//{
		// //   Response.Redirect(string.Format("{0}/profile/{1}/edit#basic", WebContext.Root, WebContext.Profile.dbUserName));
		//	Response.Redirect(string.Format("{0}/profile/complete-registration", WebContext.Root));
		//}
	}
}