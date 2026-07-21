import { Ball } from "./ball.js";
import { Polygon } from "./polygon.js";
import { colors, REST_THRESHOLD } from "./globals.js";
import { Vector2 } from "./vector2.js";
import {
    radiusSlider, radiusValueDisplay, bouncinessValueDisplay, bouncinessSlider, airResistanceSlider, airResistanceValueDisplay,
    massSlider, massValueDisplay, frictionSlider, frictionValueDisplay, timeScaleSlider, timeScaleDisplay, resetTimeScaleButton,
    fpsDisplay, objectsDisplay, resetButton, spawnModeButton, pushModeButton, inspectModeButton, infoRadiusDisplay, infoMassDisplay,
    infoBouncinessDisplay, infoFrictionDisplay, infoBox, colorInfoDisplay, diagonalLine
} from "./ui.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

let mode = 1; // 1 for spawn, 2 for push

let lastTime = performance.now();

let objects = [];

let fpsTimer = 0;

const iterations = 3;
const substeps = 8;

let airResistance = 1.225;

let timeScale = 1;

let nextBallId = 0;

let maxSmallRadius = 25; // track the biggest ball currently in the scene

const BIG_RADIUS = 30;

let isHolding = false;

let mouseX = 0;
let mouseY = 0;

let currentInfoObject;
let draggedBall = null;


function update(dt) {
    for (const ball of objects) {
        if (ball.isBeingDragged) continue;
        ball.update(dt, airResistance);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const ball of objects) {
        ball.draw(ctx);
    }

}

function loop() {
    // find deltaTime
    let currentTime = performance.now();
    let actualDt = (currentTime - lastTime) / 1000;
    // update the fps display every quarter second
    if (fpsTimer >= 0.25) {
        fpsDisplay.textContent = Math.round(1 / actualDt);
        fpsTimer = 0;
    }
    fpsTimer += actualDt;
    // if the program freezes or is tabbed out, don't create a massive deltaTime
    if (actualDt > 0.1) {
        actualDt = 0.016;
    }
    const dt = actualDt * timeScale;

    for (const ball of objects) {
        ball.updateLastPosition();
    }

    updateDrag(dt);

    // substeps, which reduce time in between calculations but do fewer corrective calculations
    let subDt = dt / substeps;
    for (let i = 0; i < substeps; i++) {

        update(subDt);

        resolveCollisons(subDt);
    }

    for (const ball of objects) {
        ball.updateBallSleep(dt);
    }

    lastTime = currentTime;

    draw();

    requestAnimationFrame(loop);
    // setTimeout(loop, 0); // <-- fps test, with a clamped 4ms delay maybe
}

// impulses for collisions
// uses spatial hashing
function resolveCollisons(dt) {
    // build the new grid
    const grid = buildGrid();
    // calculate the physics k times
    for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < objects.length; i++) {
            const b1 = objects[i];
            // check for radius size, for a hybrid spatial hashing
            // big balls check collision pairs manually, small ones use hashing
            if (b1.radius >= BIG_RADIUS) {
                // loop through every ball
                for (let j = 0; j < objects.length; j++) {
                    const b2 = objects[j];
                    // if the two are the same ball, skip the iteration
                    if (b1 === b2) continue;
                    // if the other ball is also big, then only check one id pair to avoid duplicating the collision
                    if (b2.radius >= BIG_RADIUS && b2.id < b1.id) continue;

                    narrowPhase(b1, b2);

                }
            } else {
                // for each ball, find its nearby balls (a ball can be in at most 4 cells the size of the ball)
                const near = getNearbyBalls(b1, grid);
                // for each nearby ball, check to make sure we haven't already calculated the pair
                for (let j = 0; j < near.length; j++) {
                    const b2 = near[j];

                    // if the balls have the same id or we've already seen the pair, skip the pair
                    if (b2.id <= b1.id) continue; // skip self and already-covered pairs

                    // check for collision and resolve it
                    narrowPhase(b1, b2);

                }

            }

            // clamp every ball to the bounds of the screen
            objects[i].checkBounds(canvas, dt);

        }
    }
}

// actually handles the collision physics
function narrowPhase(b1, b2) {
    if (b1.isAsleep && b2.isAsleep) return;
    if (b1.type === "circle" && b2.type === "circle") {
        circleCircle(b1, b2);
    } else if (b1.type === "circle" && b2.type === "polygon") {
        circlePolygon(b1, b2);
    } else if (b1.type === "polygon" && b2.type === "circle") {
        // always keep the circle first and the polygon second
        circlePolygon(b2, b1);
    } else {
        polygonPolygon(b1, b2);
    }

}

function circleCircle(b1, b2) {
    // direction vector from the center of the two balls
    let dir = b1.position.clone().sub(b2.position);
    // magnitude the direction vector
    const dist = dir.magnitude();
    // sum of the radii, the ideal distance of touching balls
    const radiusSum = b1.radius + b2.radius;

    if (dist > radiusSum) return;

    // normalize the direction vector
    if (dist > 0) {
        dir.normalize();
    } else {
        dir = new Vector2(1, 0);
    }
    const overlap = radiusSum - dist;

    resolveImpulse(b1, b2, dir, overlap);
}

function circlePolygon(b1, b2) {
    // SAT
    const vertices = b2.getWorldVertices();
    let highestEdgeDot = -Infinity;
    let bestEdge = 0;

    for (let i = 0; i < vertices.length; i++) {
        // get the 2 vertices and form the edge AB
        const a = vertices[i];
        // next point, unless i is the last vertex, in which case wrap around back to 0
        const b = vertices[i === vertices.length - 1 ? 0 : i + 1];
        // form the edge AB
        const edge = b.clone().sub(a);
        // (y, -x) is always outwards because the vertices are created clockwise
        const normal = new Vector2(edge.y, -edge.x).normalize();

        // calculate distance to the a point on the edge (point a works)
        const distToPoint = b1.position.clone().sub(a);
        // dot product this vector with the normal vector to get distance to the edge vector
        const distToEdge = distToPoint.dotProduct(normal);

        // if the distance to the edge is greater than any other saved edge, store it
        // this is to maximize heuristic elimination
        if (distToEdge > highestEdgeDot) {
            highestEdgeDot = distToEdge;
            bestEdge = i;
        }
    }

    // if the distance to an edge is greater than the radius of the ball, we can guarantee no collision
    if (highestEdgeDot > b1.radius) return;

    // take the best edge
    const a = vertices[bestEdge];
    const b = vertices[bestEdge === vertices.length - 1 ? 0 : (bestEdge + 1)];
    const edge = b.clone().sub(a);

    // if the greatest dot product is negative, the circle is inside the polygon 
    if (highestEdgeDot < 0) {
        const faceNormal = new Vector2(edge.y, -edge.x).normalize();

        const overlap = b1.radius - highestEdgeDot;

        resolveImpulse(b1, b2, faceNormal, overlap);
        return;
    }
    
    // find the distance to the edge vector, and divide by the magnitude squared of the edge (vector projection)
    let t = b1.position.clone().sub(a).dotProduct(edge) / edge.dotProduct(edge);

    // clamp t so it always lies on the actual edge, and not possibly off the edge but in the same direction
    t = clamp(t, 0, 1);

    // start at a and move down the edge a distance t
    // start + direction * distance = our point
    const closestPoint = a.clone().add(edge.clone().mult(t));

    // find the distance between the ball and the real point
    let dir = b1.position.clone().sub(closestPoint);
    const dist = dir.magnitude();
    // if it's greater than the radius, no collision
    if (dist > b1.radius) return;

    // find how much the ball overlaps into the polygon
    const overlap = b1.radius - dist;

    // get the normal vector
    if (dist > 0) {
        dir.normalize();
    } else {
        dir = new Vector2(0, -1);
    }

    resolveImpulse(b1, b2, dir, overlap);

}

function polygonPolygon(b1, b2) {
    // the two sets of vertices
    const verts1 = b1.getWorldVertices();
    const verts2 = b2.getWorldVertices();

    let smallestOverlap = Infinity;
    let smallestAxis = null;

    // loop through the first set of vertices
    for (let i = 0; i < verts1.length; i++) {
        // get 2 points on an edge AB
        const a = verts1[i];
        const b = verts1[i === verts1.length - 1 ? 0 : i + 1];

        // find the normal vector of the edge
        const edge = b.clone().sub(a);
        const axis = new Vector2(edge.y, -edge.x).normalize();

        // project both set of vertices onto our edge to find maxes and mins
        const proj1 = projectVertices(verts1, axis);
        const proj2 = projectVertices(verts2, axis);

        const overlap = getOverlap(proj1, proj2); // find if the two edges overlap

        // no overlap found
        if (overlap < 0) return;
        // update the smallest overlap (we want to correct only as minimally as possible)
        if (overlap < smallestOverlap) {
            smallestOverlap = overlap;
            smallestAxis = axis;
        }
    }

    // loop through the other polygon's vertices
    for (let i = 0; i < verts2.length; i++) {
        // get 2 points on an edge AB
        const a = verts2[i];
        const b = verts2[i === verts2.length - 1 ? 0 : i + 1];

        // find the normal vector of the edge
        const edge = b.clone().sub(a);
        const axis = new Vector2(edge.y, -edge.x).normalize();

        // project both set of vertices onto our edge to find maxes and mins
        const proj1 = projectVertices(verts1, axis);
        const proj2 = projectVertices(verts2, axis);

        const overlap = getOverlap(proj1, proj2); // find if the two edges overlap

        // no overlap found
        if (overlap <= 0) return;
        // update the smallest overlap (we want to correct only as minimally as possible)
        if (overlap < smallestOverlap) {
            smallestOverlap = overlap;
            smallestAxis = axis;
        }
    }

    // find the direction between the two polygons' centers
    const centerDir = b1.position.clone().sub(b2.position);
    
    // if the dot product is less than 0, then flip the axis (resolveImpulse needs a normal from b2 to b1)
    if (smallestAxis.dotProduct(centerDir) < 0) {
        smallestAxis.mult(-1);
    }

    resolveImpulse(b1, b2, smallestAxis, smallestOverlap);

}

// Helper function to loop through an array of vertices and find the min and max dot products of the vertex to an axis
function projectVertices(vertices, axis) {
    let min = Infinity;
    let max = -Infinity;

    for (const vertex of vertices) {
        const projection = vertex.dotProduct(axis);

        if (projection < min) {
            min = projection;
        }

        if (projection > max) {
            max = projection;
        }
    }

    return { min, max };
}

// generic impulse for rigidbodies
function resolveImpulse(b1, b2, normal, overlap) {
    // inverse masses, needed a few times 
    const invMass1 = getInvMass(b1);
    const invMass2 = getInvMass(b2);

    // they overlap, push them apart before applying impulses
    if (overlap > 0) {

        // slop damping
        // percent correction each iteration
        const percent = 0.9;
        // overlap amount to ignore 
        const slop = 0.03;

        const correction = Math.max(overlap - slop, 0) * percent;

        // balls with more mass in a collision move less
        const totalMass = invMass1 + invMass2;

        b1.position.add(normal.clone().mult(correction * invMass1 / totalMass));
        b2.position.sub(normal.clone().mult(correction * invMass2 / totalMass));
    }

    // find relative velocity between b1 and b2
    const relativeVelocity = b1.velocity.clone().sub(b2.velocity);

    // take dot product
    const velAlongNormal = relativeVelocity.dotProduct(normal);

    // if the dot product (velocity along axis of collision) is greater than 0, skip
    if (velAlongNormal > 0) return;

    // it's more physically accurate to take the minimum of the two bounciness values instead of averaging the values
    // let collisionBounciness = (b1.bounciness + b2.bounciness) / 2;
    let collisionBounciness = Math.min(b1.bounciness, b2.bounciness);

    // if the collision is tiny, don't even bounce at all (avoid microbounces)
    if (Math.abs(velAlongNormal) < REST_THRESHOLD) {
        collisionBounciness = 0;

    } else {
        b1.wake();
        b2.wake();
    }

    // standard 2d engine method for collisions as opposed to 1D elastic collision method
    const j =
        -(1 + collisionBounciness) * velAlongNormal /
        (invMass1 + invMass2);

    const impulse = normal.mult(j);

    b1.velocity.add(
        impulse.clone().mult(invMass1)
    );

    b2.velocity.sub(
        impulse.mult(invMass2)
    );
}

// helper function which returns the overlap between two intervals
// by subtracting the smaller endpoint with the greater startpoint
function getOverlap(b1, b2) {
    return Math.min(b1.max, b2.max) - Math.max(b1.min, b2.min);
}

// construct the grid for splicing
function buildGrid() {
    // the cell size must be as big as the biggest ball
    const cellSize = maxSmallRadius * 2;
    // new map
    /* 
     we use a map opposed to a 2d array because a map doesn't require us to pre-allocate memory,
     when most likely, most of the screen is empty at any given time
     */
    const grid = new Map();
    // loop through all the balls, create a key of which cell they would be in for X and Y
    for (const ball of objects) {
        if (ball.radius >= BIG_RADIUS) continue;
        const cellX = Math.floor(ball.position.x / cellSize);
        const cellY = Math.floor(ball.position.y / cellSize);
        const key = cellKey(cellX, cellY)

        // if the grid doesn't have that cell yet, create it and initialize it to empty
        if (!grid.has(key)) {
            grid.set(key, []);
        }
        // add the ball to its entry in the map
        grid.get(key).push(ball);
    }
    return grid;
}

// find balls in the passed-in ball's cell and 8 neighboring cells
function getNearbyBalls(ball, grid) {
    // the cell size must be as big as the biggest ball
    const cellSize = maxSmallRadius * 2;

    // find which cells the ball is in
    const cellX = Math.floor(ball.position.x / cellSize);
    const cellY = Math.floor(ball.position.y / cellSize);

    // nearby balls within the 9 cells we're searching
    const near = [];

    // left to right, bottom to top, search one cell on either side
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            // check the ball's cell plus the 8 surrounding it
            const key = cellKey(cellX + x, cellY + y);
            const cell = grid.get(key);

            if (cell !== undefined) {
                for (const nearBall of cell) {
                    near.push(nearBall);
                }
            }
        }
    }

    return near;
}


function updateDrag(dt) {
    if (!isHolding || !draggedBall) return;
    // value of the mouse, clamped in the edges of the screen
    const target = new Vector2(
        clamp(mouseX, draggedBall.radius, canvas.width - draggedBall.radius),
        clamp(mouseY, draggedBall.radius, canvas.height - draggedBall.radius)
    );

    if (dt > 0) {
        // velocity = change in position over time
        const instantVelocity = target.clone().sub(draggedBall.position).mult(1 / dt);
        // multiplied by 0.4 so a small touch doesn't send the balls flying
        draggedBall.velocity = draggedBall.velocity.clone().mult(0.4).add(instantVelocity.mult(0.4));
    }

    // move the dragged ball to the mouse position
    draggedBall.position.x = target.x;
    draggedBall.position.y = target.y;
}

// Helper function to clamp the first parameter to a min and max value
function clamp(n, min, max) {
    if (n < min) {
        return min;
    } else if (n > max) {
        return max;
    }
    return n;
}

// Helper function to get a unique int key for any 2 cells
function cellKey(cellX, cellY) {
    // turn string keys into int keys

    /*
     Step 1: shift negatives to positive, by adding (2^16 / 2) to cellX, which is 32768. The new range is 0...65535
     Step 2: Shift x left by 16 bits, by multiplying by 2^16
     Step 3: Add y, to fill the final 16 bits (remember to also shift y to positive)
     This gives 32 unique bits to represent our coordinate system of any number of cells up to 2^16
     We're basically packing 2 16-bit ints together, which is faster than string hashing because of string allocation
     */

    return (cellX + 32768) * 65536 + (cellY + 32768);
}

// function to spawn a ball in as well as do other stuff
function spawnBall(posVector, radius, color, mass, bounciness, friction) {
    // position vector, radius, color, mass, bounciness
    const ball = new Ball(posVector, radius, color, mass, bounciness, friction);
    // increment ball id
    ball.id = nextBallId++;
    // add the ball to the array of balls in the scene
    objects.push(ball);
    // update maxSmallRadius (largest radius below BIG_RADIUS)
    if (radius < BIG_RADIUS) {
        maxSmallRadius = Math.max(maxSmallRadius, radius);
    }
    objectsDisplay.textContent = objects.length;
}

function spawnPolygon(posVector, vertices, color, mass, bounciness, friction) {
    const polygon = new Polygon(posVector, vertices, color, mass, bounciness, friction);
    polygon.id = nextBallId++;
    objects.push(polygon);
    objectsDisplay.textContent = objects.length;


}

// Helper function to return the inverse mass of an object
// dragged objects act as infinite pass
function getInvMass(obj) {
    return obj.isBeingDragged ? 0 : 1 / obj.mass;
}

// Helper function to get a random number in a range
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Helper function to reset the scene
function resetScene() {
    objects = [];
    nextBallId = 0; // not needed but simple

    radiusSlider.value = 25;
    maxSmallRadius = 25;
    radiusValueDisplay.textContent = radiusSlider.value;

    bouncinessSlider.value = 0.65;
    bouncinessValueDisplay.textContent = bouncinessSlider.value;

    airResistanceSlider.value = 1.225;
    airResistanceValueDisplay.textContent = airResistanceSlider.value;

    massSlider.value = 25;
    massValueDisplay.textContent = massSlider.value;

    frictionSlider.value = 2;
    frictionValueDisplay.textContent = frictionSlider.value;

    timeScaleSlider.value = 1;
    timeScaleDisplay.textContent = timeScaleSlider.value;
    timeScale = 1;

    mode = 1; // reset to spawn mode
    spawnModeButton.classList.add("active");
    pushModeButton.classList.remove("active");
    inspectModeButton.classList.remove("active");

    objectsDisplay.textContent = objects.length;

    infoRadiusDisplay.textContent = "25";
    infoMassDisplay.textContent = "25";
    infoBouncinessDisplay.textContent = "0.65";
    infoFrictionDisplay.textContent = "2";

    updateInfoPanel(null);

}

// Resizes the canvas when the window size is changed
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

// web audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// function to play a blip sound effect
// credit to claude for this function
function playSpawnSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}
// button click sound effect
function playClickSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
}
// slider movement sound effect
function playSliderTick() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(2100, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.015);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.015);
}

function benchmark(count, frames) {
    resetScene();
    for (let i = 0; i < count; i++) {
        const x = randomRange(0, canvas.width);
        const y = randomRange(0, canvas.height);
        const posVector = new Vector2(x, y);

        const radius = Math.round(randomRange(8, 40));
        const color = colors[Math.floor(randomRange(0, colors.length))];
        const mass = Math.round(randomRange(1, 100));
        const bounciness = Math.round(randomRange(0, 0.99));
        const friction = Math.round(randomRange(0, 10));

        spawnBall(posVector, radius, color, mass, bounciness, friction);

    }

    const times = [];
    for (let i = 0; i < frames; i++) {
        const start = performance.now();
        update(0.016);
        resolveCollisons(0.016);
        times.push(performance.now() - start);
    }
    const averageTime = times.reduce((a, b) => a + b) / times.length; // lambda function
    const worstTime = Math.max(...times); // spread operator
    console.log(`${count} bodies: avg ${averageTime.toFixed(2)}ms, worst ${worstTime.toFixed(2)}ms`);


}

function updateInfoPanel(object) {

    if (object !== currentInfoObject) {
        currentInfoObject = object;
        if (object === null) {
            infoBox.style.display = "none";
            return;
        }
        infoRadiusDisplay.textContent = object.radius;
        infoMassDisplay.textContent = object.mass;
        infoBouncinessDisplay.textContent = object.bounciness;
        infoFrictionDisplay.textContent = object.friction;
        colorInfoDisplay.textContent = "// " + object.color;
        
        infoBox.style.display = "flex";

        playSliderTick();
    }

    // update the info box position for edges of the screen <-- very messy code (ᵕ—ᴗ—)
    const updateX = mouseX < 1200;
    const updateY = mouseY > 200;
    infoBox.style.left = updateX ? `${mouseX + 72}px` : `${mouseX - 72 - infoBox.offsetWidth}px`;
    infoBox.style.top = updateY ? `${mouseY - 170}px` : `${mouseY + 170 - infoBox.offsetHeight}px`;
    // update the line leading to the box
    let moveX = updateX ? 0 : infoBox.offsetWidth + 70;
    let moveY = updateX ? 0 : 40;
    moveY += updateY ? 0 : -infoBox.offsetHeight - (updateX ? 0 : 80);
    let rotationChange = updateX ? 150 : - 150;
    rotationChange += updateY ? 0 : updateX ? 60 : -60;
    diagonalLine.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotationChange}deg)`;
    // update the corners if one or the other is true, but not both
    infoBox.classList.toggle("flipped", updateX !== updateY);

   
}

function makeSquareVertices(size) {
    const k = size / 2;
    return [
        new Vector2(-k, -k), new Vector2(k, -k),
        new Vector2(k, k), new Vector2(-k, k)
    ];
}


// summon one ball
canvas.addEventListener("click", (event) => {
    // spawn mode
    if (mode === 1) {
        // plop sound when a ball is spawned
        playSpawnSound();

        // get mouse position
        const rect = canvas.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        // small nudge so clicking twice in the same spot won't stack balls
        const nudge = randomRange(0.01, 0.02);
        const posVector = new Vector2(x + nudge, y + nudge);

        const radius = parseFloat(radiusSlider.value);

        const color = colors[Math.floor(randomRange(0, colors.length))]
        const mass = parseFloat(massSlider.value);
        const bounciness = parseFloat(bouncinessSlider.value);
        const friction = parseFloat(frictionSlider.value);

        // position vector, radius, color, mass, bounciness
        spawnBall(posVector, radius, color, mass, bounciness, friction);
    }
});

// hold tracking for the push mode
canvas.addEventListener("mousedown", (event) => {
    if (mode === 2) {
        // get mouse position
        const rect = canvas.getBoundingClientRect();

        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;
        // drag balls
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            const dist = obj.position.clone().sub(new Vector2(mouseX, mouseY)).magnitude();
            if (dist <= obj.radius) {
                draggedBall = obj;
                draggedBall.isBeingDragged = true;
                draggedBall.wake(); // wake if sleeping
                isHolding = true;
                break;
            }
        }
        // const power = 10000;

        // constantlyPushBalls(power);
    }
});
document.addEventListener("mouseup", () => {
    if (draggedBall) {
        draggedBall.isBeingDragged = false;
        draggedBall = null;
    }
    isHolding = false;

});
// canvas.addEventListener("mouseleave", () => {
//     isHolding = false;

// });
document.addEventListener("mousemove", (event) => {
    // update mouse position
    const rect = canvas.getBoundingClientRect();

    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    if (mode === 3) {
        for (const object of objects) {
            const dist = Math.sqrt((object.position.x - mouseX) ** 2 + (object.position.y - mouseY) ** 2);
            // mouse is overlapping with an object
            if (dist <= object.radius) {
                updateInfoPanel(object);
                return;
            }
        }
        updateInfoPanel(null);
    }
});

// R to reset canvas
document.addEventListener("keydown", (event) => {
    if (event.key === "r") {
        resetScene();
    }
    // debug to spawn 20 balls
    if (event.key === "t") {
        // plop sound when a ball is spawned
        playSpawnSound();
        const x = canvas.width / 2;
        const y = canvas.height / 3;
        for (let i = 0; i < 100; i++) {
            // small nudge so clicking twice in the same spot won't stack balls
            const nudge = randomRange(0.01, 0.02);
            const posVector = new Vector2(x + nudge, y + nudge);

            const radius = parseFloat(radiusSlider.value);

            const color = colors[Math.floor(randomRange(0, colors.length))]
            const mass = parseFloat(massSlider.value);
            const bounciness = parseFloat(bouncinessSlider.value);
            const friction = parseFloat(frictionSlider.value);

            spawnBall(posVector, radius, color, mass, bounciness, friction);

        }

    }
    // random balls for testing
    if (event.key === "y") {
        // plop sound when a ball is spawned
        playSpawnSound();

        benchmark(300, 100);
    }
    // spawn a test polygon
    if (event.key === "e") {
        // plop sound when a ball is spawned
        playSpawnSound();
        const posVector = new Vector2(mouseX, mouseY);
        // temporary -- size derivated from radius parameter
        const size = parseFloat(radiusSlider.value);
        const vertices = makeSquareVertices(size * 2);
        const color = colors[Math.floor(randomRange(0, colors.length))]
        const mass = parseFloat(massSlider.value);
        const bounciness = parseFloat(bouncinessSlider.value);
        const friction = parseFloat(frictionSlider.value);

        spawnPolygon(posVector, vertices, color, mass, bounciness, friction);
    }

});


// update radius value in the slider
radiusSlider.addEventListener("input", () => {
    radiusValueDisplay.textContent = radiusSlider.value;
    playSliderTick();
});
// update bounciness value in the slider
bouncinessSlider.addEventListener("input", () => {
    bouncinessValueDisplay.textContent = bouncinessSlider.value;
    playSliderTick();
});
// update air resistance value in the slider
airResistanceSlider.addEventListener("input", () => {
    airResistanceValueDisplay.textContent = airResistanceSlider.value;
    airResistance = airResistanceSlider.value;
    playSliderTick();
});
// update mass value in the slider
massSlider.addEventListener("input", () => {
    massValueDisplay.textContent = massSlider.value;
    playSliderTick()
});
// update friction value in the slider
frictionSlider.addEventListener("input", () => {
    frictionValueDisplay.textContent = frictionSlider.value;
    playSliderTick();
});
// update time scale value in the slider
timeScaleSlider.addEventListener("input", () => {
    timeScaleDisplay.textContent = timeScaleSlider.value;
    timeScale = timeScaleSlider.value;
    playSliderTick();
});
// listener for the time scale reset button
resetTimeScaleButton.addEventListener("click", () => {
    timeScaleSlider.value = 1;
    timeScaleDisplay.textContent = "1";
    timeScale = 1;
    playClickSound();

});

resetButton.addEventListener("click", () => {
    resetScene();
    playClickSound();
});

spawnModeButton.addEventListener("click", () => {
    mode = 1;
    spawnModeButton.classList.add("active");
    inspectModeButton.classList.remove("active");
    pushModeButton.classList.remove("active");
    playClickSound();

});
pushModeButton.addEventListener("click", () => {
    mode = 2;
    spawnModeButton.classList.remove("active");
    inspectModeButton.classList.remove("active");
    pushModeButton.classList.add("active");
    playClickSound();

});
inspectModeButton.addEventListener("click", () => {
    mode = 3;
    spawnModeButton.classList.remove("active");
    pushModeButton.classList.remove("active");
    inspectModeButton.classList.add("active");
    playClickSound();

});

// listener to resize canvas
window.addEventListener("resize", resizeCanvas)


resizeCanvas();
resetScene();
loop();


/* TODO:
 add AABB eliminations before SAT, cache axes for polygon-polygon, add ROTATION, SQUARE BOUNCINESS and FRICTION
 add ball-to-ball friction, more sound effects
 OPTIMIZATIONS (drawImg ball coloring optimization, finish sleeping bodies)
 */