let aNaturalMinorScale = ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
let aDorianScale = ['A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4'];
let aAeolianScale = ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
let aPhrygianScale = ['A2', 'Bb2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
let aMelodicMinorScale = ['A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G#3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A4'];


let brighter = [
	[23, 230, 226],
	[68, 207, 238],
	[201, 235, 30],
	[255, 39, 10],
	[22, 216, 223],
]


let state;
function setup() {
	state = {
		// config items:
		mode: "development", // swap between "development" and "webcam"
		step: 16, // how many times per minute we should check for notes.
		scale: aNaturalMinorScale,
		threshold: 185, // lower means more notes per second. 3.28 is a good semi-continuous song, with occasional moments of silence.
		maxThreshold: 200,
		noteLengths: ["4n", "2n"],
		colors: brighter,
		maxSynths: 3,
		// dont change anything below this point.
		scaleSelect: undefined, // only defined in development mode.
		thresholdSlider: undefined, // only defined when in development mode.
		media: undefined,
		points: [],
		pointSynths: [],
		synthIndex: 0,
		audioRunning: false,
	}

	createCanvas(640, 480);

	if (state.mode == "webcam") {
		state.media = createCapture(VIDEO);
		state.media.size(640, 480);
		state.media.hide();
	}
	else if (state.mode == "development") {
		// dev mode adds a slider for threshold and uses a video file, rather than the webcam.
		state.thresholdSlider = createSlider(0, state.maxThreshold, state.threshold, 0);
		state.scaleSelect = createSelect();

		state.scaleSelect.option('aNaturalMinorScale');
		state.scaleSelect.option('aDorianScale');
		state.scaleSelect.option('aAeolianScale');
		state.scaleSelect.option('aPhrygianScale');
		state.scaleSelect.option('aMelodicMinorScale');

		state.media = createVideo('output.mp4');
		state.media.hide();
	}
	else {
		console.log("mode not supported.")
	}

	// set imagemode for easy scaling and cropping.
	imageMode(CENTER);
	Tone.context.blockSize = 1024;
}

function draw() {
	background(255);
	image(state.media, width / 1.5, height / 1.5, width * 1.5, height * 1.5);
	drawAndCheckPoints();
}

function mouseClicked() {
	initializePoints();
	if (state.mode == "development") {
		state.media.loop();
		state.media.volume(0);
	}
	state.audioRunning = true;
	Tone.start();
}

function initializePoints() {
	// initializing synthesizers
	for (let i = 0; i < state.maxSynths; i++) {
		let synth;
		if (i > 0 && i < 3) {
			synth = new Tone.PolySynth(Tone.AMSynth).toDestination();
		}
		else if (i >= 3 && i < 6) {
			synth = new Tone.PolySynth(Tone.AMSynth).toDestination();
		}
		else {
			const chorus = new Tone.Chorus(4, 2.5, 0.5).toDestination().start();
			synth = new Tone.PolySynth().toDestination();
		}
		state.pointSynths.push({ 'synth': synth, 'ts': 0 });
	}
	// creating point data
	let cols = 3;
	let rows = 3;
	let spacingX = width / (cols + 1);
	let spacingY = height / (rows + 1);

	for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
			let x = (i + 1) * spacingX;
			let y = (j + 1) * spacingY;

			//points
			state.points.push(
				{
					x: x,
					y: y,
					colors: [],
					pastColors: [],
					pointColor: [30, 255, 188],
				});
		}
	}
}

function euclideanDistance(colors, pastColors) {
	let r1 = colors[0]
	let g1 = colors[1]
	let b1 = colors[2]
	let a1 = colors[3]

	let r2 = pastColors[0]
	let g2 = pastColors[1]
	let b2 = pastColors[2]
	let a2 = pastColors[3]

	return Math.sqrt(
		Math.pow(r2 - r1, 2) +
		Math.pow(g2 - g1, 2) +
		Math.pow(b2 - b1, 2) +
		Math.pow(a2 - a1, 2)
	);
}

function drawAndCheckPoints() {
	let now = Tone.now();
	if (timeToRun(now)) {
		state.points.forEach((point) => {
			point.pastColors = point.colors;
			point.colors = get(point.x, point.y);

			checkDistanceAndTriggerNote(point, now);
		});
	}
	// drawing the point must happen after sampling the video color (otherwise we just get the color of the point.)
	state.points.forEach((point) => {
		drawPoint(point);
	});
}

function checkDistanceAndTriggerNote(point, now) {
	if (state.mode == "development") {
		state.threshold = state.thresholdSlider.value();
		state.scale = eval(state.scaleSelect.selected());
	}
	let dist = euclideanDistance(point.colors, point.pastColors);
	if (dist > state.threshold && state.audioRunning) {
		// TODO: could select note/notelength using an equation with an uneven distribution? to emphasize root notes, etc.
		const randomScaleIndex = Math.floor(Math.random() * scale.length);
		const noteLengthIndex = Math.floor(Math.random() * state.noteLengths.length);

		triggerNote(now, state.scale[randomScaleIndex], state.noteLengths[noteLengthIndex]);
		setNewColor(point);
	}
}

function setNewColor(point) {
	point.pointColor = state.colors[Math.floor(Math.random() * state.colors.length)];
}

// TODO: could change the color values over time.
function drawPoint(point) {
	let fillColor = color([...point.pointColor, 100]);
	let strokeColor = color([...point.pointColor, 255]);
	fill(fillColor);
	stroke(strokeColor);
	strokeWeight(2);
	ellipse(point.x, point.y, 30, 30);
}

function triggerNote(time, note, noteLength) {
	if (state.pointSynths[state.synthIndex].ts != time) {
		state.pointSynths[state.synthIndex].ts = time
		state.pointSynths[state.synthIndex].synth.triggerAttackRelease(
			note,
			noteLength,
			time);
		state.synthIndex++;
		if (state.synthIndex >= state.maxSynths) {
			state.synthIndex = 0;
		}
	}
}

// turns true $state.step times per second.
let lastChecked = 0; // a variable used in combination with above `step`
function timeToRun(time) {
	const checkInterval = 1 / state.step;
	if ((time - lastChecked) >= checkInterval) {
		lastChecked = time;
		return true;
	}
	else { return false; }
}
