// var knitout = require('./knitout');
import { Writer } from './knitout';

var alignment = 0;
var carriersInAction = {};
var hookInAction = false;
var k;

var allCarriers = [];
var sheetGaugeAllocation = {};
var numberOfSheets;
// data: {
//	 settings: {
//	 	numberOfSheets: 3,
//	 	sheetNames: ['a', 'b', 'c', 'd', 'e'],
//	 }
// 	chart: [ //list of rows; each rowChunks looks like:
// 		{
// 			stackOrders: [['a','b','c'], ['c','b','a']] // stackOrder per stitch in rowChunks
// 			colors: {
// 				'a': ["3", "3", "3", ...], //carrier per stitch in this sheet in this rowChunks
// 				'b': ["4", "4", "4", ...],
// 				'c': ["5", "5", "5", ...]
// 			}
// 		},
// 		{
// 			etc
// 		}
// 	]
// 	carriers: { // yarn colors to thread the carrier with
// 		"3": 'blue',
// 		"4": 'yellow',
// 		"5": 'magenta'
// 	}
// }

export const planner = function (data) {
	k = new Writer({carriers:["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]});
	k.addHeader('Machine','SWGXYZ');
	k.addHeader('Gauge','15');
	k.addHeader('X-Presser-Mode','auto');
	k.addHeader('Position','Center');

	allCarriers = Object.keys(data.settings.carrierConfig);
	sheetGaugeAllocation = makeSheetGaugeAllocation(data.settings.sheetNames);
	numberOfSheets = data.settings.numberOfSheets;
	// do the main thing
	trilayerSwatch(data.chart);

	// yarns out, and drop
	for (var c = 0; c<allCarriers.length; c++) {
		yarnOut(allCarriers[c]);
	}
	dropAll(data.chart);

	// ship it
	return k.write('tricolor.k');
};


// ==============================================================================
// ============================= Main action ====================================
// ==============================================================================
function trilayerSwatch(chart) {
	for (var h=0; h<chart.length; h++) {
		var row = chart[h]
		var rowChunks = chunkify(row.stackOrders);
		var direction = (h%2==0) ? "-" : "+";

		if (h==0) { //caston -- build stack from the bottom to the top; might need to bring in some yarns; don't need to xfer
			k.stitchNumber(92);
			for (var c=rowChunks.length-1; c>=0; c--) {
				var chunk = rowChunks[c];
				for (var layer=0; layer<chunk.stackOrder.length; layer++) {
					var sheet = chunk.stackOrder[layer]; // sheet is needed to map needles and to lookup colors
					var colors = row.colors[sheet];
					
					// All stitches in the caston row will be the color of that sheet's bottom left edge;
					// trying to do colorwork in the caston is just way more trouble than it's worth
					var carrier = colors[rowChunks[rowChunks.length-1].rightedge]; 

					//caston
					if (h==0) {
						if (!carriersInAction[carrier]) {
							yarnIn(carrier);
						}
						for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
							if (s%2 == chunk.rightedge%2) {
								knit(sheet, "-", "f", s, carrier);
							}
						}
						for (var s=chunk.leftedge; s<=chunk.rightedge; s++) {
							if (s%2 != chunk.rightedge%2) {
								knit(sheet, "+", "f", s, carrier);
							}
						} 
						if (hookInAction) releaseHook(carrier);
					}

					// and finish to the left
					for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
						knit(sheet, "-", "f", s, carrier);
					}
					// if you have more layers to knit, kick left a bit to get out of the way
					if (layer<chunk.stackOrder.length-1) { 
						miss(sheet, "-", "f", chunk.leftedge-1, carrier);
					}
				}
				// once all the layers are done, if you have more chunks, kick all carriers rightward to get ready for them
				if (c>0) {
					for (var carrierNumber=0; carrierNumber<allCarriers.length; carrierNumber++) {
						miss(sheet, "+", "f", chunk.leftedge, allCarriers[carrierNumber]);
					}
				}
			}
			k.stitchNumber(95);
		}
		else if (direction == "-") { // typical leftward row: build the stack from the bottom to the top
			for (var c=rowChunks.length-1; c>=0; c--) {
				var chunk = rowChunks[c];
				for (var layer=0; layer<chunk.stackOrder.length; layer++) { // go through each layer in the stack
					var sheet = chunk.stackOrder[layer]; // sheet is needed to map needles and to lookup colors
					var colors = row.colors[sheet];

					// if it's not the bottommost layer, transfer it to the front to get ready
					// if (layer>0) {
						for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
							xfer(sheet, "b", s, sheet, "f", s);
						}
					// }

					var carrier = colors[chunk.rightedge];
					for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
						carrier = colors[s];
						knit(sheet, "-", "f", s, carrier);
					}

					// if it's not the last layer in the chunk, kick a bit left to get out of the way
					if (layer<chunk.stackOrder.length-1) {
						miss(sheet, "-", "f", chunk.leftedge-1, carrier);
					}

				}
				if (c>0) {
					for (var carrierNumber=0; carrierNumber<allCarriers.length; carrierNumber++) {
						miss(sheet, "+", "f", chunk.leftedge, allCarriers[carrierNumber]);
					}
				}
			}
		}

		else if (direction == "+") { // typical rightward row: build the stack from the top to the bottom
			for (var c=0; c<rowChunks.length; c++) {
				var chunk = rowChunks[c];
				for (var layer=chunk.stackOrder.length-1; layer>=0; layer--) {
					var sheet = chunk.stackOrder[layer]; // sheet is needed to map needles and to lookup colors
					var colors = row.colors[sheet];

					var carrier = colors[chunk.leftedge];
					for (var s=chunk.leftedge; s<=chunk.rightedge; s++) {
						carrier = colors[s];
						knit(sheet, "+", "f", s, carrier);
					}

					// if it's not the bottommost layer, kick the carrier and transfer it to get it out of the way of the next one
					// if (layer>0) {
						miss(sheet, "+", "f", chunk.rightedge+1, carrier);
						for (var s=chunk.rightedge; s>=chunk.leftedge; s--) {
							xfer(sheet, "f", s, sheet, "b", s);
						}
					// }
				}
				if (c<rowChunks.length-1) {
					for (var carrierNumber=0; carrierNumber<allCarriers.length; carrierNumber++) {
						miss(sheet, "-", "f", chunk.rightedge, allCarriers[carrierNumber]);
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

function makeSheetGaugeAllocation(names) {
	var allocation = {};
	for (var i=0; i<names.length; i++) {
		allocation[names[i]] = i;
	}
	return allocation;
}

function dropAll (chart) {
	var row = chart[0].stackOrders;
	var stacks = row[0];
	for (var s=row.length; s>=0; s--) {
		stacks.forEach(function (sheet) {
			drop(sheet, "f", s);
		});
	}
	for (var s=0; s<=row.length; s++) {
		stacks.forEach(function (sheet) {
			drop(sheet, "b", s);
		});
	}
}

// // ================================================================= 
// // ======================= ~ Low-level ~ =========================== 
// // ================================================================= 

// funky mapNeedle specifically for this trilayer context
function mapNeedle (sheet, bed, needle) {
	var mappedNeedle = numberOfSheets*needle + sheetGaugeAllocation[sheet];
	return {bed: bed, needle: mappedNeedle};
}

function knit (sheet, direction, bed, needle, carrier) {
	var mappedNeedle = mapNeedle(sheet, bed, needle);
	k.knit(direction, mappedNeedle.bed + mappedNeedle.needle, carrier);
}


function miss (sheet, direction, bed, needle, carrier) {
	var mappedNeedle = mapNeedle(sheet, bed, needle);
	k.miss(direction, mappedNeedle.bed + mappedNeedle.needle, carrier);
}

function tuck (sheet, direction, bed, needle, carrier) {
	var mappedNeedle = mapNeedle(sheet, bed, needle);
	k.tuck(direction, mappedNeedle.bed + mappedNeedle.needle, carrier);
}

function drop (sheet, bed, needle) {
	var mappedNeedle = mapNeedle(sheet, bed, needle);
	k.drop(mappedNeedle.bed + mappedNeedle.needle);
}

function amiss (sheet, bed, needle) {
	var mappedNeedle = mapNeedle(sheet, bed, needle);
	k.amiss(mappedNeedle.bed + mappedNeedle.needle);
}

function split (sheet, direction, fromBed, fromNeedle, toBed, toNeedle, carrier) {
	if (fromBed == toBed || (fromBed == "f" && toBed == "fs")|| (fromBed == "fs" && toBed == "f")|| (fromBed == "b" && toBed == "bs")|| (fromBed == "bs" && toBed == "b")) {
		console.log("cannot split to same bed! (you'll need to split there, then xfer back) attempted: ", fromBed, fromNeedle, toBed, toNeedle);
	}
	else {
		var mappedFrom = mapNeedle(sheet, fromBed, fromNeedle);
		var mappedTo = mapNeedle(sheet, toBed, toNeedle);
		var offset = mappedTo.needle - mappedFrom.needle;
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

function xfer (fromLayer, fromBed, fromNeedle, toLayer, toBed, toNeedle) {
	if (fromBed == toBed || (fromBed == "f" && toBed == "fs")|| (fromBed == "fs" && toBed == "f")|| (fromBed == "b" && toBed == "bs")|| (fromBed == "bs" && toBed == "b")) {
		console.log("cannot xfer to same bed! attempted: ", fromBed, fromNeedle, toBed, toNeedle);
	}
	else {
		var mappedFrom = mapNeedle(fromLayer, fromBed, fromNeedle);
		var mappedTo = mapNeedle(toLayer, toBed, toNeedle);
		var offset = mappedTo.needle - mappedFrom.needle;
		if (fromBed == "f" || fromBed == "fs") offset = 0 - offset;
		if (offset!=alignment) k.rack(offset);
		k.xfer(mappedFrom.bed+mappedFrom.needle, mappedTo.bed+mappedTo.needle);
		if (offset!=alignment) k.rack(alignment);
	}
}

