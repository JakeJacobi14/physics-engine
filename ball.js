import { gravity } from "./globals.js";

export class Ball {
    xVelocity = 0;
    yVelocity = 0;
    xForce = 0;
    yForce = 0;
    bounciness = 0.65;
    constructor(x, y, radius, color, mass) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.mass = mass
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        

    }

    update(dt, canvas) {
        // reset the forces to 0
        this.xForce = 0;
        this.yForce = 0;

        // gravity force
        this.yForce -= gravity * this.mass;
        
        // air resistence
        let speed = Math.sqrt((this.xVelocity ** 2) + (this.yVelocity ** 2));
        if (speed > 0) {
            let dragStrength = 0.02; 

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

        this.xVelocity -= (1 + this.bounciness) * vDotN * nx;
        this.yVelocity -= (1 + this.bounciness) * vDotN * ny;

    }
    
}