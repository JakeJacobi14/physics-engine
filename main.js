import { Ball } from "./ball.js";
import { colors } from "./globals.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let lastTime = performance.now();

let balls = [];

function update(dt) {
    for (const ball of balls) {
        ball.update(dt, canvas);

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
    let currentTime = performance.now();
    const dt = (currentTime - lastTime) / 1000;
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

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    balls.push(new Ball(x, y, randomRange(15, 40), colors[Math.floor(randomRange(0, colors.length))], 5));
    
});



loop();