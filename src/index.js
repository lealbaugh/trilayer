import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';

var perspective = false;
var orbit = true;
var numberOfSheets = 3;
var stitchSize = 2;
var stitchSpacing = 5;
var yarnWidth = stitchSize;
var sheetWidth = 20;
var sheetHeight = 15;
var sheetColors = ["#00ffff", "#ffff00", "#ff00ff"];
var backgrounds = [new THREE.Color(sheetColors[0]).offsetHSL(0,-0.5,-0.1), new THREE.Color(sheetColors[sheetColors.length-1]).offsetHSL(0,-0.5,-0.1)]

var scene, renderer, camera, cubes, geom, raycaster, mouse, intersects, controls;
var sheets = [];
var hovered = [];
var selected = new Set([]);
var facing = new THREE.Vector3();

window.onload = function() {

// Set the scene
	scene = new THREE.Scene();
	
// Lights
	// Set up renderer
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );
	// lights and background
	const light = new THREE.HemisphereLight( 0xeeeeee, 0x555555, 1 );
	scene.add( light );
	scene.background = backgrounds[0];

// Camera
	// Set up camera
	if (perspective) camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
	else camera = new THREE.OrthographicCamera( window.innerWidth  / -16, window.innerWidth  /16, window.innerHeight /16, window.innerHeight / -16, 0.001, 1000 );
	// init the sheets...
	for (var i = 0; i<numberOfSheets; i++) {
		var thisSheet = new Sheet(sheetWidth, sheetHeight, sheetColors[i%sheetColors.length], i);
		sheets.push(thisSheet);
		scene.add(thisSheet);

	}
	for (var i = 0; i<sheets.length; i++) {
		var thisSheet = sheets[i];
		for (var j=0; j<sheets.length; j++) {
			if (i!=j) thisSheet.setSisters(sheets[j]);
		}
	}
	// ...and point the camera at 'em
	// camera.position.set( 400, 25, 40 );
	camera.position.set( -150, 100, -150 );
	console.log(sheets[0].getCenter().position);
	// camera.lookAt( new THREE.Vector3( sheets[0].getCenter().position ) );
	// camera.lookAt( sheets[0].getCenter().position );
	// camera.lookAt()


// Action
	// make it interactive...
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector3();
	window.addEventListener( 'mousemove', onMouseMove, false );
	window.addEventListener( 'click', onMouseClick, false );
	window.addEventListener( 'resize', onWindowResize, false );
	window.addEventListener( 'keydown', keyPress, false );


	if (orbit) {
		controls = new OrbitControls( camera, renderer.domElement );
		controls.target = sheets[0].getCenter().position;
	}
	else {
		controls = new TrackballControls( camera, renderer.domElement );
		controls.rotateSpeed = 2.0;
		controls.zoomSpeed = 1.2;
		controls.panSpeed = 0.8;
	}

	// ...begin.
	animate();

}

function keyPress(e) {
	if (e.code == "ArrowRight" || e.code == "ArrowLeft") {
		if (selected.size>0) {
			var dir = 0;
			if (e.code == "ArrowRight") dir = 1;
			else if (e.code == "ArrowLeft") dir = -1;
			selected.forEach(function (obj) {
				obj.transpose(dir);
			});
			sheets.forEach(function (sheet) {
				sheet.updateNoodles();
			});
		}
	}
}

function onMouseMove( e ) {
	updateHover(e);

	// reset all to default color
	sheets.forEach(function(sheet){
		sheet.resetColor();
	});

	// turn hovered white
	hovered.forEach(function(obj){
		// console.log(typeof(obj));
		obj.material.color.setRGB( 1.0, 1.0, 1.0 );
	});
}

function updateHover (e) {
	mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;					

	hovered = [];
	raycaster.setFromCamera( mouse, camera );
	intersects = raycaster.intersectObjects( scene.children, true ); //recursive = true
	for( var i = 0; i < intersects.length; i++ ) {
		var obj = intersects[i].object;
		if (obj.type=="stitch"){
			hovered.push(obj);
		}
	}
}

function onMouseClick( e ) {
	updateHover(e);
	
	if (hovered.length>0) {
		hovered.forEach(function(obj){
			if ((obj.layerPosition == 0 && facing.z>0) || (obj.layerPosition == numberOfSheets-1 && facing.z<=0)) {
				var state = obj.toggleSelection();
				if (state) selected.add(obj);
				else selected.delete(obj);
			}
		});

		// if shift key and something is already selected, rectangle-select everything between the prev and this one
		if (e.shiftKey && selected.size>=2) {
			var selArray = [...selected];
			if (selArray.length>=2){
				if (selArray[selArray.length-1].layerPosition == selArray[selArray.length-2].layerPosition) {
					sheets.forEach(function(sheet){
						var newSelection = sheet.rectangleSelect(selArray[selArray.length-1], selArray[selArray.length-2]);
						newSelection.forEach(function(obj){
							selected.add(obj);
							obj.select();
						});
					});
				}
			}
		}
	}
}

function rectangleSelect(topLeft, bottomRight) {
	var selection = [];
	// get all squares between these, at the same pos as them
	if (topLeft && bottomRight && topLeft.get.layerPosition == bottomRight.get.layerPosition) {
		selection = sheet.boundedStitches (topLeftCorner, bottomRightCorner);
	}
	for( var i = 0; i < selection.length; i++ ) {
		selection[i].material.color.setRGB( 1.0, 1.0, 0 );
	}	

}

function onWindowResize( e ) {
	const aspect = window.innerWidth / window.innerHeight;

	if (perspective) {
		camera.aspect = aspect;
		camera.updateProjectionMatrix();
	}

	else {
		camera.left = window.innerWidth  / - 16;
		camera.right = window.innerWidth  / 16;
		camera.top = window.innerHeight / 16;
		camera.bottom = window.innerHeight / - 16;
		camera.updateProjectionMatrix();
	}
	renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
	requestAnimationFrame( animate );
	controls.update();
	renderer.render( scene, camera );
	camera.getWorldDirection(facing);
	if (facing.z<0) scene.background = backgrounds[0];
	else scene.background = backgrounds[1];
}


class Stitch extends THREE.Mesh {
	constructor(sheet, layerPos, color) {
		// relations: row, column, neighborBefore, neighborAfter, parent, child
		var geom = new THREE.SphereGeometry( stitchSize, 32, 32 );
		var mat = new THREE.MeshToonMaterial({color: color});
		super( geom, mat );
		this.selected = false;
		this.color = color;
		this.highlightColor = new THREE.Color(this.color).offsetHSL(0,-0.2,0.5)
		this.relationConfig = {};
		this.sheet = sheet;
		this.layerPosition = layerPos;
		this.sheet.add(this);
		this.sisters = [];
		this.type = "stitch";
	}

	resetColor(){
		if (this.selected) this.material.color.set(this.highlightColor);
		else this.material.color.set(this.color);
	}
	moveToPos(newPos) {
		this.layerPosition = newPos;
		this.position.set(stitchSpacing*this.relationConfig.column, stitchSpacing*this.relationConfig.row, stitchSpacing*this.layerPosition);
	}
	setRelations(relations) {
		this.relationConfig = relations;
		this.moveToPos(this.layerPosition);
		// this.position.set(stitchSpacing*this.relationConfig.column, stitchSpacing*this.relationConfig.row, stitchSpacing*this.layerPosition);
	}
	addSister(sister) {
		this.sisters.push(sister);
	}

	transpose (dir) {
		var newPos = this.layerPosition + dir;
		if (newPos>=0 && newPos<numberOfSheets) {
			var oldPos = this.layerPosition;
			console.log(newPos);
			this.moveToPos(newPos);
			this.sisters.forEach(function (sis) {
				if (sis.layerPosition == newPos) sis.moveToPos(oldPos);
			});
		}
	}
	select() {
		this.selected = true;
		this.material.color.set(this.highlightColor);
		this.sisters.forEach(function (sis) {
			sis.unselect();
		});
	}
	unselect () {
		this.selected = false;
		this.material.color.set(this.color);
	}
	toggleSelection() {
		// this.selected = !this.selected;
		if (this.selected) {
			this.unselect()
			// console.log(this.relationConfig.row, this.relationConfig.column);
			// this.material.color.set(this.highlightColor);
		}
		else this.select();
		return this.selected;
	}
	get relations() {
		return this.relationConfig;
	}
	// get layerPos() {
	// 	return this.layerPosition;
	// }
	get row() {
		return this.relationConfig.row;
	}
	get column() {
		return this.relationConfig.column;
	}
 }

// // https://threejs.org/docs/index.html#api/en/extras/curves/CatmullRomCurve3
// class Noodle extends THREE.Line {
// 	constructor(sheet, stitches, color) {
// 		var geom = new THREE.BufferGeometry();
// 		var positions = new Float32Array( stitches.length * 3 ); // 3 vertices per point
// 		for ( var i = 0; i < stitches.length; i ++ ) {
// 			var pos = stitches[i].position;
// 		    positions[i * 3] = pos.x;
// 		    positions[(i * 3)+1] = pos.y;
// 		    positions[(i * 3)+2] = pos.z;
// 		}
// 		geom.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );


// 		// var curve = new THREE.CatmullRomCurve3(locs);
// 		// var points = curve.getPoints( sheetWidth * 4 );
// 		// var geom = new THREE.BufferGeometry().setFromPoints( points );
// 		var mat = new THREE.LineBasicMaterial( { color : color, linewidth: 100} );
// 		// var mat = new LineMaterial( { color: color, linewidth: 10,  vertexColors: true, dashed: false, alphaToCoverage: true} );

// 		super(geom, mat);
// 		this.stitches = stitches;
// 		this.sheet = sheet;
// 		this.sheet.add(this);
// 	}

// 	// getStitchLocs(stitchList) {
// 	// 	var locs = [];
// 	// 	for (var i=0; i<stitchList.length;i++) {
// 	// 		locs.push(stitchList[i].position);
// 	// 	}
// 	// 	return locs;
// 	// }

// 	update() {
// 		var positions = this.geometry.getAttribute("position");
// 		// console.log(positions);
// 		for ( var i = 0; i < this.stitches.length; i ++ ) {
// 			var pos = this.stitches[i].position;
// 		    positions.array[i * 3] = pos.x;
// 		    positions.array[(i * 3)+1] = pos.y;
// 		    positions.array[(i * 3)+2] = pos.z;
// 		}
// 		// var newPositions = this.getStitchLocs(this.stitches);
// 		// var curve = new THREE.CatmullRomCurve3(newPositions);
// 		// var points = curve.getPoints( sheetWidth * 4 );
// 		// this.geometry.attributes.position.array = points;
// 		this.geometry.setAttribute( 'position', positions );
// 		this.geometry.attributes.position.needsUpdate = true;
// 	}
// }

class Noodle extends THREE.Mesh {
	constructor(sheet, stitches, color) {
		var locs = [];
		for (var i=0; i<stitches.length;i++) {
			var pos = stitches[i].position;
			locs.push(pos.x, pos.y, pos.z);
		}
		var line = new MeshLine();
		line.setPoints(locs);
		var mat = new MeshLineMaterial({ color : color, linewidth: yarnWidth, sizeAttenuation:true});

		super(line, mat);
		this.stitches = stitches;
		this.sheet = sheet;
		this.line = line;
		this.sheet.add(this);
	}

	update() {
		var locs = [];
		for (var i=0; i<this.stitches.length;i++) {
			var pos = this.stitches[i].position;
			locs.push(pos.x, pos.y, pos.z);
		}
		this.line.setPoints(locs);
		this.geometry.attributes.position.needsUpdate = true;
	}
}


class Sheet extends THREE.Group {
	constructor(height, width, color, startPos) {
		super();
		this.height = height;
		this.width = width;
		this.color = color;
		this.startPos = startPos;
		this.stitches = [];
		this.noodles = [];

		for (var h=0; h<height; h++) {
			var rowGroup = [];
			for (var w=0; w<width; w++) {
				// mat.color.setRGB(0,h/height, w/width);
				var thisStitch = new Stitch(this, startPos, color);
				rowGroup.push(thisStitch);
			}
			this.stitches.push(rowGroup);
		}
		for (var h=0; h<this.stitches.length; h++) {
			for (var w=0; w<this.stitches[h].length; w++) {
				var neighborBefore, neighborAfter, parent, child = null;
				if (h>0) parent=this.stitches[h-1][w];
				if (h<this.stitches.length-1) child = this.stitches[h+1][w];
				if (w>0) neighborBefore=this.stitches[h][w-1];
				if (w<this.stitches[h].length-1) neighborAfter = this.stitches[h][w+1];
				this.stitches[h][w].setRelations({row: h, column: w, neighborBefore:neighborBefore, neighborAfter:neighborAfter, parent:parent, child:child});
			}
			var thisNoodle = new Noodle(this, this.stitches[h], color);
			this.noodles.push(thisNoodle);
		}
	}
	setSisters(otherSheet) {
		// console.log(otherSheet.stitches.length, otherSheet.stitches[0].length);
		for (var h=0; h<this.stitches.length; h++) {
			// console.log("h",h);
			for (var w=0; w<this.stitches[h].length; w++) {
				// console.log("w",w);
				// console.log(otherSheet.stitches[h][w]);
				this.stitches[h][w].addSister(otherSheet.stitches[h][w]);
			}
		}
	}
	resetColor() {
		for (var h=0; h<this.stitches.length; h++) {
			for (var w=0; w<this.stitches[h].length; w++) {
				this.stitches[h][w].resetColor();
			}
		}
	}
	updateNoodles() {
		this.noodles.forEach(function (noodle) {
			noodle.update();
		});
	}

	rectangleSelect (corner1, corner2) {
		var selection = [];
		var leftedge = Math.min(corner1.column, corner2.column);
		var rightedge = Math.max(corner1.column, corner2.column);
		var topedge = Math.max(corner1.row, corner2.row);
		var bottomedge = Math.min(corner1.row, corner2.row);

		for (var row = bottomedge; row<=topedge; row++) {
			for (var column = leftedge; column<=rightedge; column++) {
				if (this.stitches[row][column].layerPosition == corner1.layerPosition) selection.push(this.stitches[row][column]);
			}
		}
		return selection;
	}
	getCenter() {
		var centerStitch = this.stitches[Math.round(this.stitches.length/2)][Math.round(this.stitches[0].length/2)];
		return centerStitch;
	}
}