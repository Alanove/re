document.addEventListener('DOMContentLoaded', function () {
  var searchIcon = document.querySelector('.tm-search-icon.search');
  var searchWrapping = document.querySelector('.search_wrapping');
  var searchForm = document.querySelector('.searching_form');
  var closeSearch = document.querySelector('.close_search');

  if (searchIcon && searchForm) {
    searchIcon.addEventListener('click', function () {
      searchForm.classList.toggle('show');
      if (searchWrapping) searchWrapping.classList.toggle('show');
    });
  }
  if (closeSearch) {
    closeSearch.addEventListener('click', function () {
      searchForm.classList.toggle('show');
      if (searchWrapping) searchWrapping.classList.toggle('show');
    });
  }

  var submit = document.querySelector('.search-submit');
  if (submit) submit.value = '';
});
