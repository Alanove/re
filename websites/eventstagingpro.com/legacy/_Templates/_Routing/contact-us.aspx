<%@ Page Language="C#" AutoEventWireup="true" Inherits="SubPage" MasterPageFile="~/_Templates/Contact.master" %>

<asp:Content runat="server" ContentPlaceHolderID="Header">
</asp:Content>
<asp:Content ContentPlaceHolderID="HeaderImage" runat="server">
    <div class="banner">
        <div id="map-canvas" style="height: 450px"></div>
    </div>
</asp:Content>

<asp:Content ContentPlaceHolderID="Content" runat="server">
    <lw:PagesDataItem runat="server" ID="ArticleDetails" OverridePageTitle="true">
        <section id="content" class="main-container">
            <div class="container">
                <div class="row">
                    <div class="col-md-8">
                        <h1>
                            <lw:DataProperty Property="Header" PutBR="false" runat="server" />
                        </h1>
                        <lw:DataProperty Property="PageContent" runat="server" PutBR="false" Format="{0}" />
                        <asp:PlaceHolder ID="AdditionalControls" runat="server" />

                    </div>
                    <aside class="col-md-4">
                        <div class="sidebar">
                            <div class="side vertical-divider-left">
                                <h3 class="title">Event Staging Professionals</h3>
                                <ul class="list">
                                    <li><i class="fa fa-map-marker"></i><div>BSOUS - LEBANON - MAIN ROAD - NEAR AL SAYDE CHURCH</div></li>
                                    <li><i class="fa fa-phone"></i>+961 5 940704</li>
                                    <li><i class="fa fa-mobile"></i>
                                        <div>+961 3 626479<br />
                                            +961 70 185838</div>
                                    </li>
                                    <li><i class="fa fa-envelope"></i>
                                        <div>
                                            <a href="mailto:info@eventstagingpro.com">info@eventstagingpro.com</a><br />
                                            <a href="mailto:e.stagingpro@gmail.com">e.stagingpro@gmail.com</a>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </section>
    </lw:PagesDataItem>
    <script type="text/javascript" src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCDXBhxQFY31T9cK_bYuDFETlVh7jOU_00"></script>
    <script src="<lw:root runat='server' />/plugins/google.map/google.map.config.js"></script>
</asp:Content>
