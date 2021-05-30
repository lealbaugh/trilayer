// var knitout = require('./knitout');
import { Writer } from './knitout';
var color1 = "3";
var color2 = "4";
var color3 = "5";

var carriers = [color1, color2, color3];
var alignment = 0;
var carriersInAction = {};
var hookInAction = false;
var k;


export const planner = function (chart) {
	k = new Writer({carriers:["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]});
	k.addHeader('Machine','SWGXYZ');
	k.addHeader('Gauge','15');
	k.addHeader('X-Presser-Mode','auto');
	k.addHeader('Position','Center');

	// do the main thing
	trilayerSwatch(chart);

	// yarns out, and drop
	for (var c = 0; c<carriers.length; c++) {
		yarnOut(carriers[c]);
	}
	dropAll({leftedge: -4, rightedge: ((chart[0].length)*chart[0][0].length)+4});

	// ship it
	return k.write('tricolor.k');
};


// ==============================================================================
// ============================= Main action ====================================
// ==============================================================================
function trilayerSwatch(stitchChart) {
	for (var h=0; h<stitchChart.length; h++) {
		console.log("row", h);
		var row = chunkify(stitchChart[h]);
		// console.log()
		var direction = (h%2==0) ? "-" : "+";

		if (h==0) { //caston -- build stack from the bottom to the top; might need to bring in some yarns; don't need to xfer
			for (var c=row.length-1; c>=0; c--) {
				var chunk = row[c];
				for (var layer=0; layer<chunk.stackOrder.length; layer++) {
					var carrier = carriers[chunk.stackOrder[layer]];

					//caston
					if (h==0) {
						if (!carriersInAction[carrier]) {
							yarnIn(carrier);
						}
						for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
							if (s%2 == chunk.rightedge%2) {
								knit("-", "f", s, carrier);
							}
						}
						for (var s=chunk.leftedge; s<=chunk.rightedge; s++) {
							if (s%2 != chunk.rightedge%2) {
								knit("+", "f", s, carrier);
							}
						} 
						if (hookInAction) releaseHook(carrier);
					}

					// and finish to the left
					for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
						knit("-", "f", s, carrier);
					}
					// if you have more layers to knit, kick left a bit to get out of the way
					if (layer<chunk.stackOrder.length-1) { 
						miss("-", "f", chunk.leftedge-1, carrier);
					}
				}
				// once all the layers are done, if you have more chunks, kick all carriers rightward to get ready for them
				if (c>0) {
					for (var carrierNumber=0; carrierNumber<carriers.length; carrierNumber++) {
						miss("+", "f", chunk.leftedge, carriers[carrierNumber]);
					}
				}
			}
		}
		else if (direction == "-") { // typical leftward row: build the stack from the bottom to the top
			for (var c=row.length-1; c>=0; c--) {
				var chunk = row[c];
				for (var layer=0; layer<chunk.stackOrder.length; layer++) {
					var carrier = carriers[chunk.stackOrder[layer]];

					// if it's not the bottommost layer, transfer it to the front to get ready
					if (layer>0) {
						for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
							xfer(carrier, "b", s, "f", s);
						}
					}

					for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
						knit("-", "f", s, carrier);
					}

					// if it's not the last layer in the chunk, kick a bit left to get out of the way
					if (layer<chunk.stackOrder.length-1) {
						miss("-", "f", chunk.leftedge-1, carrier);
					}

				}
				if (c>0) {
					for (var carrierNumber=0; carrierNumber<carriers.length; carrierNumber++) {
						miss("+", "f", chunk.leftedge, carriers[carrierNumber]);
					}
				}
			}
		}

		else if (direction == "+") { // typical rightward row: build the stack from the top to the bottom
			for (var c=0; c<row.length; c++) {
				var chunk = row[c];
				for (var layer=chunk.stackOrder.length-1; layer>=0; layer--) {
					var carrier = carriers[chunk.stackOrder[layer]];
					for (var s=chunk.leftedge; s<=chunk.rightedge; s++) {
						knit("+", "f", s, carrier);
					}

					// if it's not the bottommost layer, kick the carrier and transfer it to get it out of the way of the next one
					if (layer>0) {
						miss("+", "f", chunk.rightedge+1, carrier);
						for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
							xfer(carrier, "f", s, "b", s);
						}
					}
				}
				if (c<row.length-1) {
					for (var carrierNumber=0; carrierNumber<carriers.length; carrierNumber++) {
						miss("-", "f", chunk.rightedge, carriers[carrierNumber]);
					}
				}
			}
		}
	}
}



function chunkify(chartRow) {
	function arrEquals(arr1, arr2) {
		var i = arr1.length;
		while (i--) {
			if (arr1[i] !== arr2[i]) return false;
		}
		return true;
	}
	var chunks = [];
	var newChunk = {leftedge:0, rightedge:undefined, stackOrder:chartRow[0]};
	for (var i=1; i<chartRow.length; i++) {
		if (!arrEquals(chartRow[i], chartRow[i-1])) {
			newChunk.rightedge = i-1;
			chunks.push(Object.assign({}, newChunk));
			newChunk = {leftedge:i, rightedge:undefined, stackOrder:chartRow[i]};
		}	
	}
	newChunk.rightedge = chartRow.length-1;
	chunks.push(Object.assign({}, newChunk));
	return chunks;
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

// funky mapNeedle specifically for this trilayer context
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
	var mappedNeedle = mapNeedle(carrier, bed, needle);
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
	carriersInAction[carrier] = true;
	hookInAction = true;
}

function releaseHook (carrier) {
	k.releasehook(carrier);
	hookInAction = false;
}

function yarnOut (carrier) {
	k.outhook(carrier);
	carriersInAction[carrier] = false;
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

