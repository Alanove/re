<%@ Page Title="" Language="C#" MasterPageFile="~/_Templates/Default.master" AutoEventWireup="true"
    Inherits="SubPage" %>


<asp:Content runat="server" ContentPlaceHolderID="Header">
    <script>
        lw.AppendInit(function () {
            $("li.news-events").addClass("current");
            $('body').addClass("newsdetails");
        });
    </script>
</asp:Content>

<asp:Content ContentPlaceHolderID="Content" runat="server">
    <lw:PagesDataItem runat="server" ID="ArticleDetails" OverridePageTitle="true">
        <section id="content" class="main-container news-details">
            <div class="container">
                <article>
                    <header class="row">
                        <div class="col-sm-10">
                            <h1>
                                <lw:DataProperty Property="Header" runat="server" />

                            </h1>
                        </div>
                        <div class="col-sm-2 back">
                            <a href="~/news-events" runat="server">&laquo; Back</a>
                        </div>
                    </header>
                    <lw:PageImage Class="img-responsive col-sm-6 newsdetails-img" runat="server" ImageType="Medium" />
                    <lw:DataProperty Property="PageContent" runat="server" PutBR="false" />
                </article>
            </div>
        </section>
    </lw:PagesDataItem>
</asp:Content>
