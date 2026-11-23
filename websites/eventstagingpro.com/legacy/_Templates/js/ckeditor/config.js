/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or http://ckeditor.com/license
 */
CKEDITOR.disableAutoInline = false;

CKEDITOR.editorConfig = function (config) {
	// Define changes to default configuration here.
	// For complete reference see:
	// http://docs.ckeditor.com/#!/api/CKEDITOR.config

	// The toolbar groups arrangement, optimized for two toolbar rows.
	config.toolbarGroups = [
		{ name: 'clipboard', groups: ['clipboard', 'undo'] },
		{ name: 'editing', groups: ['find', 'selection', 'spellchecker'] },
		{ name: 'links' },
		{ name: 'insert' },
		{ name: 'forms' },
		{ name: 'tools' },
		{ name: 'document', groups: ['mode', 'document', 'doctools'] },
		{ name: 'others' },
		'/',
		{ name: 'basicstyles', groups: ['basicstyles', 'cleanup'] },
		{ name: 'paragraph', groups: ['list', 'indent', 'blocks', 'align', 'bidi'] },
		{ name: 'styles' },
		{ name: 'colors' },
		{ name: 'about' }
	];

	config.height = '600px';

	// Remove some buttons provided by the standard plugins, which are
	// not needed in the Standard(s) toolbar.
	config.removeButtons = 'Underline,Subscript,Superscript';

	// Set the most common block elements.
	config.format_tags = 'p;h1;h2;h3;pre';

	// Simplify the dialog windows.
	//config.removeDialogTabs = 'image:advanced;link:advanced';


	config.extraAllowedContent = 'h4;h5;div(col-md-*,col-sm-*,col-xs-*,col-lg-*,container,container-fluid,row,text-center,img); div(*); ul(*); li(*); a(*); table(*); th(*); i(*); iframe(*)';

	config.autoParagraph = false;
	config.enterMode = CKEDITOR.ENTER_P;

	config.filebrowserBrowseUrl = lw.vroot + '/js/FileManager/files.html';
	config.filebrowserImageBrowseUrl = lw.vroot + '/js/FileManager/images.html';
	config.filebrowserUploadUrl = lw.vroot + '/js/FileManager/connectors/ashx/filemanager.ashx?mode=quickadd&currentpath=/downloads/public/';
	config.filebrowserImageUploadUrl = lw.vroot + '/js/FileManager/connectors/ashx/filemanager.ashx?mode=quickadd&currentpath=/images/public/';
	config.filebrowserWindowWidth = '800';
	config.filebrowserWindowHeight = '600';

//	config.extraPlugins = 'dialog';
	//config.extraPlugins = 'btgrid';
	//config.extraPlugins = 'youtube';
	//config.extraPlugins = 'basewidget';
	config.extraPlugins = 'layoutmanager';
	//config.youtube_width = '';
	//config.youtube_height = '';

	config.extraPlugins = 'widget,widgetbootstrap,lineutils,dialog,image2,youtube';
	

};
