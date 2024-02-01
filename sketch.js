let aNaturalMinorScale = ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F6', 'G6', 'A6'];
let aDorianScale = ['A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F#6', 'G6', 'A6'];
let aAeolianScale = ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F6', 'G6', 'A6'];
let aPhrygianScale = ['A4', 'Bb4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'C6', 'D6', 'E6', 'F6', 'G6', 'A6'];
let aMelodicMinorScale = ['A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G#5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F#6', 'G#6', 'A6'];
let aPentatonicMinorScale = ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'];

let brighter = [
	[23, 230, 226],
	[68, 207, 238],
	[201, 235, 30],
	[255, 39, 10],
	[22, 216, 223],
]

function videoLoaded() {
	//state.canvas = createCanvas(state.media.width, state.media.height);
	state.canvas = createCanvas(640, 480);
}

let state;
function preload() {
	state = {
		// config items:
		mode: "webcam", // swap between "development" and "webcam"
		// mode: "development", // swap between "development" and "webcam"
		step: 8, // how many times per minute we should check for notes.
		scale: aNaturalMinorScale,
		threshold: 25, // lower means more notes
		maxThreshold: 200,
		noteLengths: ["16n"],
		colors: brighter,
		maxSynths: 8,
		// dont change anything below this point.
		canvas: undefined,
		scaleSelect: undefined, // only defined in development mode.
		thresholdSlider: undefined, // only defined when in development mode.
		media: undefined,
		player: undefined,
		points: [],
		synthIndex: 0,
		audioRunning: false,
		imgX: 0,
		imgY: 0,
		imgScale: 1.0,
	}

	state.player = new Tone.Player("/abl.mp3").toDestination();
	state.player.loop = true;
	state.player.autostart = true;
	state.player.volume = -20;



	if (state.mode == "webcam") {
		state.media = createCapture(VIDEO, videoLoaded);
		state.media.hide();
		//state.canvas = createCanvas(state.media.width, state.media.height);
	}
	else if (state.mode == "development") {
		// dev mode adds a slider for threshold and uses a video file, rather than the webcam.
		state.thresholdSlider = createSlider(0, 255, state.threshold, 0);
		state.scaleSelect = createSelect();

		state.scaleSelect.option('aNaturalMinorScale');
		state.scaleSelect.option('aPentatonicMinorScale');
		state.scaleSelect.option('aDorianScale');
		state.scaleSelect.option('aAeolianScale');
		state.scaleSelect.option('aPhrygianScale');
		state.scaleSelect.option('aMelodicMinorScale');

		state.media = createVideo('output.mp4', videoLoaded);
		state.media.hide();
	}
	else {
		console.log("mode not supported.")
	}

	Tone.context.blockSize = 1024;
}


function setup() {
}

function displayMedia(img) {
	translate(width / 2, height / 2);
	scale(state.imgScale);
	translate(-img.width / 2 - state.imgX, -img.height / 2 - state.imgY);
	image(img, 0, 0);
}

function mouseDragged() {
	// Dragging logic, to allow picking/placing media stream
	if (mouseIsPressed) {
		state.imgX += pmouseX - mouseX;
		state.imgY += pmouseY - mouseY;
	}
}

function mouseWheel(event) {
	// Zoom logic with scroll wheel
	let delta = event.delta;
	state.imgScale += delta * 0.001; // Adjust the zoom speed as needed

	// Constrain the zoom level if necessary
	state.imgScale = constrain(state.imgScale, 0.5, 5);

	// Prevent the default behavior of scrolling (e.g., page scrolling)
	return false;
}

function draw() {
	background(255);
	displayMedia(state.media);
	//filter(BLUR);
	filter(POSTERIZE, 16);
	drawAndCheckPoints();
}

let initialized = false;
function mouseClicked() {
	if (!initialized) {
		initializePoints();
		if (state.mode == "development") {
			state.media.loop();
			state.media.volume(0);
		}
		state.audioRunning = true;
		Tone.start();
		initialized = true;
	}
}

function generateCircleCoordinates(N, radius) {
	let coordinates = [];
	for (let i = 0; i < N; i++) {
		const angle = (i / N) * TWO_PI; // Calculate the angle based on the number of points
		const x = floor(radius * cos(angle));  // Calculate x-coordinate
		const y = floor(radius * sin(angle));  // Calculate y-coordinate
		coordinates.push({ x, y });
	}
	return coordinates;
}

function initializePoints() {
	let circCoords = generateCircleCoordinates(state.maxSynths, 60)
	circCoords.forEach((coord) => {

		// plain synth
		//const synth = new Tone.PolySynth().toDestination();

		// phaser synth
		//const phaser = new Tone.Phaser({
		// frequency: 3,
		// octaves: 3,
		// baseFrequency: 1000
		//}).toDestination();
		//const synth = new Tone.PolySynth().connect(phaser);

		// chorus synth
		const chorus = new Tone.Chorus(4, 2.5, 0.5).toDestination();
		const reverb = new Tone.Reverb(.25).connect(chorus);
		const synth = new Tone.PolySynth().connect(reverb);
		state.points.push(
			{
				x: coord.x + width / 2,
				y: coord.y + height / 2,
				colors: [],
				pastColors: [],
				pointColor: [30, 255, 188],
				synth: synth,
				ts: 0,
			});
	});
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
	state.points.forEach((point) => {
		point.pastColors = point.colors;
		point.colors = get(point.x, point.y);

		checkDistanceAndTriggerNote(point, now);
		drawPoint(point);
	});
	// drawing the point must happen after sampling the video color (otherwise we just get the color of the point.)
	//	state.points.forEach((point) => {
	//		drawPoint(point);
	//	});
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
	if (state.points[state.synthIndex].ts < time) {
		state.points[state.synthIndex].ts = time
		state.points[state.synthIndex].synth.triggerAttackRelease(
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
