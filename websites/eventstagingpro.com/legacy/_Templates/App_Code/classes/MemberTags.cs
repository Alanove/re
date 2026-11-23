using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Web.UI.HtmlControls;
using System.Data;
using System.Text;

using lw.WebTools;
using lw.Data;
using lw.Utils;
using lw.Members;
using lw.DataControls;
using lw.Countries;
using lw.Networking;

namespace lw.CustomTags
{
	/// <summary>
	/// Summary description for MemberTags
	/// </summary>
	public class CustomMemberProfileProperty : lw.Members.Controls.MemberProfileProperty
	{
		bool _bound = false;
		string _format = "{0}";

		protected override void Render(HtmlTextWriter writer)
		{
			if (!String.IsNullOrEmpty(this.Text))
			{
				switch (Property)
				{
					case "ContactCountryCode":
					case "HomeCountryCode":
						CountriesMgr cMgr = new CountriesMgr();
						DataView countries = cMgr.GetCountries("CountryCode='" + StringUtils.SQLEncode(this.Text) + "'");
						if (countries.Count > 0)
						{
							this.Text = String.Format(Format, countries[0]["Name"]);
						}
						break;
					case "SABISSchoolAttended":
						NetworksManager nMgr = new NetworksManager();
						int networkId = Int32.Parse(this.Text);
						Networking.Network network = nMgr.GetNetwork(networkId);
						this.Text = String.Format(Format, network.Name);
						break;
					default:
						break;
				}
			}
			base.Render(writer);
		}

		public string Format
		{
			set
			{
				_format = value;
			}
			get
			{
				return _format;
			}
		}
	}
}