<%@ Page Language="C#" AutoEventWireup="true" Inherits="SubPage" MasterPageFile="~/_Templates/Home.master" %>

<asp:Content ContentPlaceHolderID="Header" runat="server">
</asp:Content>

<asp:Content ContentPlaceHolderID="Content" runat="server">
    <section class="pt-100 pb-100">
        <div class="container">
            <lw:PagesDataItem runat="server" PageURL="about-us" OverridePageTitle="false">
                <article class="text-center max-width-770">
                    <header>
                        <h2>
                            <lw:DataProperty runat="server" Property="Header" /></h2>
                    </header>
                    <p>
                        <lw:DataProperty runat="server" Property="PageContent" PutBR="false" MaxCharacters="400" ClosingSentence="..." />
                    </p>
                    <a href="~/about-us" runat="server" class="more" title="Learn more about Event Staging Professionals">Learn More</a>
                </article>
            </lw:PagesDataItem>
        </div>
    </section>
<%--    <section class="layher pt-100 pb-100">
        <div class="container">
            <article class="max-width-770">
                <header>
                    <h2>Layher</h2>
                </header>
                <div class="row">
                    <div class="col-sm-4">
                        <figure>
                            <img src="~/images/layher-logo.png" class="img-responsive" runat="server" />
                        </figure>
                    </div>
                    <div class="col-sm-8">
                        <p>
                           Layher towers for sound and lighting as well as scaffolding systems certified in Germany are available for rental in Lebanon at Event Staging Professionals.
                        </p>
                    </div>
                </div>
                <div class="text-center">
                    <a href="~/products/layher-products" runat="server" class="more" title="Learn more about Event Layher Products">Learn More</a>
                </div>
            </article>
        </div>
    </section>--%>
    <section class="posts-section pt-100 pb-70">
        <div class="container">
            <lw:PagesDataSource ParentURL="news-events" ID="LatestNews" Max="3" runat="server">
                <lw:CustomRepeater runat="server">
                    <HeaderTemplate>
                        <div class="heading">
                            <h2>Latest Posts</h2>
                            <p>Event Staging Professionals provided staging solutions to some of the biggest events in Lebanon. We have chosen to share with you some of the most incredible experiences we were lucky to be part of.</p>
                        </div>
                        <div class="posts-list">
                    </HeaderTemplate>
                    <ItemTemplate>
                        <article>
                            <figure>
                                <lw:PageLink runat="server">
                                    <lw:PageImage ImageType="Thumb" NoImage="~/images/no-image.jpg" runat="server" />
                                </lw:PageLink>
                            </figure>
                            <div class="post-content">
                                <header>
                                    <h3>
                                        <lw:PageLink runat="server">
                                            <lw:DataProperty Property="Title" runat="server" MaxCharacters="60" ClosingSentence="..." />
                                        </lw:PageLink>
                                    </h3>
                                </header>
                                <time datetime='<lw:DataProperty Property="PublishDate" runat="server" />'>
                                    <lw:DataProperty Property="PublishDate" runat="server" Format="{0:dd MMM yyyy}" /></time>
                                <p>
                                    <lw:DataProperty Property="SmallDescription" runat="server" MaxCharacters="220" ClosingSentence="..." />
                                </p>
                            </div>
                        </article>
                    </ItemTemplate>
                    <FooterTemplate>
                        </div>
                    </FooterTemplate>
                </lw:CustomRepeater>
            </lw:PagesDataSource>
        </div>
    </section>
    <section class="media-gallery pt-100 pb-100">
        <div class="container">
            <div class="heading">
                <h2>Media Gallery</h2>
                <p>Event Staging Professionals provided staging solutions to some of the biggest events in Lebanon. We have chosen to share with you some of the most incredible experiences we were lucky to be part of.</p>
            </div>

            <!-- Nav tabs -->
            <ul class="nav nav-tabs" role="tablist">
                <li data-role="media-gallery" class="active"><a href="#photos" aria-controls="photos" role="tab" data-toggle="tab">Photos</a></li>
                <li data-role="media-gallery"><a href="#videos" aria-controls="videos" role="tab" data-toggle="tab">Videos</a></li>
            </ul>

            <!-- Tab panes -->
            <div class="tab-content">
                <div data-role="media-gallery" class="tab-pane fade in active" id="photos">
                    <!-- Slider main container -->
                    <div class="swiper-container clearfix photoscontainer">
                        <!-- Additional required wrapper -->
                        <div class="swiper-wrapper">
                            <lw:PhotoAlbumsDataSource runat="server" Top="4" OrderBy="DateAdded Desc">
                                <lw:CustomRepeater runat="server">
                                    <ItemTemplate>
                                        <div class="swiper-slide">
                                            <lw:PhotoAlbumsLink runat="server" Path="media-gallery/photos">
                                                <lw:PhotoAlbumImage runat="server" AlbumImageType="Thumb" class="img-responsive" />
                                            </lw:PhotoAlbumsLink>
                                        </div>
                                    </ItemTemplate>
                                </lw:CustomRepeater>
                            </lw:PhotoAlbumsDataSource>
                        </div>
                        <!-- Add Pagination -->
                        <div class="swiper-pagination photos-pagination"></div>
                    </div>
                </div>
                <div data-role="media-gallery" class="tab-pane fade" id="videos">
                    <!-- Slider main container -->
                    <div class="swiper-container clearfix videoscontainer">
                        <!-- Additional required wrapper -->
                        <div class="swiper-wrapper">
                            <!-- Slides -->
                            <lw:VideosDataSource runat="server" Status="MainPage" OrderBy="DateCreated Desc">
                                <lw:CustomRepeater runat="server">
                                    <ItemTemplate>
                                        <div class="swiper-slide">
                                            <lw:VideoLink runat="server" Type="Video" Path="media-gallery/videos">
                                                <lw:VideoImage runat="server" VideoImageType="Thumb" class="img-responsive" />
                                            </lw:VideoLink>
                                        </div>
                                    </ItemTemplate>
                                </lw:CustomRepeater>
                            </lw:VideosDataSource>
                        </div>
                        <!-- Add Pagination -->
                        <div class="swiper-pagination videos-pagination"></div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</asp:Content>
