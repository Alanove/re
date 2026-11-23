using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Data.SqlClient;

using lw.Menus;
using lw.Data;
using lw.CTE.Enum;
using lw.Base;
using lw.WebTools;
using lw.Pages;
using lw.PhotoAlbums;
using System.Data;


/// <summary>
/// Summary description for Menu
/// </summary>

public class SiteMenu
{
    public lwMenu MainMenu;
    CustomPage _page = null;

    public SiteMenu(CustomPage page)
    {
        _page = page;
        InitMenu();
    }

    public SiteMenu()
    {
        InitMenu();
    }


    void InitMenu()
    {
        MainMenu = new lwMenu("main", "~/", true);
        MainMenu.ContainerTag = "ul";
        MainMenu.AddChild("Home", "~/");
        MainMenu.ClassName = "nav navbar-nav dd-list";

        PagesManager pMgr = new PagesManager();

        IQueryable<lw.Pages.data.Page> pages = pMgr.GetPages();

        if (!_page.Editable)
        {
            pages = from p in pages
                    where
                        (p.PublishDate == null || p.PublishDate <= DateTime.Now)
                        &&
                        (p.Status == (byte)PageStatus.Published || p.Status == (byte)PageStatus.Dynamic || p.Status == (byte)PageStatus.Important ||
                        p.Status == (byte)PageStatus.Menu)
                    select p;
        }
        else
        {
            pages = from p in pages
                    where
                        p.Status != (byte)PageStatus.Deleted
                    select p;
        }

        foreach (lw.Pages.data.Page page in pages)
        {
            if (page.ParentId != -1)
                continue;

            if (page.URL == "home-page")
                continue;

            lwMenu menu = GetMenuWithChildren(page, pages);
            menu.GetUrlFromFirstChild = true;

			//if ("tea".IndexOf(page.URL.ToLower()) >= 0)
			//	menu.GetUrlFromFirstChild = false;
            //else
            //    menu.GetUrlFromFirstChild = true;

            MainMenu.AddChild(menu);
        }

        //if (MainMenu.Children.Count > 0)
        //    MainMenu.Children[0].url = lw.WebTools.WebContext.Root;
    }

    lwMenu GetMenuWithChildren(lw.Pages.data.Page page, IQueryable<lw.Pages.data.Page> pages)
    {
        lwMenu menu = new lwMenu(page.Title, page.URL);
        menu.id = page.PageId;
        menu.IsRoot = true;
        menu.SubPlaceHolder = "";
        menu.GetUrlFromFirstChild = false;
        menu.ClassName = "dd-item";
        if (page.Status == (byte)PageStatus.Hidden)
        {
            menu.ClassName += " disabled";
        }

        if (page.URL != "news-events")
        {
            var children = from p in pages
                           where p.ParentId == page.PageId
                           select p;

            foreach (lw.Pages.data.Page child in children)
            {
                if (!(String.IsNullOrWhiteSpace(child.PageFile) || _page.Editable))
                    menu.AddChild(child.Title, lw.WebTools.WebContext.Root + "/" + lw.CTE.Folders.PagesFolder + "/Page_" + child.PageId + "/" + child.PageFile);
                else
                    menu.AddChild(child.Title, child.URL, child.PageId);

                if (child.Status == (byte)PageStatus.Hidden)
                    menu.Children[menu.Children.Count - 1].ClassName = "disabled";
            }
        }
        menu.ContainerTag = "ul";
        return menu;
    }
}
