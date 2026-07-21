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

const iterations = 2;
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


function update(dt) {
    for (const ball of objects) {
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

    

    // substeps, which reduce time in between calculations but do fewer corrective calculations
    let subDt = dt / substeps;
    for (let i = 0; i < substeps; i++) {

        update(subDt);

        resolveCollisons(dt);
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
    }
    else if (b1.type === "polygon" && b2.type === "circle") {
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

    // detect collision
    if (dist <= radiusSum) {
        // inverse masses, needed a few times 
        const invMass1 = 1 / b1.mass;
        const invMass2 = 1 / b2.mass;

        const overlap = (radiusSum) - dist;
        // normalize the direction vector
        dir.normalize();
        // they overlap, push them apart before applying impulses
        if (overlap > 0) {

            // slop damping
            // percent correction each iteration
            const percent = 0.8;
            // overlap amount to ignore 
            const slop = 0.05;

            const correction = Math.max(overlap - slop, 0) * percent;

            // balls with more mass in a collision move less
            const totalMass = invMass1 + invMass2;

            b1.position.add(dir.clone().mult(correction * invMass1 / totalMass));
            b2.position.sub(dir.clone().mult(correction * invMass2 / totalMass));
        }

        // find relative velocity between b1 and b2
        const relativeVelocity = b1.velocity.clone().sub(b2.velocity);

        // take dot product
        const velAlongNormal = relativeVelocity.dotProduct(dir);

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

        const impulse = dir.mult(j);

        b1.velocity.add(
            impulse.clone().mult(invMass1)
        );

        b2.velocity.sub(
            impulse.mult(invMass2)
        );
    }
}

function circlePolygon(b1, b2) {

}

function polygonPolygon(b1, b2) {

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

// function that pushes balls outwards from x and y coordinates
function pushBalls(x, y, power) {
    for (const ball of objects) {
        const dir = ball.position.clone().sub(new Vector2(x, y));
        const dist = dir.magnitude();

        // 250 is the falloff radius, 0 to avoid dividing by 0
        if (dist === 0 || dist > 250) continue;

        dir.normalize();

        // power shrinks linearly with distance
        const strength = power / dist;
        ball.velocity.add(dir.mult(strength));
        // wake a sleeping ball up
        ball.wake();
    }
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


// function to re-call pushBalls while the user is holding
function constantlyPushBalls(power) {
    if (!isHolding) return;
    pushBalls(mouseX, mouseY, power);
    requestAnimationFrame(() => constantlyPushBalls(power));
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

        const radius = randomRange(5, 40);
        const color = colors[Math.floor(randomRange(0, colors.length))];
        const mass = randomRange(1, 100);
        const bounciness = randomRange(0, 0.99);
        const friction = randomRange(0, 10);

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
        isHolding = true;
        // get mouse position
        const rect = canvas.getBoundingClientRect();

        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;
        const power = 10000;

        constantlyPushBalls(power);
    }
});
document.addEventListener("mouseup", () => {
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
            const dist = Math.sqrt(Math.pow(object.position.x - mouseX, 2) + (Math.pow(object.position.y - mouseY, 2)));
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

        const x = randomRange(20, canvas.width - 20);
        const y = canvas.height / 3;
        const posVector = new Vector2(x, y);
        const vertices = makeSquareVertices(45);

        spawnPolygon(posVector, vertices, "red", 10, 0, 0);
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
 add ball-to-ball friction, more sound effects
 OPTIMIZATIONS (drawImg ball coloring optimization, finish sleeping bodies)
 */