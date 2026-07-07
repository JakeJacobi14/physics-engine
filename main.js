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

function update(dt) {
    for (const ball of balls) {
        ball.update(dt, canvas, parseFloat(airResistanceSlider.value));
    }
    
    draw();
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
        fpsDisplay.textContent = Math.round(1 / dt);
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

                    // each moves half distance, they go opposite directions
                    b1.position.x += dir.x * overlap * 0.5;
                    b1.position.y += dir.y * overlap * 0.5;

                    b2.position.x -= dir.x * overlap * 0.5;
                    b2.position.y -= dir.y * overlap * 0.5;
                }
                
                // b1.bounce(dir);
                // b2.bounce(dir);

                // find the velocity along the collision axis by dotting it with the direction vector
                const v1 = b1.velocity.clone().dotProduct(dir);
                const v2 = b2.velocity.clone().dotProduct(dir);
                // masses
                const m1 = b1.mass;
                const m2 = b2.mass;

                // compute the new velocities
                const v1n = (((m1 - m2) * v1) + (2 * m2 * v2)) / (m1 + m2);
                const v2n = (((m2 - m1) * v2) + (2 * m1 * v1)) / (m1 + m2);

                // calculate the new velocity
                const dv1 = dir.clone().mult(v1n - v1);
                b1.velocity.add(dv1);

                const dv2 = dir.clone().mult(v2n - v2);
                b2.velocity.add(dv2);
            
            }
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

    // position vector, radius, color, mass, bounciness
    const ball = new Ball(posVector, radius, color, mass, bounciness);
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
        const y = canvas.height / 2;
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
 add friction, decoration, sound effects, reenforce no clipping (ground and other balls)
 */