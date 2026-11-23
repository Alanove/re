<%@ Control Language="C#" AutoEventWireup="true" CodeFile="Header.ascx.cs" Inherits="_Controls_Header" %>

<header>
    <div class="main-navigation">
        <nav class="esp-page-header navbar navbar-default navbar-fixed-top" data-role="navigation">
            <div class="container">
                <div class="menu-container">
                    <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".mainMenu">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </button>
                    <a class="navbar-brand" href="~/" runat="server">
                        <img src="~/images/logo.png" alt="" runat="server">
                    </a>
                </div>
                <div class="collapse navbar-collapse mainMenu" >
                    <div class="menu-container" id="mainMenu" runat="server"></div>
                </div>
            </div>
        </nav>
    </div>
</header>
