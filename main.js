import { Ball } from "./ball.js";
import { colors } from "./globals.js";
import { Vector2 } from "./vector2.js";
import { radiusSlider, radiusValueDisplay, bouncinessValueDisplay, bouncinessSlider, airResistanceSlider, airResistanceValueDisplay, massSlider, massValueDisplay, timeScaleSlider, timeScaleDisplay, resetTimeScaleButton, fpsDisplay, resetButton } from "./ui.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

let lastTime = performance.now();

let balls = [];

let fpsTimer = 0;

const iterations = 6;

function update(dt) {
    for (const ball of balls) {
        ball.update(dt, parseFloat(airResistanceSlider.value));
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
    const dt = actualDt * parseFloat(timeScaleSlider.value);

    // update the fps display every quarter second
    if (fpsTimer >= 0.25) {
        fpsDisplay.textContent = Math.round(1 / actualDt);
        fpsTimer = 0;
    }
    fpsTimer += actualDt;

    lastTime = currentTime;

    update(dt);

    resolveCollisons(dt);

    draw();
    
    requestAnimationFrame(loop);
}

// impulses for collisions
function resolveCollisons(dt) {
    for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                let b1 = balls[i];
                let b2 = balls[j];
                
                // check if they touch
                let dir = b1.position.clone().sub(b2.position);
                const dist = dir.magnitude();
                // detect collision
                if (dist <= b1.radius + b2.radius) {
                    const overlap = (b1.radius + b2.radius) - dist;
                    // they overlap, push them apart before applying bounce
                    dir.normalize();
                    if (overlap > 0) {
                        // dir.normalize();

                        // slop damping
                        // percent correction each iteration
                        const percent = 0.8;
                        // overlap amount to ignore 
                        const slop = 0.1;

                        const correction = Math.max(overlap - slop, 0) * percent;

                        b1.position.add(dir.clone().mult(correction * 0.5));
                        b2.position.sub(dir.clone().mult(correction * 0.5));
                    }
                    
                    // b1.bounce(dir);
                    // b2.bounce(dir);

                    // find relative velocity between b1 and b2
                    const relativeVelocity = b1.velocity.clone().sub(b2.velocity);
                    
                    // take dot product
                    const velAlongNormal = relativeVelocity.dotProduct(dir);
                    
                    // if the dot product (velocity along axis of colission) is greater than 0, skip
                    if (velAlongNormal > 0) continue;
                    
                    // it's more physically accurate to take the minimum of the two bounciness values instead of averaging the values
                    // let collisionBounciness = (b1.bounciness + b2.bounciness) / 2;
                    let collisionBounciness = Math.min(b1.bounciness, b2.bounciness);

                    const REST_THRESHOLD = 5;
                    // if the colission is tiny, don't even bounce at all (avoid microbounces)
                    if (Math.abs(velAlongNormal) < REST_THRESHOLD) {
                        collisionBounciness = 0;
                    }

                    // standard 2d engine method for collisions as opposed to 1D elastic collision method
                    const invMass1 = 1 / b1.mass;
                    const invMass2 = 1 / b2.mass;

                    const j =
                        -(1 + collisionBounciness) * velAlongNormal /
                        (invMass1 + invMass2);

                    const impulse = dir.clone().mult(j);

                    b1.velocity.add(
                        impulse.clone().mult(invMass1)
                    );

                    b2.velocity.sub(
                        impulse.clone().mult(invMass2)
                    );
                }
            }
            balls[i].checkBounds(canvas);
        }
    }
}

// Helper function to get a random number in a range
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Helper function to reset the scene
function resetScene() {
    balls = [];
    radiusSlider.value = 25;
    radiusValueDisplay.textContent = radiusSlider.value;

    bouncinessSlider.value = 0.65;
    bouncinessValueDisplay.textContent = bouncinessSlider.value;

    airResistanceSlider.value = 1.225;
    airResistanceValueDisplay.textContent = airResistanceSlider.value;

    massSlider.value = 25;
    massValueDisplay.textContent = massSlider.value;

    timeScaleSlider.value = 1;
    timeScaleDisplay.textContent = timeScaleSlider.value;
}

// Resizes the canvas when the window size is changed
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

// summon one ball
canvas.addEventListener("click", (event) => {
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
    const ball = new Ball(posVector, radius, color, mass, bounciness, ctx);
    balls.push(ball);

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
        for (let i = 0; i < 200; i++) {
            // small nudge so clicking twice in the same spot won't stack balls
            const nudge = randomRange(0.01, 0.02);
            const posVector = new Vector2(x + nudge, y + nudge);

            const radius = parseFloat(radiusSlider.value);
            const color = colors[Math.floor(randomRange(0, colors.length))]
            const mass = parseFloat(massSlider.value);
            const bounciness = parseFloat(bouncinessSlider.value);

            // position vector, radius, color, mass, bounciness
            const ball = new Ball(posVector, radius, color, mass, bounciness);
            balls.push(ball);
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
});
// update mass value in the slider
massSlider.addEventListener("input", () => {
    massValueDisplay.textContent = massSlider.value;
});
// update time scale value in the slider
timeScaleSlider.addEventListener("input", () => {
    timeScaleDisplay.textContent = timeScaleSlider.value;
});
// listener for the time scale reset button
resetTimeScaleButton.addEventListener("click", () => {
    timeScaleSlider.value = 1;
    timeScaleDisplay.textContent = "1";
    
});

resetButton.addEventListener("click", () => {
  resetScene();
});

// listener to resize canvas
window.addEventListener("resize", resizeCanvas)


resizeCanvas();
loop();


/* TODO:
 add friction, decoration, sound effects, OPTIMIZATIONS ( quad tree / linear splicing, drawImg ball coloring optimization)
 */