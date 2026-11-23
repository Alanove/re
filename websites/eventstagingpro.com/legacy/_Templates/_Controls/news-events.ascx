<%@ Control Language="C#" %>

<link rel="stylesheet" href="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/css/cubeportfolio.min.css" />

<lw:PagesDataSource EnablePaging="true" PageSize="12" ParentURL="news-events" ID="News" runat="server" Sort="DateDesc">

	<lw:CustomRepeater runat="server">
		<HeaderTemplate>
			<div class="newsContainer">
				<div id="grid-container" class="cbp-l-grid-blog">
		</HeaderTemplate>
		<ItemTemplate>
			<div class="cbp-item">
				<lw:PageLink runat="server" class="cbp-caption">
					<div class="cbp-caption-defaultWrap">
						<lw:PageImage ImageType="Thumb" runat="server" NoImage="../images/no-image.jpg" />
					</div>
				</lw:PageLink>
				<div class="desc">
					<lw:PageLink runat="server" class="cbp-l-grid-blog-title" ImEditable="true">
						<lw:DataProperty Property="Title" runat="server" />
					</lw:PageLink>
					<div class="cbp-l-grid-blog-desc">
						<lw:DataProperty Property="SmallDescription" runat="server" PutBR="false" MaxCharacters="160" ClosingSentence="..." />
					</div>
				</div>
			</div>
		</ItemTemplate>
		<FooterTemplate>
			</div>
			</div>
		</FooterTemplate>
	</lw:CustomRepeater>
	<lw:DSNoData runat="server">
		No news at the moment, keep checking this page for further updates.
	</lw:DSNoData>
	<lw:PagingControl Source="News" NextText=">" PreviousText="<" runat="server">
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
</lw:PagesDataSource>
<script src="<lw:root runat='server' />/plugins/cube-portfolio/cubeportfolio/js/jquery.cubeportfolio.min.js"></script>
