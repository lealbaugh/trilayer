// ==============================================================================
// ============================ Boilerplate =====================================
// ==============================================================================

var knitout = require('../../knitout-frontend-js/knitout');
k = new knitout.Writer({carriers:["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]});
k.addHeader('Machine','SWGXYZ');
k.addHeader('Gauge','15');
k.addHeader('X-Presser-Mode','auto');
k.addHeader('Position','Center');

// ==============================================================================
// ============================= Main action ====================================
// ==============================================================================
var color1 = "3";
var color2 = "4";
var color3 = "5";

var carriers = [color1, color2, color3];
// var stripeWidth = 6;
// var numberOfStripeSets = 1;
// var	height = 6;
// var numberOfStripes = numberOfStripeSets*carriers.length;

var alignment = 0;

// for (var i=0; i<numberOfStripes; i++) {
for (var i=numberOfStripes-1; i>=0; i--) {
	// var confines = {rightedge: (numberOfStripes-i)*stripeWidth, leftedge: (numberOfStripes-(i+1))*stripeWidth +1};
	var confines = {leftedge: i*stripeWidth, rightedge: (i+1)*stripeWidth - 1};
	var orderedCarriers = rotate(carriers, i);
	// console.log(confines);
	for (var c=0; c<orderedCarriers.length; c++) {
		var carrier = orderedCarriers[c];
		if (i==numberOfStripes-1) yarnIn(carrier);
		caston(confines, carrier);
		if (i==numberOfStripes-1) releaseHook(carrier);
		for (var s=confines.rightedge; s>=confines.leftedge; s--) {
			knit("-", "f", s, carrier);
		}
		miss("-", "f", confines.leftedge-1, carrier);
	}
	if (i>0){
		for (var c=0; c<orderedCarriers.length; c++) {
			miss("+", "f", confines.leftedge, orderedCarriers[c]);
		}
	}
}

for (var h=0; h<height; h++) {
	// for (var i=numberOfStripes-1; i>=0; i--) {
	for (var i=0; i<numberOfStripes; i++) {
	// go rightward, one stripe at a time
		var confines = {leftedge: i*stripeWidth, rightedge: (i+1)*stripeWidth - 1};
		var orderedCarriers = rotate(carriers, i);
		for (var c=orderedCarriers.length-1; c>=0; c--) {
			// knit each layer, and, if it's not the "bottom" one, transfer it out of the way
			var carrier = orderedCarriers[c];
			for (var s=confines.leftedge; s<=confines.rightedge; s++) {
				knit("+", "f", s, carrier);
			}
			miss("+", "f", confines.rightedge+1, carrier);
			if (c>0) {
				for (var s=confines.leftedge; s<=confines.rightedge; s++) {
					xfer(carrier, "f", s, "b", s);
				}
			}
		}
		if (i<numberOfStripes-1){
			for (var c=0; c<orderedCarriers.length; c++) {
				miss("-", "f", confines.rightedge, orderedCarriers[c]);
			}
		}
	}
	
	// go leftward, same deal
	if (h<height-1) { // (don't go leftward the last time, let's keep the carriers gripper-side for removal)
		for (var i=numberOfStripes-1; i>=0; i--) {
			var confines = {leftedge: i*stripeWidth, rightedge: (i+1)*stripeWidth - 1};
			var orderedCarriers = rotate(carriers, i);
			for (var c=0; c<orderedCarriers.length; c++) {
				var carrier = orderedCarriers[c];
				if (c>0) {
					for (var s=confines.leftedge; s<=confines.rightedge; s++) {
						xfer(carrier, "b", s, "f", s);
					}
				}
				for (var s=confines.rightedge; s>=confines.leftedge; s--) {
					knit("-", "f", s, carrier);
				}
				miss("-", "f", confines.leftedge-1, carrier);
			}
			if (i>0){
				for (var c=0; c<orderedCarriers.length; c++) {
					miss("+", "f", confines.leftedge, orderedCarriers[c]);
				}
			}
		}	
	}
}

// yarns out, and drop
for (var c = 0; c<carriers.length; c++) {
	yarnOut(carriers[c]);
}
dropAll({leftedge: -4, rightedge: numberOfStripes*stripeWidth*3});


// ship it
k.write('tricolor.k');

// // ================================================================= 
// // ========================= ~ Helpers ~ =========================== 
// // ================================================================= 

// https://stackoverflow.com/questions/1985260/rotate-the-elements-in-an-array-in-javascript
function rotate(input, n) {
	output = input.slice(0);
	n -= output.length * Math.floor(n / output.length);
	output.push.apply(output, output.splice(0, n));
	return output;
}


function caston (confines, carrier) {
	for (var s=confines.rightedge; s>=confines.leftedge; s--) {
		if (s%2 == confines.rightedge%2) {
			knit("-", "f", s, carrier);
		}
	} 
	for (var s=confines.leftedge; s<=confines.rightedge; s++) {
		if (s%2 != confines.rightedge%2) {
			knit("+", "f", s, carrier);
		}
	} 
}

function makeTag (s, carrier) {
	knit("+", "f", s, carrier);
	knit("-", "f", s, carrier);
	knit("+", "f", s, carrier);
	knit("-", "f", s+1, carrier);
	knit("-", "f", s, carrier);
	knit("+", "f", s, carrier);
	knit("+", "f", s+1, carrier);
	for (var i=0; i<3; i++) {
		knit("-", "f", s+2, carrier);
		knit("-", "f", s+1, carrier);
		knit("-", "f", s, carrier);
		knit("+", "f", s, carrier);
		knit("+", "f", s+1, carrier);
		knit("+", "f", s+2, carrier);
	}
	return {leftedge: s, rightedge: s+2};
}

function dropAll (confines) {
	for (var s=confines.rightedge; s>=confines.leftedge; s--) {
		k.drop("f"+s);
	}
	for (var s=confines.leftedge; s<=confines.rightedge; s++) {
		k.drop("b"+s);
	}
}

// // ================================================================= 
// // ======================= ~ Low-level ~ =========================== 
// // ================================================================= 


function mapNeedle (yarn, bed, needle) {
	var mappedNeedle = 3*needle;
	if (yarn == color2) {
		mappedNeedle += 1;
	}
	else if (yarn == color3) {
		mappedNeedle += 2;
	}
	return {bed: bed, needle: mappedNeedle};
}

function knit (direction, bed, needle, carrier) {
	// console.log("knitting with", carrier);
	var mappedNeedle = mapNeedle(carrier, bed, needle);
	// console.log(mappedNeedle.needle);
	k.knit(direction, mappedNeedle.bed + mappedNeedle.needle, carrier);
}


function miss (direction, bed, needle, carrier) {
	var mappedNeedle = mapNeedle(carrier, bed, needle);
	k.miss(direction, mappedNeedle.bed + mappedNeedle.needle, carrier);
}

function tuck (direction, bed, needle, carrier) {
	var mappedNeedle = mapNeedle(carrier, bed, needle);
	k.tuck(direction, mappedNeedle.bed + mappedNeedle.needle, carrier);
}

function drop (carrier, bed, needle) {
	var mappedNeedle = mapNeedle(bed, needle);
	k.drop(mappedNeedle.bed + mappedNeedle.needle);
}

function amiss (carrier, bed, needle) {
	var mappedNeedle = mapNeedle(carrier, bed, needle);
	k.amiss(mappedNeedle.bed + mappedNeedle.needle);
}

function split (direction, fromBed, fromNeedle, toBed, toNeedle, carrier) {
	// console.log("knitting with", carrier);

	// duplicates the rack logic from xfer

	if (fromBed == toBed || (fromBed == "f" && toBed == "fs")|| (fromBed == "fs" && toBed == "f")|| (fromBed == "b" && toBed == "bs")|| (fromBed == "bs" && toBed == "b")) {
		console.log("cannot split to same bed! (you'll need to split there, then xfer back) attempted: ", fromBed, fromNeedle, toBed, toNeedle);
	}
	else {
		mappedFrom = mapNeedle(carrier, fromBed, fromNeedle);
		mappedTo = mapNeedle(carrier, toBed, toNeedle);
		offset = mappedTo.needle - mappedFrom.needle;
		if (fromBed == "f" || fromBed == "fs") offset = 0 - offset;
		k.rack(offset);
		k.split(direction, mappedFrom.bed+mappedFrom.needle, mappedTo.bed+mappedTo.needle, carrier);
		if (typeof returnAlignment !== 'undefined') align(returnAlignment);
	}
}

function yarnIn (carrier) {
	k.inhook(carrier);
	// if (!carriers[carrier]) carriers[carrier] = {};
	// carriers[carrier].in = true;
	// carriers["hook"] = true;
	// console.log("yarn in: ", carrier, carriers);
}

function releaseHook (carrier) {
	k.releasehook(carrier);
	// carriers["hook"] = false;
	// console.log("releaseHook");
	// if (carriers["hook"]) {
	// }
}

function yarnOut (carrier) {
	// console.log("yarn out: ", carrier, carriers);
	k.outhook(carrier);
	// carriers[carrier].in = false;
}

function xfer (carrier, fromBed, fromNeedle, toBed, toNeedle) {
	if (fromBed == toBed || (fromBed == "f" && toBed == "fs")|| (fromBed == "fs" && toBed == "f")|| (fromBed == "b" && toBed == "bs")|| (fromBed == "bs" && toBed == "b")) {
		console.log("cannot xfer to same bed! attempted: ", fromBed, fromNeedle, toBed, toNeedle);
	}
	else {
		mappedFrom = mapNeedle(carrier, fromBed, fromNeedle);
		mappedTo = mapNeedle(carrier, toBed, toNeedle);
		offset = mappedTo.needle - mappedFrom.needle;
		if (fromBed == "f" || fromBed == "fs") offset = 0 - offset;
		if (offset!=alignment) k.rack(offset);
		k.xfer(mappedFrom.bed+mappedFrom.needle, mappedTo.bed+mappedTo.needle);
		if (offset!=alignment) k.rack(alignment);
	}
}

