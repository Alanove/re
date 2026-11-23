<%@ Control Language="C#" AutoEventWireup="true" CodeFile="contact-us.ascx.cs" Inherits="_Controls_contact_us" %>

<script>
	function ContactUs_CallBack(e) {
		if (!e.valid) {
			lw.alert(lw.validator.getHtmlMessage(e.data), null, "Ok");
			return;
		}

		if (isOk(e.error)) {
			lw.alert(e.error, null, "Ok");
			return;
		}
		if (e.data == "success") {
			lw.alert("Your form was successfully sent.");
			$("#ContactUs").each(function () {
				this.reset();
			});
		}
	}

</script>
<lw:Form runat="server" ID="ContactUs" AjaxCallback="ContactUs_CallBack" AjaxSubmit="true" class="form" LoaderArea="Body">
	<lw:ValidationGroup runat="server" Bubble="false" ID="ValidationGroup">
		<lw:Validator runat="server" For="Name" Required="true" DisplayName="Name" EmptyText="" />
		<lw:Validator runat="server" For="Email" Required="true" DataType="Email" DisplayName="E-mail" />
		<lw:Validator runat="server" For="Message" Required="true" DisplayName="Message" />
	</lw:ValidationGroup>
	<div class="row">
		<div class="col-xs-12 form-group">
			<lw:Label For="Name" runat="server" class="required">Name</lw:Label>
			<input runat="server" id="Name" class="form-control" />
		</div>
	</div>
	<div class="row">
		<div class="col-sm-6 form-group">
			<lw:Label For="Email" runat="server" class="required">E-mail</lw:Label>
			<input runat="server" id="Email" class="form-control" />
		</div>
		<div class="col-sm-6 form-group">
			<lw:Label For="Phone" runat="server">Phone</lw:Label>
			<input runat="server" id="Phone" class="form-control" />
		</div>
	</div>
	<div class="row">
		<div class="col-xs-12 form-group">
			<lw:Label For="Address" runat="server">Address</lw:Label>
			<input runat="server" id="Address" class="form-control" />
		</div>
	</div>
	<div class="row">
		<div class="col-xs-12 form-group">
			<lw:Label For="Message" runat="server" class="required">Message</lw:Label>
			<textarea id="Message" runat="server" class="form-control autosize" rows="6"></textarea>
		</div>
	</div>
	<div class="row captcha">
		<div class="col-xs-12">
			<div class="pull-right">
				<lw:NoCaptchaRecaptcha runat="server" ID="Captcha" />
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-sm-3">
			<p>
				(<span class="color-red">*</span>) Required Fields
			</p>
		</div>
		<div class="col-sm-9">
			<button type="submit" class="btn btn-primary pull-right">Submit</button>
		</div>
	</div>
</lw:Form>




