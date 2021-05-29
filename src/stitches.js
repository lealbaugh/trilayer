import * as THREE from 'three';

// var spacing = 3;
// var stitchSize = 2;

class Stitch extends THREE.Mesh {
	static spacing = 3;
	static stitchSize = 2;

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
	}

	resetColor(){
		if (this.selected) this.material.color.set(this.highlightColor);
		else this.material.color.set(this.color);
	}
	setRelations(relations) {
		this.relationConfig = relations;
		this.position.set(spacing*this.relationConfig.column, spacing*this.relationConfig.row, spacing*this.layerPosition);
	}
	addSister(sister) {
		sisters.add[sister];
	}
	moveToPos(newPos) {
		this.layerPosition = newPos;
		this.position.set(spacing*this.relationConfig.column, spacing*this.relationConfig.row, spacing*this.layerPosition);
	}

	transpose (dir) {
		var oldPos = this.layerPosition;
		this.moveToPos(this.layerPosition + dir);
		this.sisters.forEach(function (sis) {
			if (sis.layerPos == this.layerPosition) sis.moveToPos(oldPos);
		});
	}
	select() {
		this.selected = true;
		this.material.color.set(this.highlightColor);
	}
	unselect () {
		this.selected = false;
	}
	toggleSelection() {
		this.selected = !this.selected;
		if (this.selected) {
			console.log(this.relationConfig.row, this.relationConfig.column);
			this.material.color.set(this.highlightColor);
		}
		else this.material.color.set(this.color);
		return this.selected;
	}
	get relations() {
		return this.relationConfig;
	}
	get layerPos() {
		return this.layerPosition;
	}
	get row() {
		return this.relationConfig.row;
	}
	get column() {
		return this.relationConfig.column;
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
		}
	}

	setSisters(otherSheet) {
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

	rectangleSelect (corner1, corner2) {
		var selection = [];
		var leftedge = Math.min(corner1.column, corner2.column);
		var rightedge = Math.max(corner1.column, corner2.column);
		var topedge = Math.max(corner1.row, corner2.row);
		var bottomedge = Math.min(corner1.row, corner2.row);

		for (var row = bottomedge; row<=topedge; row++) {
			for (var column = leftedge; column<=rightedge; column++) {
				if (this.stitches[row][column].layerPos == corner1.layerPos) selection.push(this.stitches[row][column]);
			}
		}
		return selection;
	}
	getCenter() {
		var centerStitch = this.stitches[Math.round(this.stitches.length/2)][Math.round(this.stitches[0].length/2)];
		return centerStitch;
	}
}

export { Stitch };
export { Sheet };





// import * as THREE from 'three';

// // import { Group } from 'three';
// // import { Object3D } from 'three';

// // class Stitch extends THREE.Object3D {
// // 	constructor(sheet, layerPos, mat) {
// // 		// relations: row, column, neighborBefore, neighborAfter, parent, child
// // 		super();
// // 		this.relations = {};
// // 		this.sheet = sheet;
// // 		this.layerPos = layerPos;

// // 		var geom = new THREE.BoxGeometry( 2, 2, 2 );	
// // 		this.cube = new THREE.Mesh( geom, mat );
// // 		this.sheet.add(this.cube);
// // 	}

// // 	setRelations(relations) {
// // 		this.relations = relations;
// // 		this.cube.position.set(3*this.relations.column, 3*this.relations.row, this.layerPos);
// // 	}
// // 	shuffle(newPos) {
// // 		this.layerPos = newPos;
// // 	}
// // }

// class Stitch extends THREE.Mesh {
// 	constructor(sheet, layerPos, color) {
// 		// relations: row, column, neighborBefore, neighborAfter, parent, child
// 		var geom = new THREE.BoxGeometry( 2, 2, 2 );
// 		var mat = new THREE.MeshBasicMaterial({color: color});
// 		super( geom, mat );
// 		this.selected = false;
// 		this.color = color;
// 		this.relationConfig = {};
// 		this.sheet = sheet;
// 		this.layerPosition = layerPos;
// 		this.sheet.add(this);
// 	}

// 	resetColor(){
// 		if (!this.selected) this.material.color.set(this.color);
// 	}
// 	setRelations(relations) {
// 		this.relationConfig = relations;
// 		this.position.set(3*this.relationConfig.column, 3*this.relationConfig.row, this.layerPosition);
// 	}
// 	shuffle(newPos) {
// 		this.layerPosition = newPos;
// 		this.position.set(3*this.relationConfig.column, 3*this.relationConfig.row, this.layerPosition);
// 	}
// 	select() {
// 		this.selected = true;
// 	}
// 	unselect () {
// 		this.selected = false;
// 	}
// 	get relations() {
// 		return this.relationConfig;
// 	}
// 	get layerPos() {
// 		return this.layerPos;
// 	}
// 	get row() {
// 		return this.relationConfig.row;
// 	}
// 	get column() {
// 		return this.relationConfig.column;
// 	}
//  }

// class Sheet extends THREE.Group {
// 	constructor(height, width, color, startPos) {
// 		super();
// 		this.height = height;
// 		this.width = width;
// 		this.color = color;
// 		this.startPos = startPos;

// 		// mat.color = color;

// 		var stitches = [];
// 		for (var h=0; h<height; h++) {
// 			var rowGroup = [];
// 			for (var w=0; w<width; w++) {
// 				// mat.color.setRGB(0,h/height, w/width);
// 				var thisStitch = new Stitch(this, startPos, color);
// 				rowGroup.push(thisStitch);
// 			}
// 			stitches.push(rowGroup);
// 		}
// 		for (var h=0; h<stitches.length; h++) {
// 			var neighborBefore, neighborAfter, parent, child = null;
// 			for (var w=0; w<stitches[h].length; w++) {
// 				if (h>0) parent=stitches[h-1][w];
// 				if (h<stitches.length-1) child = stitches[h+1][w];
// 				if (w>0) neighborBefore=stitches[h][w-1];
// 				if (w<stitches[h].length-1) neighborAfter = stitches[h][w+1];
// 				stitches[h][w].setRelations({row: h, column: w, neighborBefore:neighborBefore, neighborAfter:neighborAfter, parent:parent, child:child});
// 			}
// 		}
// 	}

// 	resetColor() {
// 		for (var child in this.children) {
// 			if (typeof child == "Stitch") stitch.resetColor();
// 			// else console.log(typeof child);
// 		}
// 	}

// 	boundedStitches (corner1, corner2) {
// 		var selection = [];
// 		var leftedge = Math.min(corner1.get.column, corner2.get.column);
// 		var rightedge = Math.max(corner1.get.column, corner2.get.column);
// 		var topedge = Math.max(corner1.get.row, corner2.get.row);
// 		var bottomedge = Math.min(corner1.get.row, corner2.get.row);

// 		for (var row = bottomedge; row<=topedge; row++) {
// 			for (var column = leftedge; column<=rightedge; column++) {
// 				if (stitches[row][column].get.layerPos == corner1.get.layerPos) selection.push(stitches[row][column]);
// 			}
// 		}
// 		return selection;
// 	}
// 	// // Getter
// 	// get area() {
// 	// 	return this.calcArea();
// 	// }
// 	// // Method
// 	// calcArea() {
// 	// 	return this.height * this.width;
// 	// }
// }

// export { Stitch };
// export { Sheet };
