<%@ Page Title="" Language="C#" MasterPageFile="~/_Templates/DefaultHeader.master" AutoEventWireup="true" Inherits="SubPage" %>

<asp:Content runat="server" ContentPlaceHolderID="Header">
    <link rel="stylesheet" href="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/css/cubeportfolio.min.css" />
    <script type="text/javascript">
        lw.AppendInit(function () {
            $(".nav .media-gallery, .nav .photos").addClass("current");
        });
    </script>
</asp:Content>

<asp:Content ContentPlaceHolderID="HeaderImage" runat="server">
    <section id="HeaderImg">
        <img src="~/images/mea.jpg" class="img-responsive" alt="About us" runat="server">
    </section>
</asp:Content>

<asp:Content ContentPlaceHolderID="Content" runat="server">
    <section id="content" class="main-container">
        <div class="container">
            <lw:PhotoAlbumDataProvider runat="server" ID="Album">
                <div class="row">
                    <div class="col-sm-10">
                        <h1>
                            <lw:DataProperty Property="DisplayName" runat="server" />
                        </h1>
                    </div>
                    <div class="col-sm-2 back">
                        <a href="~/media-gallery/photos" runat="server">&laquo; Back</a>
                    </div>
                </div>
                <lw:PhotoAlbumImagesDataSource OrderBy="Sort" runat="server">
                    <lw:CustomRepeater runat="server">
                        <HeaderTemplate>
                            <div class="galleryContainer">
                                <div id="grid-container" class="cbp-l-grid-masonry-projects">
                        </HeaderTemplate>
                        <ItemTemplate>
                            <div class="cbp-item">
                                <div class="cbp-caption">
                                    <div class="cbp-item-wrapper">
                                        <a href="<%# Eval("Large") %>" class="cbp-lightbox zoomer" data-title="<%# Eval("Caption") %>">
                                            <span class="overlay-zoom">
                                                <img src="<%# Eval("Thumb") %>">
                                                <span class="zoom-icon"></span>
                                            </span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </ItemTemplate>
                        <FooterTemplate>
                            </div>
					</div>	
                        </FooterTemplate>
                    </lw:CustomRepeater>
                </lw:PhotoAlbumImagesDataSource>
            </lw:PhotoAlbumDataProvider>
        </div>
    </section>
    <script src="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/js/jquery.cubeportfolio.min.js"></script>
</asp:Content>
