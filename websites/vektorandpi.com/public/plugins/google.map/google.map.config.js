(function ($) {
	$(document).ready(function () {

		var styles = {
			default: null,
			silver: [
				{
					stylers: [
						{ 'saturation': -100 },
						//{ 'lightness': 51 },
						{ 'visibility': 'simplified' }
					]
				},
				{
					elementType: 'geometry',
					stylers: [{ visibility: 'on' }]
				},
				{
					elementType: 'labels.icon',
					stylers: [{ visibility: 'on' }]
				},
				{
					featureType: "road",
					elementType: "labels",
					stylers: [{
						visibility: "on"
					}]
				}
			]
		};

		var mapOptions = {
			zoom: 17,
			center: new google.maps.LatLng(33.856589, 35.535963),
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};

		var map = new google.maps.Map(document.getElementById('map-canvas'),
			mapOptions);

		var marker = new google.maps.Marker({
			map: map,
			position: new google.maps.LatLng(33.856589, 35.535963),
			icon: '/images/marker-vektor.png'
		});

		map.setOptions({ styles: styles["silver"] });

		//		var markerImage = new google.maps.MarkerImage(
		//			'/images/marker-vektor.png'
		////,
		////			new google.maps.Size(122, 43), //size
		////			null, //origin
		////			null, //anchor
		////			new google.maps.Size(61, 22) //scale
		//		);


		//		// Google Maps
		//		//-----------------------------------------------
		//		if ($("#map-canvas").length > 0) {
		//			var map, myLatlng, myZoom, marker;
		//			// Set the coordinates of your location
		//			myLatlng = new google.maps.LatLng(33.856589, 35.535963);
		//			myZoom = 18;



		//			var styles = {
		//				default: null,
		//				silver: [
		//					{
		//						stylers: [
		//							{ 'saturation': -100 },
		//							//{ 'lightness': 51 },
		//							{ 'visibility': 'simplified' }
		//						]
		//					},
		//					{
		//						elementType: 'geometry',
		//						stylers: [{ visibility: 'on' }]
		//					},
		//					{
		//						elementType: 'labels.icon',
		//						stylers: [{ visibility: 'on' }]
		//					},
		//					{
		//						featureType: "road",
		//						elementType: "labels",
		//						stylers: [{
		//							visibility: "on"
		//						}]
		//					}
		//				]
		//			};


		//			//var styles = [{
		//			//	stylers: [
		//			//		{ 'saturation': -100 },
		//			//		//{ 'lightness': 51 },
		//			//		{ 'visibility': 'simplified' }
		//			//	]
		//			//}, {
		//			//	featureType: "poi",
		//			//	elementType: "labels",
		//			//	stylers: [{
		//			//		visibility: "on"
		//			//	}]
		//			//}, {
		//			//	featureType: "administrative",
		//			//	elementType: "labels",
		//			//	stylers: [{
		//			//		color: "#"
		//			//	}]
		//			//}, {
		//			//	featureType: "road.local",
		//			//	elementType: "geometry",
		//			//	stylers: [{
		//			//		visibility: "on"
		//			//	}]
		//			//}, {
		//			//	featureType: "road",
		//			//	elementType: "labels",
		//			//	stylers: [{
		//			//		visibility: "on"
		//			//	}]
		//			//}];

		//			//var styledMap = new google.maps.StyledMapType(styles, {
		//			//	name: "Styled Map"
		//			//});

		//			//function initialize() {
		//			var mapOptions = {
		//				zoom: myZoom,
		//				mapTypeId: google.maps.MapTypeId.ROADMAP,
		//				center: myLatlng,
		//				scrollwheel: false,
		//				mapTypeControl: false,
		//				navigationControl: false,
		//				streetViewControl: false,
		//				mapTypeControlOptions: {
		//					mapTypeIds: [google.maps.MapTypeId.TERRAIN, 'custom_map_style']
		//				}
		//			};
		//			map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
		//			marker = new google.maps.Marker({
		//				map: map,
		//				draggable: false,
		//				animation: google.maps.Animation.DROP,
		//				position: myLatlng,
		//				icon: markerImage
		//			});
		//			google.maps.event.addDomListener(window, "resize", function () {
		//				map.setCenter(myLatlng);
		//			});

		//			map.setOptions({ styles: styles["silver"] });
		//			//}


		//			//map.mapTypes.set('custom_map_style', styledMap);
		//			//map.setMapTypeId('custom_map_style');


		//			//google.maps.event.addDomListener(window, "load", initialize);
		//		}

	}); // End document ready

})(this.jQuery);		