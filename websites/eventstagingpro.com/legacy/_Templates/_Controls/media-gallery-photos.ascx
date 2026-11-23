<%@ Control Language="C#" %>

<link rel="stylesheet" href="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/css/cubeportfolio.min.css" />

<lw:PhotoAlbumsDataSource EnablePaging="true" PageSize="20"  ID="Albums" runat="server" OrderBy="DateAdded desc">
	<lw:CustomRepeater runat="server">
		<HeaderTemplate>
			<div class="galleryContainer">
				<div id="grid-container" class="cbp-l-grid-masonry-projects">
		</HeaderTemplate>
		<ItemTemplate>
			<div class="cbp-item">
				<div class="cbp-caption">
					<div class="cbp-caption-defaultWrap">
						<lw:PhotoAlbumsLink runat="server" Path="media-gallery/photos">
							<lw:PhotoAlbumImage runat="server" AlbumImageType="Thumb" />
						</lw:PhotoAlbumsLink>
					</div>
				</div>
				<lw:PhotoAlbumsLink runat="server" Path="media-gallery/photos"  class="cbp-l-grid-masonry-projects-title">
					<lw:DataProperty Property="DisplayName" runat="server" Format="{0}" />
				</lw:PhotoAlbumsLink>
			</div>
		</ItemTemplate>
		<FooterTemplate>
			</div>
		</div>	
		</FooterTemplate>
	</lw:CustomRepeater>

	<lw:DSNoData runat="server">
		No photo albums at the moment, keep checking this page for further updates.
	</lw:DSNoData>
	<lw:PagingControl Source="Albums" NextText=">" PreviousText="<" runat="server">
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
</lw:PhotoAlbumsDataSource>
<script src="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/js/jquery.cubeportfolio.min.js"></script>