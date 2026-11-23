<%@ Page Title="" Language="C#" MasterPageFile="~/_Templates/DefaultHeader.master" AutoEventWireup="true" Inherits="SubPage" %>

<asp:Content runat="server" ContentPlaceHolderID="Header">
    <script type="text/javascript">
        lw.AppendInit(function () {
            $(".nav .media-gallery, .nav .videos").addClass("current");
        });
    </script>
</asp:Content>

<asp:Content ContentPlaceHolderID="HeaderImage" runat="server">
    <section id="HeaderImg">
        <img src="~/images/mea.jpg" class="img-responsive" alt="About us" runat="server">
    </section>
</asp:Content>

<asp:Content ContentPlaceHolderID="Content" runat="server">
        <div id="fb-root"></div>
<script>(function (d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.9&appId=956684957810690";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));</script>
    <section id="content" class="main-container">
        <div class="container">
            <lw:VideoDataProvider runat="server">
                <div class="row">
                    <div class="col-sm-10">
                        <h1>
                            <lw:DataProperty Property="Title" runat="server" />
                        </h1>
                    </div>
                    <div class="col-sm-2 back">
                        <a href="~/media-gallery/videos" runat="server">&laquo; Back</a>
                    </div>
                </div>
                <div class="embed-responsive embed-responsive-16by9">
                    <lw:DataProperty Property="Object" runat="server" />
                </div>
            </lw:VideoDataProvider>
        </div>
    </section>
</asp:Content>
