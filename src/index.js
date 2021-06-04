import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';

// https://github.com/eligrey/FileSaver.js
import { saveAs } from 'file-saver';
import { planner } from './knitPlanner';


var perspective = false;
var orbit = true;

var settings = {
	numberOfSheets: 3,
	stitchSize: 1.5,
	stitchSpacing: 2,
	aspectRatio: 4,
	layerSpacing: 3,
	yarnWidth: 1.5,
	sheetWidth: 20,
	sheetHeight: 80,
	carrierConfig:{
		"4": "#00ffff",
		"3": "#ffff00",
		"5": "#ff00ff"
	},
	sheetNames: ['a', 'b', 'c', 'd', 'e'],
}

// var sheetColors = ["#00ffff", "#ffff00", "#ff00ff"];
// var backgrounds = [new THREE.Color(sheetColors[0]).offsetHSL(0,-0.5,-0.1), new THREE.Color(sheetColors[sheetColors.length-1]).offsetHSL(0,-0.5,-0.1)]
// var backgrounds = [new THREE.Color(carrierConfig[carriers[0]]).offsetHSL(0,-0.6,0.2), new THREE.Color(carrierConfig[carriers[carriers.length-1]]).offsetHSL(0,-0.6,0.2)]

var scene, renderer, camera, stitchGeom, raycaster, mouse, intersects, controls;
var yarnMats = {};
var sheets = [];
var backgrounds = [];
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

// Camera
	// Set up camera
	if (perspective) camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
	else camera = new THREE.OrthographicCamera( window.innerWidth  / -16, window.innerWidth  /16, window.innerHeight /16, window.innerHeight / -16, 0.001, 1000 );
	// init the sheets...

	yarnMats = initYarns();
	sheets = initSheets();
	backgrounds = initBackgrounds();
	scene.background = backgrounds[0]; // has to be done after initSheets because that also inits the background colors
	// ...and point the camera at 'em
	// camera.position.set( 400, 25, 40 );
	camera.position.set( -150, 100, -150 );
	// console.log(sheets[0].getCenter().position);
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
	window.addEventListener( 'drop', onDrop, false);
	window.addEventListener("dragover", onDragOver, false);
	window.addEventListener("dragenter", onDragEnter, false);

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

	initText();

	// ...begin.
	animate();

}

function animate() {
	requestAnimationFrame( animate );
	controls.update();
	renderer.render( scene, camera );
	camera.getWorldDirection(facing);
	if (facing.z<0) scene.background = backgrounds[0];
	else scene.background = backgrounds[1];
}

function initYarns() {
	var oldYarns = [];
	for (var yarn in yarnMats){
		oldYarns.push(yarnMats[yarn]);
	}
	var newYarnMats = {};
	for (var carrier in settings.carrierConfig) {
		var carrierColor = settings.carrierConfig[carrier];
		var selectedColor = new THREE.Color(carrierColor).offsetHSL(0,0.0,0.5);
		var hoveredColor = new THREE.Color(carrierColor).offsetHSL(0.5,0.0,0.4);
		newYarnMats[carrier] = new THREE.MeshToonMaterial({color: carrierColor});
		newYarnMats[carrier+"selected"] = new THREE.MeshToonMaterial({color: selectedColor});
		newYarnMats[carrier+"hovered"] = new THREE.MeshToonMaterial({color: hoveredColor});
	}
	oldYarns.forEach(function(thisYarn) {
		thisYarn.dispose;
	});
	return newYarnMats;
}

function initSheets() {
	var oldSheets = [];
	sheets.forEach(function (thisSheet) {
		oldSheets.push(thisSheet);
	});

	// make the geometry and materials
	stitchGeom = new THREE.SphereGeometry( settings.stitchSize, 8, 8 );

	// new place to hold the sheets
	var newSheets = [];

	var carriers = Object.keys(settings.carrierConfig);
	for (var i = 0; i<settings.numberOfSheets; i++) {
		var thisSheet = new Sheet(settings.sheetWidth, settings.sheetHeight, carriers[i%carriers.length], i, settings.sheetNames[i]);
		newSheets.push(thisSheet);
		scene.add(thisSheet);

	}
	for (var i = 0; i<newSheets.length; i++) {
		var thisSheet = newSheets[i];
		for (var j=0; j<newSheets.length; j++) {
			if (i!=j) thisSheet.setSisters(newSheets[j]);
		}
	}
	oldSheets.forEach(function(thisSheet) {
		thisSheet.children.forEach(function(thisThing) {
			thisThing.dispose;
		});
		thisSheet.dispose;
	});
	return newSheets;
}

function initBackgrounds() {
	var newBackgrounds = [];
	newBackgrounds.push(new THREE.Color(sheets[0].color).offsetHSL(0,-0.6,0.2));
	newBackgrounds.push(new THREE.Color(sheets[sheets.length-1].color).offsetHSL(0,-0.6,0.2));
	return newBackgrounds;
}

function updateSheets(chart) {
	for (var h=0; h<chart.length; h++) {
		var row = chart[h].stackOrders;
		for (var s=0; s<row.length; s++) {
			var stack = row[s];
			for (var pos = 0; pos<stack.length; pos++) {
				sheets.forEach(function (thisSheet) {
					if (thisSheet.name == stack[pos]) {
						if (thisSheet.stitches[h] && thisSheet.stitches[h][s]) {
							// the check is because it's possible to update from a different chart size from before
							thisSheet.stitches[h][s].moveToPos(pos);
						}
					}
				})
			}
		}
	}
	sheets.forEach(function (sheet) {
		sheet.updateNoodles();
	});
}

function initText() {
	var instructions = document.createElement('div');
	instructions.id = "instructions";
	instructions.setAttribute("style", 'position: absolute; top: 1em; left: 1em; color: white; font-family: "Helvetica Neue", Helvetica, sans-serif; font-weight: bold;');
	document.body.appendChild( instructions );
	instructions.innerHTML = "click to select<br>shift-click to rectangle-select<br>'d' to deselect all<br>left/right arrows to move selected stitches<br>'k' to generate and download a knitout file<br>'e' to export as json<br>drag'n'drop a json to load it";
}

// =================================================== 
// =================================================== 
// ===================== Events ====================== 
// =================================================== 
// =================================================== 

function onMouseMove( e ) {
	updateHover(e);
}

function updateHover (e) {
	mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;					

	hovered = [];
	raycaster.setFromCamera( mouse, camera );
	intersects = raycaster.intersectObjects( scene.children, true ); //recursive = true
	for( var i = 0; i < intersects.length; i++ ) {
		var obj = intersects[i].object;
		if (obj.type=="stitch" && ((obj.layerPosition == 0 && facing.z>0) || (obj.layerPosition == settings.numberOfSheets-1 && facing.z<=0))){
			hovered.push(obj);
		}
	}
	// reset all to default color
	sheets.forEach(function(sheet){
		sheet.resetColor();
	});

	// turn hovered to highlight color
	hovered.forEach(function(obj){
		// console.log(typeof(obj));
		obj.hover();
	});
}

function onMouseClick( e ) {
	updateHover(e);
	
	if (hovered.length>0) {
		hovered.forEach(function(obj){
			var state = obj.toggleSelection();
			if (state) selected.add(obj);
			else selected.delete(obj);
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


function keyPress( e ) {
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
	if (e.code == "KeyD") {
		selected.forEach(function (obj) {
			obj.unselect();
		});
		selected.clear();
	}
	if (e.code == "KeyK") {
		var blob = new Blob([planner(getData())], {type: "text/plain;charset=utf-8"});
		saveAs(blob, "trilayer.k");
	}
	if (e.code == "KeyE") {
		var blob = new Blob([JSON.stringify(getData())], {type: "text/json"});
		saveAs(blob, "trilayer.json");		
	}
	if (e.code == "KeyS") {
		console.log(settings);
		console.log(sheets);
	}
}



function onDragOver(e) {
  e.preventDefault();
}
function onDragEnter(e) {
  e.preventDefault();
}
function onDrop( e ) {
	if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
		var files = e.dataTransfer.files;
		var reader = new FileReader();
		reader.onload = function ( e ) {
			var result = event.target.result;
			try {
				var data = JSON.parse(result);
				importData(data);
			}
			catch (error) {
				console.log("failed to import as JSON");
				console.log(error);
			}
		};
		try {
			reader.readAsText(files.item(0));
		}
		catch {
			console.log("not text");
		}
	}
	e.preventDefault();
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



// =================================================== 
// =================================================== 
// ================= Import/Export =================== 
// =================================================== 
// =================================================== 



function importData(data) {
	var needsChartUpdate = false;
	var needsSettingsUpdate = false;
	var needsNewSheets = false;

	var chart = [];
	if (data.settings) {
		for (var setting in data.settings) {
			if (settings[setting] != data.settings[setting]) {
				settings[setting] = data.settings[setting];
				needsSettingsUpdate = true;
				if (setting == "sheetWidth" || setting == "sheetHeight") { // we need to re-roll the chart if so
					needsNewSheets = true;
				}
			}
		}
	}

	// see if it includes a positions chart too
	if (data.chart) {
		// if so, stash them and make a note to update the chart
		chart = data.chart;
		needsChartUpdate = true;
	}
	else if (needsSettingsUpdate) { 
	// we can keep the stitch positions, so stash the existing ones
	// it's okay if sheets are now a different size -- we've written the position updating to account for that
		chart = zipStitches(sheets);
	}

	hovered = [];
	selected.clear();

	if (needsSettingsUpdate) {
		// re-init all
		yarnMats = initYarns();
		sheets = initSheets();
		backgrounds = initBackgrounds();

		needsChartUpdate = true;
	}

	if (needsChartUpdate) {
		updateSheets(chart);
	}
}

function getData () {
	var chart = zipStitches(sheets);
	return {
		settings: settings,
		chart: chart
	};
}

function zipStitches(sheets) {
	var zippedStitches = []
	for (var h=0; h<settings.sheetHeight; h++) {
		var rowGroup = {};
		var stackOrders = [];
		var colors = {};
		sheets.forEach(function (thisSheet) {
			colors[thisSheet.name]=[];
		});
		for (var w=0; w<settings.sheetWidth; w++) {
			var stitchOrder = [];
			sheets.forEach(function (thisSheet) {
				var sheetStitch = thisSheet.stitches[h][w];
				colors[thisSheet.name].push(sheetStitch.yarn);
				stitchOrder[sheetStitch.layerPosition] = thisSheet.name; // put the "name"(canonical number / startPos) of the sheet at the position that that stitch is currently at
			});
			stackOrders.push(stitchOrder);
		}
		rowGroup.stackOrders = stackOrders;
		rowGroup.colors = colors;
		zippedStitches.push(rowGroup);
	}
	return zippedStitches;
}





// =================================================== 
// =================================================== 
// ===================== Classes ===================== 
// =================================================== 
// =================================================== 










class Stitch extends THREE.Mesh {
	constructor(sheet, layerPos, yarn) {
		// relations: row, column, neighborBefore, neighborAfter, parent, child
		super( stitchGeom, yarnMats[yarn] );
		this.selected = false;
		this.yarn = yarn;
		this.relationConfig = {};
		this.sheet = sheet;
		this.layerPosition = layerPos;
		this.sheet.add(this);
		this.sisters = [];
		this.type = "stitch";
		this.plainMat = yarnMats[this.yarn];
		this.selectedMat = yarnMats[this.yarn+"selected"];
		this.hoveredMat = yarnMats[this.yarn+"hovered"];
	}

	resetColor(verbose){
		if (this.selected) this.material = this.selectedMat;
		else this.material = this.plainMat;
	}
	moveToPos(newPos) {
		this.layerPosition = newPos;
		this.position.set(settings.stitchSpacing*settings.aspectRatio*this.relationConfig.column, settings.stitchSpacing*this.relationConfig.row, settings.stitchSpacing*settings.layerSpacing*this.layerPosition);
	}
	setRelations(relations) {
		this.relationConfig = relations;
		this.moveToPos(this.layerPosition);
	}
	addSister(sister) {
		this.sisters.push(sister);
	}

	transpose (dir) {
		var newPos = this.layerPosition + dir;
		if (newPos>=0 && newPos<settings.numberOfSheets) {
			var oldPos = this.layerPosition;
			this.moveToPos(newPos);
			this.sisters.forEach(function (sis) {
				if (sis.layerPosition == newPos) sis.moveToPos(oldPos);
			});
		}
	}
	hover() {
		this.material = this.hoveredMat;
	}
	select() {
		this.selected = true;
		this.material = this.selectedMat;
		this.sisters.forEach(function (sis) {
			sis.unselect();
		});
	}
	unselect () {
		this.selected = false;
		this.material = this.plainMat;
	}
	toggleSelection() {
		// this.selected = !this.selected;
		if (this.selected) {
			this.unselect()
		}
		else this.select();
		return this.selected;
	}
	get relations() {
		return this.relationConfig;
	}
	get row() {
		return this.relationConfig.row;
	}
	get column() {
		return this.relationConfig.column;
	}
 }

class Noodle extends THREE.Mesh {
	constructor(sheet, stitches, yarn) {
		var locs = [];
		for (var i=0; i<stitches.length;i++) {
			var pos = stitches[i].position;
			locs.push(pos.x, pos.y, pos.z);
		}
		var line = new MeshLine();
		line.setPoints(locs);
		var color = settings.carrierConfig[yarn];
		var mat = new MeshLineMaterial({ color : color, linewidth: settings.yarnWidth, sizeAttenuation:true});

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
	constructor(width, height, yarn, startPos, name) {
		super();
		this.height = height;
		this.width = width;
		this.name = name;
		this.yarn = yarn;
		this.color = settings.carrierConfig[this.yarn];
		this.startPos = startPos;
		this.stitches = [];
		this.noodles = [];

		for (var h=0; h<height; h++) {
			var rowGroup = [];
			for (var w=0; w<width; w++) {
				// mat.color.setRGB(0,h/height, w/width);
				var thisStitch = new Stitch(this, startPos, yarn);
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
			var thisNoodle = new Noodle(this, this.stitches[h], yarn);
			this.noodles.push(thisNoodle);
		}
	}
	setSisters(otherSheet) {
		// console.log(otherSheet.stitches.length, otherSheet.stitches[0].length);
		for (var h=0; h<this.stitches.length; h++) {
			for (var w=0; w<this.stitches[h].length; w++) {
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

	applyToAllStitches(action) {
		for (var h=0; h<this.stitches.length; h++) {
			for (var w=0; w<this.stitches[h].length; w++) {
				action(this.stitches[h][w]);
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