<%@ Control Language="C#" %>

<link rel="stylesheet" href="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/css/cubeportfolio.min.css" />

<lw:VideosDataSource EnablePaging="true" PageSize="20" ID="Videos" runat="server" OrderBy="DateCreated desc" Status="MainPage">
    <lw:CustomRepeater runat="server">
        <HeaderTemplate>
            <div class="galleryContainer">
                <div id="grid-container" class="cbp-l-grid-masonry-projects">
        </HeaderTemplate>
        <ItemTemplate>
            <div class="cbp-item">
                <div class="cbp-caption">
                    <div class="cbp-caption-defaultWrap">
                        <lw:VideoLink Type="Video" runat="server" Path="media-gallery/videos">
                            <lw:VideoImage runat="server" VideoImageType="Thumb" />
                        </lw:VideoLink>
                    </div>
                </div>
                <lw:VideoLink Type="Video" runat="server" Path="media-gallery/videos" class="cbp-l-grid-masonry-projects-title">
                    <lw:DataProperty Property="Title" runat="server" Format="{0}" />
                </lw:VideoLink>
            </div>
        </ItemTemplate>
        <FooterTemplate>
            </div>
		</div>	
        </FooterTemplate>
    </lw:CustomRepeater>

    <lw:DSNoData runat="server">
        No videos at the moment, keep checking this page for further updates.
    </lw:DSNoData>
    <lw:PagingControl Source="Videos" NextText=">" PreviousText="<" runat="server">
        <HeaderTemplate>
            <ul class="pager pull-right">
        </HeaderTemplate>
        <ItemTemplate>
            <li>
                <a href="?<%#Eval("PageParam") %>=<%#Eval("Page") %>" class="<%#Eval("Class") %>"><%#Eval("Text") %></a>
            </li>
        </ItemTemplate>
        <FooterTemplate></ul></FooterTemplate>
    </lw:PagingControl>
</lw:VideosDataSource>
<script src="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/js/jquery.cubeportfolio.min.js"></script>
