using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Data;
using System.Text;

using lw.WebTools;
using lw.Data;
using lw.Utils;
using lw.Members;

namespace lw
{
	/// <summary>
	/// Summary description for MemberProfileSetup
	/// </summary>
	public class MemberProfile
	{
		public MemberProfile()
		{

		}


		public void UpdateBillingAddress(int MemberId, System.String BillingName, System.String BillingPhone, System.String BillingCountry, System.String BillingAddress, System.String BillingCity, System.String BillingState)
		{
			string sql = @"
If Not Exists (select * from MemberProfile where MemberId={0})
				insert into MemberProfile (MemberId) values ({0});
Update MemberProfile set 
 BillingName='{1}',  BillingPhone='{2}',  BillingCountry='{3}',  BillingAddress='{4}',  BillingCity='{5}',  BillingState='{6}' Where MemberId={0}";
			sql = String.Format(sql, MemberId, StringUtils.SQLEncode(BillingName), StringUtils.SQLEncode(BillingPhone), StringUtils.SQLEncode(BillingCountry), StringUtils.SQLEncode(BillingAddress), StringUtils.SQLEncode(BillingCity), StringUtils.SQLEncode(BillingState));
			DBUtils.ExecuteQuery(sql, lw.Members.cte.lib);
		}


		public void UpdateShippingAddress(int MemberId, System.String ShippingName, System.String ShippingPhone, System.String ShippingCountry, System.String ShippingAddress, System.String ShippingCity, System.String ShippingState)
		{
			string sql = @"
If Not Exists (select * from MemberProfile where MemberId={0})
				insert into MemberProfile (MemberId) values ({0});
Update MemberProfile set 
 ShippingName='{1}',  ShippingPhone='{2}',  ShippingCountry='{3}',  ShippingAddress='{4}',  ShippingCity='{5}',  ShippingState='{6}' Where MemberId={0}";
			sql = String.Format(sql, MemberId, StringUtils.SQLEncode(ShippingName), StringUtils.SQLEncode(ShippingPhone), StringUtils.SQLEncode(ShippingCountry), StringUtils.SQLEncode(ShippingAddress), StringUtils.SQLEncode(ShippingCity), StringUtils.SQLEncode(ShippingState));
			DBUtils.ExecuteQuery(sql, lw.Members.cte.lib);
		}


		public void UpdateProfile(int MemberId, System.String Phone, System.String CountryCode)
		{
			string sql = @"
If Not Exists (select * from MemberProfile where MemberId={0})
				insert into MemberProfile (MemberId) values ({0});
Update MemberProfile set 
 Phone='{1}',  CountryCode='{2}' Where MemberId={0}";
			sql = String.Format(sql, MemberId, StringUtils.SQLEncode(Phone), StringUtils.SQLEncode(CountryCode));
			DBUtils.ExecuteQuery(sql, lw.Members.cte.lib);
		}
	}
}