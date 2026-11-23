<%@ Page Language="C#" AutoEventWireup="true" Inherits="SubPage" MasterPageFile="~/_Templates/DefaultHeader.master" %>


<asp:Content runat="server" ContentPlaceHolderID="Header"></asp:Content>



<asp:Content ContentPlaceHolderID="HeaderImage" runat="server">
	<lw:PagesDataItem runat="server" ID="ImagesDetails" OverridePageTitle="false">
		<lw:PageImage Class="img-responsive" runat="server" ImageType="Large" />
	</lw:PagesDataItem>
</asp:Content>

<asp:Content ContentPlaceHolderID="Content" runat="server">
    <lw:PagesDataItem runat="server" ID="ArticleDetails" OverridePageTitle="true">
        <section id="content" class="main-container">
            <div class="container">
                <article>
                    <header>
                        <h1>
                            <lw:DataProperty Property="Header" PutBR="false" runat="server" />
                        </h1>
                    </header>
                    <lw:DataProperty Property="PageContent" runat="server" PutBR="false" Format="{0}" />
                    <asp:PlaceHolder ID="AdditionalControls" runat="server" />
                </article>
            </div>
        </section>
    </lw:PagesDataItem>
</asp:Content>
