import { Ball } from "./ball.js";
import { colors } from "./globals.js";
import { radiusSlider, radiusValueDisplay, bouncinessValueDisplay, bouncinessSlider, airResistanceSlider, airResistanceValueDisplay, massSlider, massValueDisplay, timeScaleSlider, timeScaleDisplay, resetTimeScaleButton } from "./ui.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

let lastTime = performance.now();

let balls = [];

function update(dt) {
    for (const ball of balls) {
        ball.update(dt, canvas, parseFloat(airResistanceSlider.value));

        // check for collisions
        for (const otherBall of balls) {
            // don't bounce with yourself
            if (otherBall === ball) {
                continue;
            }
            // check if they touch
            let xDist = ball.x - otherBall.x;
            let yDist = ball.y - otherBall.y;
            let dist = Math.sqrt((xDist ** 2) + (yDist ** 2));
            if (dist <= ball.radius + otherBall.radius) {
                let overlap = (ball.radius + otherBall.radius) - dist;
                // they overlap, push them apart before applying bounce
                if (overlap > 0) {
                    let magX = xDist / dist;
                    let magY = yDist / dist;

                    ball.x += magX * overlap * 0.5;
                    ball.y += magY * overlap * 0.5;

                    otherBall.x -= magX * overlap * 0.5;
                    otherBall.y -= magY * overlap * 0.5;
                }
                
                ball.bounce(xDist, yDist);
            }

        }
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
    const actualDt = (currentTime - lastTime) / 1000;
    const dt = actualDt * parseFloat(timeScaleSlider.value);
    lastTime = currentTime;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

// Helper function to draw a circle
function drawCircle(x, y, radius, startAngle, endAngle, color, toFill) {
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    if (toFill) {
        ctx.fillStyle = color;
        ctx.fill();
    } else {
        ctx.strokeStyle = color;
        ctx.stroke();
    }
}

// Helper function to get a random number in a range
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // x, y, radius, color, mass, bounciness, air resistance
    balls.push(new Ball(x, y, parseFloat(radiusSlider.value), colors[Math.floor(randomRange(0, colors.length))], parseFloat(massSlider.value), parseFloat(bouncinessSlider.value), parseFloat(airResistanceSlider.value)));
    
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

// listener to resize canvas
window.addEventListener("resize", resizeCanvas)


resizeCanvas();
loop();


// TODO:

// add friction, fix air resistence, make mass work with colissions, fix tabbing out bug, 