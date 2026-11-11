(function () {
  function initMemberParkingMap() {
    var root = document.getElementById('memberParkingMap');
    var dataEl = document.getElementById('memberParkingData');
    if (!root || root.getAttribute('data-ready') === '1') return;
    root.setAttribute('data-ready', '1');

    var viewport = root.querySelector('[data-parking-viewport]');
    var stage = root.querySelector('[data-parking-stage]');
    var image = root.querySelector('.parking-map__image');
    if (!viewport || !stage || !image) return;

    var highlights = [];
    try {
      highlights = JSON.parse(dataEl ? dataEl.textContent || '{}' : '{}').highlights || [];
    } catch (error) {
      highlights = [];
    }

    var view = { scale: 1, tx: 0, ty: 0 };
    var pan = null;

    function apply() {
      stage.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
    }

    function stageSize() {
      return { w: stage.offsetWidth, h: stage.offsetHeight };
    }

    function fitPlan() {
      var size = stageSize();
      if (!size.w || !size.h) return;
      var s = Math.min(viewport.clientWidth / size.w, viewport.clientHeight / size.h);
      view.scale = s || 1;
      view.tx = (viewport.clientWidth - size.w * view.scale) / 2;
      view.ty = (viewport.clientHeight - size.h * view.scale) / 2;
      apply();
    }

    function zoomAt(clientX, clientY, nextScale) {
      var rect = viewport.getBoundingClientRect();
      var mx = clientX - rect.left;
      var my = clientY - rect.top;
      var s1 = Math.max(0.4, Math.min(14, nextScale));
      var sx = (mx - view.tx) / view.scale;
      var sy = (my - view.ty) / view.scale;
      view.scale = s1;
      view.tx = mx - sx * s1;
      view.ty = my - sy * s1;
      apply();
    }

    function showSpots() {
      var points = [];
      highlights.forEach(function (item) {
        (item.bays || []).forEach(function (bay) {
          (bay.points || []).forEach(function (point) { points.push(point); });
        });
      });
      if (!points.length) return;
      var size = stageSize();
      if (!size.w || !size.h) return;
      var minX = 100;
      var minY = 100;
      var maxX = 0;
      var maxY = 0;
      points.forEach(function (point) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
      var padX = Math.max(1.5, (maxX - minX) * 0.45);
      var padY = Math.max(1.5, (maxY - minY) * 0.45);
      minX = Math.max(0, minX - padX);
      minY = Math.max(0, minY - padY);
      maxX = Math.min(100, maxX + padX);
      maxY = Math.min(100, maxY + padY);
      var bw = ((maxX - minX) / 100) * size.w;
      var bh = ((maxY - minY) / 100) * size.h;
      if (bw < 1 || bh < 1) return;
      var s = Math.max(1, Math.min(12, Math.min(viewport.clientWidth / bw, viewport.clientHeight / bh)));
      var cx = ((minX + maxX) / 2 / 100) * size.w;
      var cy = ((minY + maxY) / 2 / 100) * size.h;
      view.scale = s;
      view.tx = viewport.clientWidth / 2 - cx * s;
      view.ty = viewport.clientHeight / 2 - cy * s;
      apply();
    }

    root.querySelectorAll('[data-parking-zoom]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-parking-zoom');
        var rect = viewport.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        if (action === 'in') zoomAt(cx, cy, view.scale * 1.25);
        else if (action === 'out') zoomAt(cx, cy, view.scale / 1.25);
        else if (action === 'spots') showSpots();
        else fitPlan();
      });
    });

    viewport.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      pan = { id: event.pointerId, x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty };
      viewport.classList.add('is-panning');
      viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener('pointermove', function (event) {
      if (!pan || pan.id !== event.pointerId) return;
      view.tx = pan.tx + (event.clientX - pan.x);
      view.ty = pan.ty + (event.clientY - pan.y);
      apply();
    });

    function endPan(event) {
      if (!pan || pan.id !== event.pointerId) return;
      pan = null;
      viewport.classList.remove('is-panning');
    }

    viewport.addEventListener('pointerup', endPan);
    viewport.addEventListener('pointercancel', endPan);
    viewport.addEventListener('wheel', function (event) {
      event.preventDefault();
      var factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(event.clientX, event.clientY, view.scale * factor);
    }, { passive: false });

    function start() {
      fitPlan();
    }

    if (image.complete && image.naturalWidth) start();
    else image.addEventListener('load', start);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMemberParkingMap);
  } else {
    initMemberParkingMap();
  }
})();
