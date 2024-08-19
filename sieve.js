/*
To do list:
*/

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d", {
  willReadFrequently: true,
});
var canvasWidth = 1000;
var canvasHeight = 1000;

var maxCanvasWidth = 2000;
var maxCanvasHeight = 2000;

var animationSpeed;
var animationRequest;
var playAnimationToggle = false;

var backgroundColor;

//detect user browser
var ua = navigator.userAgent;
var isSafari = false;
var isFirefox = false;
var isIOS = false;
var isAndroid = false;
if(ua.includes("Safari")){
    isSafari = true;
}
if(ua.includes("Firefox")){
    isFirefox = true;
}
if(ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")){
    isIOS = true;
}
if(ua.includes("Android")){
    isAndroid = true;
}
console.log("isSafari: "+isSafari+", isFirefox: "+isFirefox+", isIOS: "+isIOS+", isAndroid: "+isAndroid);

var mediaRecorder;
var recordedChunks;
var finishedBlob;
var recordingMessageDiv = document.getElementById("videoRecordingMessageDiv");
var recordVideoState = false;
var videoRecordInterval;
var videoEncoder;
var muxer;
var mobileRecorder;
var videofps = 30;

//add gui
var obj = {
  brushSize: Math.min(150, window.innerWidth*0.18),
  brushDensity: 5,
  opacity: 100,
  animationSpeed: 10,
  marker: true,
  markerColor: "#ffffff",
  solidColor: "#000000",
  canvasWidth: 1000,
  canvasHeight: 1000,
};
var backgroundType = obj.startingCanvas;

var gui = new dat.gui.GUI( { autoPlace: false } );
gui.close();
var guiOpenToggle = false;

// Choose from accepted values
gui.addColor(obj, "solidColor").name("Solid Color").onFinishChange(initiateBackground);

obj['selectImage'] = function () {
  imageInput.click();
};
gui.add(obj, 'selectImage').name('Select Image');

gui.add(obj, "brushSize").min(10).max(500).step(1).name('Brush Size').listen().onChange(getUserInputs);
gui.add(obj, "brushDensity").min(1).max(100).step(1).name('Brush Density').listen().onChange(getUserInputs);
gui.add(obj, "opacity").min(5).max(100).step(1).name('Brush Opacity').listen().onChange(getUserInputs);
gui.add(obj, "animationSpeed").min(1).max(50).step(1).name('Animation Speed').onChange(getUserInputs);
gui.add(obj, "marker").name("Marker Dot (m)").listen().onChange(toggleMarkerDraw);
gui.addColor(obj, "markerColor").name("Marker Color").onFinishChange(getUserInputs);

obj['refreshCanvas'] = function () {
  resetCanvas();
};
gui.add(obj, 'refreshCanvas').name("Refresh Canvas (r)");

obj['saveImage'] = function () {
saveImage();
};
gui.add(obj, 'saveImage').name("Image Export (i)");

obj['saveVideo'] = function () {
  toggleVideoRecord();
};
gui.add(obj, 'saveVideo').name("Start/Stop Video Export (v)");

obj['animate'] = function () {
  pausePlayAnimation();
};
gui.add(obj, 'animate').name("Play Randomized Animation (p)");

obj['lock'] = function () {
  lockUnlockCanvas();
};
gui.add(obj, 'lock').name("Lock/Unlock Canvas (l)");

gui.add(obj, "canvasWidth").max(maxCanvasWidth).name("Canvas Width").onChange(getUserInputs);
gui.add(obj, "canvasHeight").max(maxCanvasHeight).name("Canvas Height").onChange(getUserInputs);

customContainer = document.getElementById( 'gui' );
customContainer.appendChild(gui.domElement);

function getUserInputs(){
  
  canvasWidth = obj.canvasWidth;
  canvasHeight = obj.canvasHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  console.log("width/height: "+canvasWidth+", "+canvasHeight);
  
  BRUSH_SIZE = obj.brushSize;
  SMUDGE_SIZE = obj.brushDensity/100 * BRUSH_SIZE;
  LIQUIFY_CONTRAST = obj.opacity/100;
  markerColor = obj.markerColor;
  backgroundColor = obj.solidColor;
  animationSpeed = 500 / obj.animationSpeed;
}

function refresh(){
  getUserInputs();
  startAnimation();
}

var numRows;
var cellHeight;
var masterColor;
var colorArray = [];
var hueArray = [];
var powerArray = [];


function initiateBackground(){

  numRows = Math.max(1,Math.ceil(Math.random()*10));
  cellHeight = Math.ceil(canvasHeight / numRows);

  var saturation = randomWithinRange(0.5,0.3);
  var lightness = randomWithinRange(0.55,0.2);
  var saturationRange = 0.2;
  var masterHue = Math.random()*360;
  masterColor = "hsl("+masterHue+","+saturation*100+"%,"+lightness*100+"%)";
  
  var hueRange = Math.random()*15;
  var hueStep = Math.random()*15;

  colorArray = [];
  hueArray = [];
  powerArray = [];

  for(var row=0; row<numRows; row++){

    var numCols = Math.max(1,Math.ceil(Math.random()*10));
    var cellWidth = Math.ceil(canvasWidth / numCols);
    colorArray[row] = [];
    hueArray[row] = [];
    powerArray[row] = [];

    for(var col=0; col<numCols; col++){

      var hue1;
      var color1;
      
      var hue2;
      var color2;

      if(col==0){
        hue1 = randomWithinRange(masterHue,hueStep);
        color1 = "hsl("+hue1+","+(randomWithinRange(saturation,saturationRange))*100+"%,"+(randomWithinRange(lightness,saturationRange))*100+"%)";
      } else {
        hue1 = hueArray[row][col-1];
        color1 = colorArray[row][col-1];
      }
      
      if(Math.random()>0.05){
        hue2 = randomWithinRange(hue1,hueRange);
        color2 = "hsl("+hue2+","+(randomWithinRange(saturation,saturationRange))*100+"%,"+(randomWithinRange(lightness,saturationRange))*100+"%)";
      } else {
        color2 = "#0f083e";
        hue2 = getHueFromHex(color2);
      }

      hueArray[row].push(hue2);
      colorArray[row].push(color2);
      powerArray[row].push(Math.max(5,Math.random()*100));
      
    }

  }

  console.log(colorArray);

  startAnimation();

}

//Generative animation
//animation at randomized x/y points

function startAnimation(){

  console.log("start generative animation");

  if(playAnimationToggle==true){
    playAnimationToggle = false;
    cancelAnimationFrame(animationRequest);
    console.log("cancel animation");
  }//cancel any existing animation loops 
  playAnimationToggle = true;

  ctx.fillStyle = "black";
  ctx.fillRect(0,0,canvasWidth,canvasHeight);

  var numDotsPerFrame = canvasHeight * 2;
  var counter = 0;
  var xShift = 0;
  var maxXShift = canvasWidth * 0.5;

  var randomness = 1; //make this modular

  animationRequest = requestAnimationFrame(loop);

  function loop(){

    if(playAnimationToggle==true){

      counter++;
      
      for(i=0; i<numDotsPerFrame; i++){

        var currentX = counter % canvasWidth;
        var currentY = i % canvasHeight;

        /*
        if(Math.random() < 0.3){
          continue;
        }
        */

        xShift = Math.pow(Math.sin( (i+counter)*12*Math.PI*2 / randomness ), 5) * maxXShift;
  
        var currentRow = Math.min(numRows-1, Math.max(0, Math.floor( (currentY/canvasHeight) * numRows)));
        var numCols = colorArray[currentRow].length;
        var currentCol = Math.min(numCols-1, Math.floor( (currentX / canvasWidth) * numCols));
  
        var cellHeight = Math.ceil(canvasHeight / numRows);
        var cellWidth = Math.ceil (canvasWidth / numCols);
  
        var currentColor = colorArray[currentRow][currentCol];
        var currentPower = powerArray[currentRow][currentCol];
  
        var actualX = currentCol*cellWidth + Math.pow(Math.random(),currentPower) * cellWidth;
        var actualY = currentRow*cellHeight + Math.pow(Math.random(),1) * cellHeight;
  
        ctx.fillStyle = currentColor;
        ctx.fillRect(actualX + xShift,actualY,1,1);
      }

      animationRequest = requestAnimationFrame(loop);      

    } else {
      playAnimationToggle = false;
      cancelAnimationFrame(animationRequest);
      console.log("cancel animation");
    }

  }
}

//HELPER FUNCTIONS BELOW

//read and accept user input image
function readSourceImage(){

  if(playAnimationToggle==true){
      playAnimationToggle = false;
      cancelAnimationFrame(animationRequest);
      console.log("cancel animation");
  }
      
  //read image file      
  var file = imageInput.files[0];
  var reader = new FileReader();
  reader.onload = (event) => {
      var imageData = event.target.result;
      userImage = new Image();
      userImage.src = imageData;
      userImage.onload = () => {
        
          actualWidth = userImage.width;
          actualHeight = userImage.height;

          //image scaling
          if(actualWidth > maxImageWidth){
              scaledWidth = maxImageWidth;
              widthScalingRatio = scaledWidth / actualWidth;
              scaledHeight = actualHeight * widthScalingRatio;
          } else{
              scaledWidth = actualWidth;
              widthScalingRatio = 1;
              scaledHeight = actualHeight;
          }

          scaledWidth = Math.floor(scaledWidth/2)*2; //video encoder doesn't accept odd numbers
          scaledHeight = Math.floor(scaledHeight/8)*8; //video encoder wants a multiple of 8
          console.log("Image width/height: "+scaledWidth+", "+scaledHeight);

          drawImageToCanvas();
          chooseBackground();
          canvas.scrollIntoView({behavior:"smooth"});
          
      };
  };
    
  reader.readAsDataURL(file);
  isImageLoaded = true;

}

function drawImageToCanvas(){
  //resize the src variable of the original image
  canvasWidth = scaledWidth;
  canvasHeight = scaledHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  //draw the resized image onto the canvas
  ctx.drawImage(userImage, 0, 0, scaledWidth, scaledHeight);
}

function resetCanvas() {
  if(playAnimationToggle==true){
    playAnimationToggle = false;
    cancelAnimationFrame(animationRequest);
    console.log("cancel animation");
  } 
  startAnimation();
}

function saveImage(){
  const link = document.createElement('a');
  link.href = canvas.toDataURL();

  const date = new Date();
  const filename = `sieve_${date.toLocaleDateString()}_${date.toLocaleTimeString()}.png`;
  link.download = filename;
  link.click();
}

function tweakHexColor(hexColor, range){
  var rgbArray = hexToRGB(hexColor);

  var newRGBArray = [];

  newRGBArray.push(Math.floor(rgbArray[0]+range*Math.random()-range/2));
  newRGBArray.push(Math.floor(rgbArray[1]+range*Math.random()-range/2));
  newRGBArray.push(Math.floor(rgbArray[2]+range*Math.random()-range/2));

  var newHexColor = rgbToHex(newRGBArray[0],newRGBArray[1],newRGBArray[2]);
  return newHexColor;
}

function getHueFromHex(hex) {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;

  if (delta === 0) {
    hue = 0;
  } else if (max === r) {
    hue = (g - b) / delta;
  } else if (max === g) {
    hue = 2 + (b - r) / delta;
  } else {
    hue = 4 + (r - g) / delta;
  }

  hue *= 60;
  if (hue < 0) {
    hue += 360;
  }

  return hue;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null;
}

function rgbToHue(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const hue = Math.atan2(Math.sqrt(3) * (gNorm - bNorm), 2 * rNorm - gNorm - bNorm);
  return hue * 180 / Math.PI;
}

function rgbToSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max - min) / max;
}

function rgbToLightness(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max + min) / 2 / 255;
}

function interpolateHex(hex1,hex2,factor){
  hex1RGB = hexToRgb(hex1);
  hex2RGB = hexToRgb(hex2);

  var newR = Math.round(hex1RGB.r + (hex2RGB.r - hex1RGB.r)*factor);
  var newG = Math.round(hex1RGB.g + (hex2RGB.g - hex1RGB.g)*factor);
  var newB = Math.round(hex1RGB.b + (hex2RGB.b - hex1RGB.b)*factor);

  var rgbResult = "rgb("+newR+","+newG+","+newB+")";
  return rgbResult;
}

function rgbToHex(r, g, b) {
  return "#" + (
    (r.toString(16).padStart(2, "0")) +
    (g.toString(16).padStart(2, "0")) +
    (b.toString(16).padStart(2, "0"))
  );
}

function toggleGUI(){
  if(guiOpenToggle == false){
      gui.open();
      guiOpenToggle = true;
  } else {
      gui.close();
      guiOpenToggle = false;
  }
}

//shortcut hotkey presses
document.addEventListener('keydown', function(event) {
  
  if (event.key === 'r') {
      resetCanvas();
  } else if (event.key === 'i') {
      saveImage();
  } else if (event.key === 'v') {
      toggleVideoRecord();
  } else if (event.key === 'o') {
      toggleGUI();
  } else if(event.key === 'p'){
      pausePlayAnimation();
  } else if(event.key === 'm'){
      toggleMarkerDraw();
  }
 
});

// Mondrian object and functions

var mondrianPalette = ["black","white","red","blue","yellow"];

function randInt (min, max) {
  return Math.floor(Math.random() * (max - min) + min)
}

class Point {
  constructor (x, y) {
      this.x = x
      this.y = y
  }
}

class Rectangle {
  constructor (min, max) {
      this.min = min
      this.max = max
  }

  get width () {
      return this.max.x - this.min.x
  }

  get height () {
      return this.max.y - this.min.y
  }

  draw (ctx) {
      // Draw clockwise
      ctx.moveTo(this.min.x, this.min.y)
      ctx.lineTo(this.max.x, this.min.y)
      ctx.lineTo(this.max.x, this.max.y)
      ctx.lineTo(this.min.x, this.max.y)
      ctx.lineTo(this.min.x, this.min.y)
  }

  split (xPad, yPad, depth, limit, ctx) {
      ctx.fillStyle = mondrianPalette[randInt(0, mondrianPalette.length)]
      ctx.fillRect(this.min.x, this.min.y, this.max.x, this.max.y)
      this.draw(ctx)

      // Check the level of recursion
      if (depth === limit) {
      return
      }

      // Check the rectangle is enough large and tall
      if (this.width < 2 * xPad || this.height < 2 * yPad) {
      return
      }

      // If the rectangle is wider than it's height do a left/right split
      var r1 = new Rectangle()
      var r2 = new Rectangle()
      if (this.width > this.height) {
      var x = randInt(this.min.x + xPad, this.max.x - xPad)
      r1 = new Rectangle(this.min, new Point(x, this.max.y))
      r2 = new Rectangle(new Point(x, this.min.y), this.max)
      // Else do a top/bottom split
      } else {
      var y = randInt(this.min.y + yPad, this.max.y - yPad)
      r1 = new Rectangle(this.min, new Point(this.max.x, y))
      r2 = new Rectangle(new Point(this.min.x, y), this.max)
      }

      // Split the sub-rectangles
      r1.split(xPad, yPad, depth + 1, limit, ctx)
      r2.split(xPad, yPad, depth + 1, limit, ctx)
  }
}

function drawMondrian(){
  //draw Mondrian grid
  ctx.beginPath();
  ctx.lineWidth = 5;

  var xPad = Math.floor(canvasWidth * 0.05);
  var yPad = Math.floor(canvasHeight * 0.05);

  var initialRect = new Rectangle(new Point(0, 0), new Point(canvasWidth, canvasHeight));
  initialRect.split(xPad, yPad, 0, 8, ctx);

  ctx.stroke();
}

function pausePlayAnimation(){
  console.log("pause/play animation");
  if(playAnimationToggle==true){
      playAnimationToggle = false;
      cancelAnimationFrame(animationRequest);
      console.log("cancel animation");
  } else {
      startAnimation();
  }
}

//Perlin noise functions
//SOURCE: https://github.com/joeiddon/perlin

var perlinDataArray;

const GRID_SIZE = 3;
const RESOLUTION = 128;
var numPerlinRows = GRID_SIZE*RESOLUTION;
var numPerlinCols = GRID_SIZE*RESOLUTION;

function generatePerlinData(){

  perlin.seed(); //reset perlin data
  perlinDataArray = [];

  let pixel_size = canvasWidth / RESOLUTION;
  let num_pixels = GRID_SIZE / RESOLUTION;
  
  for (let y = 0; y < GRID_SIZE; y += num_pixels / GRID_SIZE){
      for (let x = 0; x < GRID_SIZE; x += num_pixels / GRID_SIZE){
          let currentPerlinValue = perlin.get(x, y);
          perlinDataArray.push(currentPerlinValue);

      }
  }

}

//use perlin noise to create a smooth gradient background
function generateGradientBackground(){

  var gradientDataArray;
  const GRID_SIZE = 1;
  const RESOLUTION = 32;

  perlin.seed(); //reset perlin data
  gradientDataArray = [];

  var baseHue = 180 + Math.random()*180; //bound between 180-360 (exclude green/yellow)
  var hueRange = 300;
  var saturation = 0.6 + Math.random()*0.4;
  var lightness = 0.4 + Math.random()*0.35;
  console.log("base hue / saturation / lightness: "+baseHue+", "+saturation+", "+lightness);

  var pixelWidth = Math.ceil(canvasWidth / RESOLUTION);
  var pixelHeight = Math.ceil(canvasHeight / RESOLUTION);
  let num_pixels = GRID_SIZE / RESOLUTION;
  
  for (let y = 0; y < GRID_SIZE; y += num_pixels / GRID_SIZE){
      for (let x = 0; x < GRID_SIZE; x += num_pixels / GRID_SIZE){
          let currentPerlinValue = perlin.get(x, y);
          gradientDataArray.push(currentPerlinValue);

          if(backgroundType == "Gradient"){
            //draw heatmap onto the canvas using perlin data
            var currentHue = parseInt(currentPerlinValue * hueRange/2 + baseHue);
            ctx.fillStyle = 'hsl('+currentHue+','+saturation*100+'%'+','+lightness*100+'%)';
            ctx.fillRect(
                Math.floor(x / GRID_SIZE * canvasWidth),
                Math.floor(y / GRID_SIZE * canvasHeight),
                pixelWidth,
                pixelHeight,
            );

          }
      }
  }
               
}

function toggleVideoRecord(){
  if(recordVideoState == false){
    recordVideoState = true;
    chooseRecordingFunction();
  } else {
    recordVideoState = false;
    chooseEndRecordingFunction();
  }
}

function chooseRecordingFunction(){
  if(isIOS || isAndroid || isFirefox){
      startMobileRecording();
  }else {
      recordVideoMuxer();
  }
}

function chooseEndRecordingFunction(){
      
    if(isIOS || isAndroid || isFirefox){
      mobileRecorder.stop();
    }else {
        finalizeVideo();
    }
  
}

//record html canvas element and export as mp4 video
//source: https://devtails.xyz/adam/how-to-save-html-canvas-to-mp4-using-web-codecs-api
async function recordVideoMuxer() {
  console.log("start muxer video recording");
  var videoWidth = Math.floor(canvas.width/2)*2;
  var videoHeight = Math.floor(canvas.height/8)*8; //force a number which is divisible by 8
  console.log("Video dimensions: "+videoWidth+", "+videoHeight);

  //display user message
  //recordingMessageCountdown(videoDuration);
  recordingMessageDiv.classList.remove("hidden");

  recordVideoState = true;
  const ctx = canvas.getContext("2d", {
    // This forces the use of a software (instead of hardware accelerated) 2D canvas
    // This isn't necessary, but produces quicker results
    willReadFrequently: true,
    // Desynchronizes the canvas paint cycle from the event loop
    // Should be less necessary with OffscreenCanvas, but with a real canvas you will want this
    desynchronized: true,
  });

  muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
  //let muxer = new Muxer({
      //target: new ArrayBufferTarget(),
      video: {
          // If you change this, make sure to change the VideoEncoder codec as well
          codec: "avc",
          width: videoWidth,
          height: videoHeight,
      },

      firstTimestampBehavior: 'offset', 

    // mp4-muxer docs claim you should always use this with ArrayBufferTarget
    fastStart: "in-memory",
  });

  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error(e),
  });

  // This codec should work in most browsers
  // See https://dmnsgn.github.io/media-codecs for list of codecs and see if your browser supports
  videoEncoder.configure({
    codec: "avc1.42003e",
    width: videoWidth,
    height: videoHeight,
    bitrate: 6_000_000,
    bitrateMode: "constant",
  });
  //NEW codec: "avc1.42003e",
  //ORIGINAL codec: "avc1.42001f",

  refresh();
  var frameNumber = 0;
  //setTimeout(finalizeVideo,1000*videoDuration+200); //finish and export video after x seconds

  //take a snapshot of the canvas every x miliseconds and encode to video
  videoRecordInterval = setInterval(
      function(){
          if(recordVideoState == true){
              renderCanvasToVideoFrameAndEncode({
                  canvas,
                  videoEncoder,
                  frameNumber,
                  videofps
              })
              frameNumber++;
          }else{
          }
      } , 1000/videofps);

}

//finish and export video
async function finalizeVideo(){
  console.log("finalize muxer video");
  clearInterval(videoRecordInterval);
  playAnimationToggle = false;
  recordVideoState = false;
  
  // Forces all pending encodes to complete
  await videoEncoder.flush();
  muxer.finalize();
  let buffer = muxer.target.buffer;
  finishedBlob = new Blob([buffer]); 
  downloadBlob(new Blob([buffer]));

  //hide user message
  recordingMessageDiv.classList.add("hidden");
  
}

async function renderCanvasToVideoFrameAndEncode({
  canvas,
  videoEncoder,
  frameNumber,
  videofps,
}) {
  let frame = new VideoFrame(canvas, {
      // Equally spaces frames out depending on frames per second
      timestamp: (frameNumber * 1e6) / videofps,
  });

  // The encode() method of the VideoEncoder interface asynchronously encodes a VideoFrame
  videoEncoder.encode(frame);

  // The close() method of the VideoFrame interface clears all states and releases the reference to the media resource.
  frame.close();
}

function downloadBlob() {
  console.log("download video");
  let url = window.URL.createObjectURL(finishedBlob);
  let a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  const date = new Date();
  const filename = `sieve_${date.toLocaleDateString()}_${date.toLocaleTimeString()}.mp4`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
}

//record and download videos on mobile devices
function startMobileRecording(){
  var stream = canvas.captureStream(videofps);
  mobileRecorder = new MediaRecorder(stream, { 'type': 'video/mp4' });
  mobileRecorder.addEventListener('dataavailable', finalizeMobileVideo);

  console.log("start simple video recording");
  console.log("Video dimensions: "+canvas.width+", "+canvas.height);

  //display user message
  //recordingMessageCountdown(videoDuration);
  recordingMessageDiv.classList.remove("hidden");
  
  recordVideoState = true;
  mobileRecorder.start(); //start mobile video recording

  /*
  setTimeout(function() {
      recorder.stop();
  }, 1000*videoDuration+200);
  */
}

function finalizeMobileVideo(e) {
  setTimeout(function(){
      console.log("finish simple video recording");
      recordVideoState = false;
      /*
      mobileRecorder.stop();*/
      var videoData = [ e.data ];
      finishedBlob = new Blob(videoData, { 'type': 'video/mp4' });
      downloadBlob(finishedBlob);
      
      //hide user message
      recordingMessageDiv.classList.add("hidden");

  },500);

}

function lockUnlockCanvas(){
  canvasLockToggle = !canvasLockToggle;
  console.log("Canvas lock state: "+canvasLockToggle);
}

function toggleMarkerDraw(){
  if(markerToggle){
    markerToggle = false;
    obj["marker"] = false;
  } else {
    markerToggle = true;
    obj["marker"] = true;
  }
}

function randomWithinRange(value,range){
  return value-range+Math.random()*range*2;
}

//MAIN METHOD
getUserInputs();
initiateBackground();

