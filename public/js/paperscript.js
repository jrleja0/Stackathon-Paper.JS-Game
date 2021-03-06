/* global Group, io, Path, Point, PointText, project, Raster, Rectangle, Size, Symbol, Tool, view */

var socket = io();

console.log('running-- w:', view.size.width, '&& h:', view.size.height);
//const largerScreenDim = view.size.width > view.size.height ? view.size.width : view.size.height;

//// creating background Symbols ////
function createBackground(rasterColor) {
  var quadrantSize = new Size(view.size.width / 2, view.size.height / 2);
  var quadrant = new Path.Rectangle(new Point(0, 0), quadrantSize);
  var backgroundRaster = new Raster(rasterColor);
  //// cropping/masking backgroundRaster onto quadrant ////
  var colorQuadrantGroup = new Group({
    children: [quadrant, backgroundRaster],
    clipped: true
  });
  backgroundRaster.fitBounds(quadrant.bounds, true);  //  "true" means background will fill the entire bounds, even if image is cropped.
  var symbol = new Symbol(colorQuadrantGroup);
  symbol.colorName = rasterColor;
  symbol.background = true;
  return symbol;
}

var blueBackgroundSymbol = createBackground('bluePattern');
var greenBackgroundSymbol = createBackground('greenPattern');
var redBackgroundSymbol = createBackground('redPattern');
var yellowBackgroundSymbol = createBackground('yellowPattern');

//// creating four quadrants ////
function createQuadrant(point) {
  var quadrantSize = new Size(view.size.width / 2, view.size.height / 2);
  return new Rectangle(point, quadrantSize); // Rectangle: point is top-right
}

var quadrant0 = createQuadrant(new Point(0, 0));
var quadrant1 = createQuadrant(new Point(view.size.width / 2, 0));
var quadrant2 = createQuadrant(new Point(0, view.size.height / 2));
var quadrant3 = createQuadrant(new Point(view.size.width / 2, view.size.height / 2));

//// function to add background Symbols to quadrants ////
var backgroundGroup = new Group();
backgroundGroup.name = 'backgroundGroup';

function addToQuadrant(quadrant) {
  return function (backgroundSymbol) {
    var symbol = backgroundSymbol.place(quadrant.center);
    backgroundGroup.addChild(symbol);
    quadrant.colorName = backgroundSymbol.colorName;
  };
}

var addToQuadrant0 = addToQuadrant(quadrant0);
var addToQuadrant1 = addToQuadrant(quadrant1);
var addToQuadrant2 = addToQuadrant(quadrant2);
var addToQuadrant3 = addToQuadrant(quadrant3);

//// actually adding the backgrounds to the canvas:
function initializingQuadrantBackgrounds(){
  addToQuadrant0(blueBackgroundSymbol);
  addToQuadrant1(greenBackgroundSymbol);
  addToQuadrant2(redBackgroundSymbol);
  addToQuadrant3(yellowBackgroundSymbol);
}
initializingQuadrantBackgrounds();

//// creating circle symbols ////
var createCircleSymbol = function(color, rotationDegree) {
  var smallerViewDim = Math.min(view.size.height, view.size.width);
  var circle = new Path.Circle(new Point(100, 100), smallerViewDim / 12);
  var colorBackground = new Raster(color);
  colorBackground.scale(0.25);
  //// cropping/masking colorBackground onto circle ////
  var colorCircleGroup = new Group({
    children: [circle, colorBackground],
    clipped: true
  });
  colorBackground.fitBounds(circle.bounds);
  var symbol = new Symbol(colorCircleGroup);
  symbol.colorName = color;
  symbol.background = false;
  symbol.radius = smallerViewDim / 12;
  return symbol;
};

var blueSymbol = createCircleSymbol('bluePattern');
var greenSymbol = createCircleSymbol('greenPattern');
var redSymbol = createCircleSymbol('redPattern');
var yellowSymbol = createCircleSymbol('yellowPattern');

//// placing circle symbols:
var yel1 = yellowSymbol.place(quadrant3.center);
var red1 = redSymbol.place(quadrant2.center);
var gre1 = greenSymbol.place(quadrant1.center);
var blu1 = blueSymbol.place(quadrant0.center);

var symbolsGroup = new Group([yel1, red1, gre1, blu1]);
symbolsGroup.name = 'symbolsGroup';

//// instantiating onMouseDown ////
var tool = new Tool(),
  selectedObject = null,
  dragCounter = 0,
  score = 0,
  gameNotStarted = true,
  player1 = false;

function resetObjectVectorAndDragCounter(object, broadcast) {
    if (broadcast) socket.emit('mouseDown', object);
    selectedObject = object;
    selectedObject.newVectorX = 0;
    selectedObject.newVectorY = 0;
    dragCounter = 0;
}

function mainMouseDownFn(e) {
  var hitResult = project.activeLayer.hitTest(e.point);
  if (hitResult) {
    // functionality to start game:
    if (gameNotStarted) {
      var color = hitResult.item.definition.colorName;
      var background = hitResult.item.definition.background;
      if (background) return;
      gameNotStarted = false;
      // TODO: new feature: clicking a different orb at start will initialize a different game mode.
      if (color === 'bluePattern' && !background) {
        player1 = true;
        socket.emit('startGame');
      } else if (color === 'greenPattern' && !background) {
        player1 = true;
        socket.emit('startGame');
      } else if (color === 'redPattern' && !background) {
        player1 = true;
        socket.emit('startGame');
      } else if (color === 'yellowPattern' && !background) {
        player1 = true;
        socket.emit('startGame');
      }
    }
    // functionality during game play:
    else {
      resetObjectVectorAndDragCounter(hitResult.item, true);
    }
  }
}

tool.onMouseDown = mainMouseDownFn;

function setNewVectorOnDrag(x, y, broadcast) {
  if (selectedObject && dragCounter < 1) {  // drag event captures a lot of data, so only the first drag event is used each time an object is dragged.
    if (broadcast) socket.emit('mouseDrag', x, y);
    selectedObject.newVectorX += x / 10;
    selectedObject.newVectorY += y / 10;
  }
}

//// instantiating onMouseDrag ////
tool.onMouseDrag = function(e) {
  var x = e.delta.x, y = e.delta.y;
  setNewVectorOnDrag(x, y, true);
};

function symbolBoundsCreator(symbol) {
  return ([
    (symbol.position - new Point(symbol.definition.radius, 0)),  // leftCenter point
    (symbol.position + new Point(symbol.definition.radius, 0)),  // rightCenter point
    (symbol.position - new Point(0, symbol.definition.radius)),  // topCenter point
    (symbol.position + new Point(0, symbol.definition.radius))   // bottomCenter point
  ]);
}

function overQuadrant0(point) {
  return point.x < view.bounds.center.x && point.y < view.bounds.center.y;
}
function overQuadrant1(point) {
  return point.x > view.bounds.center.x && point.y < view.bounds.center.y;
}
function overQuadrant2(point) {
  return point.x < view.bounds.center.x && point.y > view.bounds.center.y;
}
function overQuadrant3(point) {
  return point.x > view.bounds.center.x && point.y > view.bounds.center.y;
}

function checkingQuadrantOverlap(symbolPoint) {
  if (overQuadrant0(symbolPoint)) {
    return quadrant0;
  } else if (overQuadrant1(symbolPoint)) {
    return quadrant1;
  } else if (overQuadrant2(symbolPoint)) {
    return quadrant2;
  } else if (overQuadrant3(symbolPoint)) {
    return quadrant3;
  }
}

function checkingColorMatch(symbol, quadrant) {
  if (!symbol || !quadrant) {
    return false;
  } else {
    return symbol.definition.colorName === quadrant.colorName;
  }
}

function symbolInBounds(symbolBounds) {
  var leftCenter = symbolBounds[0],
    rightCenter = symbolBounds[1],
    topCenter = symbolBounds[2],
    bottomCenter = symbolBounds[3];
  return (rightCenter.x > 0 && leftCenter.x < view.bounds.width &&  // returns true if in bounds.
    bottomCenter.y > 0 && topCenter.y < view.bounds.height);
}

var players = 1;
var openingText = new PointText({
    name: 'openingText',
    position: new Point((view.bounds.width / 10), (view.bounds.height / 10 * 9)),
    fontSize: 30,
    fillColor: '#f6e8f9',
    content: 'Click an orb to start a '
});
var openingText2 = new PointText({
    name: 'openingText',
    position: new Point((view.bounds.width / 10), (view.bounds.height / 10 * 9.5)),
    fontSize: 30,
    fillColor: '#f6e8f9',
    content: players + ' player game.'
});

socket.on('playerNumChange', function(playerNum) {
  openingText2.content = playerNum + ' player game.';
});

socket.on('disconnect', function(playerNum) {
  openingText2.content = playerNum + ' player game.';
});

var startText,
  startTextOptions = {
    name: 'startText',
    position: new Point((view.bounds.width / 10), (view.bounds.height / 2)),
    fontSize: 100,
    fillColor: 'white',
    content: 'Get Ready!'
  };

function endGame() {
  view.off('frame');
  socket.emit('endGame', score);
}

//// onFrame function (will be called on view.onFrame):
var animateGame = function(e) {
  if (e.count === 1) {
    openingText.remove();
    openingText2.remove();
    startText = new PointText(startTextOptions);
  }
  if (e.count === 80) {
    startText.content = 'GO!';
    startText.position.x = view.bounds.width / 3;
  }
  if (e.count === 170) startText.remove();

  if (player1 && e.count > 179 && e.count % 8 === 0) {
    socket.emit('addSymbol');
  }

  //// rotate circle symbols:
  blueSymbol.definition.rotate(1);
  greenSymbol.definition.rotate(1);
  redSymbol.definition.rotate(-1);
  yellowSymbol.definition.rotate(-1);

  //// iterating through symbols:
  for (var a = 0; a < symbolsGroup.children.length; a++) {
    var symbol = symbolsGroup.children[a];
    //// adding/subtracting from score for each symbol:
    var symbolBounds = symbolBoundsCreator(symbol);  // finding leftCenter, rightCenter, topCenter, bottomCenter points
    if (!symbolInBounds(symbolBounds)) {
      symbol.remove();
      a--;
      continue;
    }

    //// iterating through symbolBounds' points
    for (var b = 0; b < symbolBounds.length; b++) {
      var borderingQuadrant = checkingQuadrantOverlap(symbolBounds[b]);  // returns quadrant that symbolPoint overlaps.
      var colorMatch = checkingColorMatch(symbol, borderingQuadrant);  // (Boolean)
      score += colorMatch ? 2 : -1;
    }

    //// keeping track of score
    e.count % 50 === 0 ? console.log('SCORE!', score) : null;

    //// moving each symbol
    if (symbol.newVectorX || symbol.newVectorY) {
      symbol.position.x += symbol.newVectorX;
      symbol.position.y += symbol.newVectorY;
    } else {
      symbol.position += new Point(5, 0);
    }
  }

  if (e.count === 3600) {
    startText.content = 'Almost Done!';
    startText.fontSize = 80;
    startText.position.x -= 40;
    project.activeLayer.addChild(startText);
  }
  if (e.count === 3700) startText.remove();
  if (e.count === 3810) {
    project.activeLayer.addChild(startText);
    startText.content = '3';
  }
  if (e.count === 3870) {
    startText.position.x += 200;
    startText.content = '2';
  }
  if (e.count === 3930) {
    startText.position.x += 200;
    startText.content = '1';
  }
  if (e.count === 3990) {
    startText.position.x -= 400;
    startText.content = 'Stop!';
  }
  if (e.count === 4006) {
    endGame();
  }
};

function createSymbol(randomSymbolType, newPositionX, newPositionY, newVectorX, newVectorY) {
  var symbolTypes = [blueSymbol, greenSymbol, redSymbol, yellowSymbol];
  var newSymbol = symbolTypes[randomSymbolType].place(new Point(newPositionX, newPositionY));
  symbolsGroup.addChild(newSymbol);
  newSymbol.newVectorX = newVectorX;
  newSymbol.newVectorY = newVectorY;
}

function startAnimation(animateGameFn) {
  view.onFrame = animateGameFn;
}

socket.on('startGame', function() {
  gameNotStarted = false;
  startAnimation(animateGame);
});

socket.on('addSymbol', function(newSymbolInfo) {
  var newSymbol = createSymbol(newSymbolInfo['randomSymbolType'], newSymbolInfo['newPositionX'], newSymbolInfo['newPositionY'], newSymbolInfo['newVectorX'], newSymbolInfo['newVectorY']);
});

socket.on('mouseDown', resetObjectVectorAndDragCounter);

socket.on('mouseDrag', setNewVectorOnDrag);

socket.on('endGame', function(scores) {
  console.log('final score', score);
  console.log('scores', scores);
  var rank = scores.indexOf(score) + 1;
  var playersNum = scores.length;
  startText.remove();
  var outcomeText = new PointText({
    name: 'outcomeText',
    content: rank === 1 ? 'You Won!' : 'Try Again!',
    fillColor: rank === 1 ? 'yellow' : 'red',
    fontSize: 100,
    position: new Point(quadrant0.width, 100)
  });
  project.activeLayer.addChild(outcomeText);
  var rankText = new PointText({
    name: 'rankText',
    content: 'You ranked ' + rank + ' out of ' + playersNum + ' players.',
    fillColor: 'white',
    fontSize: 40,
    position: new Point(quadrant0.width, view.bounds.height / 2 - 50)
  });
  project.activeLayer.addChild(rankText);
  var replaySymbol = greenSymbol.place(new Point(quadrant0.width, view.bounds.height / 10 * 8));
  replaySymbol.name = 'replaySymbol';
  var replayText = new PointText({
    name: 'replayText',
    content: 'Replay!',
    fillColor: 'yellow',
    fontSize: 30,
    position: new Point(replaySymbol.bounds.center)
  });
  function replayOnMouseDown(e) {
    var hitResult = project.activeLayer.hitTest(e.point);
    if (hitResult && hitResult.item.name &&
      (hitResult.item.name === 'replaySymbol' ||
      hitResult.item.name === 'replayText')) {
      window.location.href = window.location.origin;
    }
  }
  tool.onMouseDown = replayOnMouseDown;
});
