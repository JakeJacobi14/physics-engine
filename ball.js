import { gravity } from "./globals.js";

export class Ball {

    xVelocity = 0;
    yVelocity = 0;
    xForce = 0;
    yForce = 0;


    constructor(x, y, radius, color, mass, bounciness) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.mass = mass
        this.bounciness = bounciness;
    }

    draw(ctx) {

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    
    }

    update(dt, canvas, drag) {
        // reset the forces to 0
        this.xForce = 0;
        this.yForce = 0;

        // gravity force F=ma but we divide out mass when turning a = F/m so we can just not add it at all
        this.yForce -= gravity;
        
        // air resistence
        let speed = Math.sqrt((this.xVelocity ** 2) + (this.yVelocity ** 2));
        if (speed > 0) {
            // larger objects experience more drag, and heavier ones experience less
            let dragStrength = drag * this.radius * 0.2 * (1 / this.mass);

            this.xForce += this.xVelocity * dragStrength;
            this.yForce += this.yVelocity * dragStrength;
        }
        
        // check for ground + ceiling and bounce
        if (this.y > canvas.height - this.radius || this.y < this.radius) {
            this.bounce(0, this.radius);
            // snap to the bottom if the ball falls through the ground
            if (this.y > canvas.height - this.radius - 5) {
                this.y = canvas.height - this.radius;
            } else if (this.y < this.radius) {
                this.y = this.radius;
            }
    
        }

        // check for walls and bounce
        if (this.x > canvas.width - this.radius || this.x < this.radius) {
            this.bounce(this.radius, 0);
            // snap to the side if the ball goes through the wall
            if (this.x > canvas.width - this.radius - 5) {
                this.x = canvas.width - this.radius;
            }
            else if (this.x < this.radius) {
                this.x = this.radius;
            }
    
        }

        // convert force to velocity
        this.yVelocity += -this.yForce * dt;
        this.xVelocity += -this.xForce * dt;

        // convert velocity into position
        this.y += this.yVelocity * dt;
        this.x += this.xVelocity * dt;


    }

    bounce(xDir, yDir) {
        let magnitude = Math.sqrt((xDir ** 2) + (yDir ** 2));
        // avoid divide by 0
        if (magnitude == 0) {
            return;
        }
        // normal vectors
        let nx = xDir / magnitude;
        let ny = yDir / magnitude;
        
        // compute the dot product of the x and y vectors
        const vDotN = this.xVelocity * nx + this.yVelocity * ny;

        // apply velocity change
        this.xVelocity -= (1 + this.bounciness) * vDotN * nx;
        this.yVelocity -= (1 + this.bounciness) * vDotN * ny;

    }
    
}