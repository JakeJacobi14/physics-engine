import { Ball } from "./ball.js";
import { colors, REST_THRESHOLD } from "./globals.js";
import { Vector2 } from "./vector2.js";
import { radiusSlider, radiusValueDisplay, bouncinessValueDisplay, bouncinessSlider, airResistanceSlider, airResistanceValueDisplay, massSlider, massValueDisplay, timeScaleSlider, timeScaleDisplay, resetTimeScaleButton, fpsDisplay, resetButton } from "./ui.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

let lastTime = performance.now();

let balls = [];

let fpsTimer = 0;

const iterations = 2;
const substeps = 8;

let airResistance = 1.225;

let timeScale = 1;

let nextBallId = 0;

let maxSmallRadius = 25; // track the biggest ball currently in the scene

const BIG_RADIUS = 30;



function update(dt) {
    for (const ball of balls) {
        ball.update(dt, airResistance);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const ball of balls) {
        ball.draw(ctx);
    }

}

function loop() {
    // find deltaTime
    let currentTime = performance.now();
    let actualDt = (currentTime - lastTime) / 1000;
    // if the program freezes or is tabbed out, don't create a massive deltaTime
    if (actualDt > 0.1) {
        actualDt = 0.016;
    }
    const dt = actualDt * timeScale;

    for (const ball of balls) {
        ball.updateLastPosition();
    }

    // update the fps display every quarter second
    if (fpsTimer >= 0.25) {
        fpsDisplay.textContent = Math.round(1 / actualDt) + " | Objects: " + balls.length;
        fpsTimer = 0;
    }
    fpsTimer += actualDt;

    // substeps, which reduce time in between calculations but do fewer corrective calculations
    let subDt = dt / substeps;
    for (let i = 0; i < substeps; i++) {
        
        update(subDt);
        
        resolveCollisons();
    }

    for (const ball of balls) {
        ball.updateBallSleep(dt);
    }

    lastTime = currentTime;

    draw();
    
    requestAnimationFrame(loop);
    // setTimeout(loop, 0); // <-- fps test, with a clamped 4ms delay maybe
}

// impulses for collisions
// uses spatial hashing
function resolveCollisons() {
    // build the new grid
    const grid = buildGrid();
    // calculate the physics k times
    for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < balls.length; i++) {
            const b1 = balls[i];
            // check for radius size, for a hybrid spatial hashing
            // big balls check collision pairs manually, small ones use hashing
            if (b1.radius >= BIG_RADIUS) {
                // loop through every ball
                for (let j = 0; j < balls.length; j++) {
                    const b2 = balls[j];
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
            balls[i].checkBounds(canvas);
           
        }
    }
}

// actually handles the collision physics
function narrowPhase(b1, b2) {
    if (b1.isAsleep && b2.isAsleep) return;
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
            b1.wake();
            b2.wake();
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
    for (const ball of balls) {
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
function spawnBall(posVector, radius, color, mass, bounciness) {
    // position vector, radius, color, mass, bounciness
    const ball = new Ball(posVector, radius, color, mass, bounciness);
    // increment ball id
    ball.id = nextBallId++;
    // add the ball to the array of balls in the scene
    balls.push(ball);
    // update maxSmallRadius (largest radius below BIG_RADIUS)
    if (radius < BIG_RADIUS) {
        maxSmallRadius = Math.max(maxSmallRadius, radius);
    }
}

// Helper function to get a random number in a range
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Helper function to reset the scene
function resetScene() {
    balls = [];
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

    timeScaleSlider.value = 1;
    timeScaleDisplay.textContent = timeScaleSlider.value;
    timeScale = 1;
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
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

// summon one ball
canvas.addEventListener("click", (event) => {
    // plop sound when a ball is spawned
    playSpawnSound();

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

    // position vector, radius, color, mass, bounciness, ctx
    spawnBall(posVector, radius, color, mass, bounciness, ctx);


});

// R to reset canvas
document.addEventListener("keydown", (event) => {
    if (event.key === "r") {
        resetScene();
    }
    // debug to spawn 20 balls
    if (event.key === "t") {
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

            spawnBall(posVector, radius, color, mass, bounciness);
            
        }
       
    }
    // random balls for testing
    if (event.key === "y") {
        for (let i = 0; i < 1000; i++) {
            const x = randomRange(0, canvas.width);
            const y = randomRange(0, canvas.height);
            const posVector = new Vector2(x, y);

            const radius = 8;
            const color = colors[Math.floor(randomRange(0, colors.length))];
            const mass = parseFloat(massSlider.value);
            const bounciness = parseFloat(bouncinessSlider.value);

            spawnBall(posVector, radius, color, mass, bounciness);
        }
    }
});


// update radius value in the slider
radiusSlider.addEventListener("input", () => {
    radiusValueDisplay.textContent = radiusSlider.value;
});
// update bounciness value in the slider
bouncinessSlider.addEventListener("input", () => {
    bouncinessValueDisplay.textContent = bouncinessSlider.value;
});
// update air resistance value in the slider
airResistanceSlider.addEventListener("input", () => {
    airResistanceValueDisplay.textContent = airResistanceSlider.value;
    airResistance = airResistanceSlider.value;
});
// update mass value in the slider
massSlider.addEventListener("input", () => {
    massValueDisplay.textContent = massSlider.value;
});
// update time scale value in the slider
timeScaleSlider.addEventListener("input", () => {
    timeScaleDisplay.textContent = timeScaleSlider.value;
    timeScale = timeScaleSlider.value;
});
// listener for the time scale reset button
resetTimeScaleButton.addEventListener("click", () => {
    timeScaleSlider.value = 1;
    timeScaleDisplay.textContent = "1";
    timeScale = 1;
    
});

resetButton.addEventListener("click", () => {
  resetScene();
});



// listener to resize canvas
window.addEventListener("resize", resizeCanvas)


resizeCanvas();
loop();


/* TODO:
 add friction, decoration, sound effects
 OPTIMIZATIONS (spatial hashing hybrid with big balls, drawImg ball coloring optimization, sleeping bodies)
 */