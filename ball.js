import { gravity, circleDragCoefficient, dragK, gK } from "./globals.js";
import { Vector2 } from "./vector2.js";

const SLEEP_VELOCITY_THRESHOLD = 5; // sleep speed threshold
const SLEEP_TIME_REQUIRED = 0.5;    // time sleep threshold

export class Ball {
    isAsleep = false;
    sleepTimer = 0;

    constructor(position, radius, color, mass, bounciness) {
        this.force = new Vector2(0, 0);
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);
        this.position = position;

        this.radius = radius;
        this.mass = mass
        this.bounciness = bounciness;

        this.color = color;
        
    }

    draw(ctx) {

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isAsleep ? "black" : this.color;
        ctx.fill();
    
    }

    update(dt, canvas, airDensity) {
        if (this.isAsleep) {
            return;
        }

        // reset the forces to 0
        this.force.mult(0);

        // apply gravity force F=ma
        this.force.sub(gravity.clone().mult(this.mass * gK));
        

        // apply air resistence REWORK LATER
        let speed = this.velocity.magnitude();
        if (speed > 0) {
            // Fd = (1/2)(p)(C)(PI)(r^2)(|v|)(v)
            // dragK is an arbitrary constant to keep airDensity being 1.225
            const dragForce = this.velocity.clone().mult(0.5 * airDensity * circleDragCoefficient * Math.PI * (this.radius ** 2) * speed * dragK);
            // larger objects experience more drag, and heavier ones experience less
            // let dragStrength = drag * this.radius * 0.2 * (1 / this.mass);

            // this.force.add(this.velocity.clone().mult(dragStrength));
            this.force.add(dragForce);
        }
        
        // bounding area of screen
        // this.checkBounds(canvas);
       
        // convert force to acceleration a = F/ma
        this.acceleration = this.force.clone().mult(1/this.mass);

        // convert force to velocity
        this.velocity.sub(this.acceleration.clone().mult(dt));

        // convert velocity into position
        this.position.add(this.velocity.clone().mult(dt));

        // console.log(this.velocity.magnitude());
    }

    bounce(dir) {
        // normalize direction vector
        const normal = dir.normalize();

        // compute the dot product of the x and y vectors
        const vDotN = this.velocity.dotProduct(normal);

        // apply velocity change
        // vVelocity -= vNormal * v dot n * (1 + bounciness)
        this.velocity.sub(normal.clone().mult(vDotN * (1 + this.bounciness)));
    }

    checkBounds(canvas) {
         // check for ground + ceiling and bounce
        if (this.position.y > canvas.height - this.radius || this.position.y < this.radius) {
            this.bounce(new Vector2(0, this.radius));
            // snap to the bottom if the ball falls through the ground
            if (this.position.y > canvas.height - this.radius) { // ceiling
                this.position.y = canvas.height - this.radius;
            } else if (this.position.y < this.radius) { // ground
                this.position.y = this.radius;
            }
    
        }

        // check for walls and bounce
        if (this.position.x > canvas.width - this.radius || this.position.x < this.radius) {
            this.bounce(new Vector2(this.radius, 0));
            // snap to the side if the ball goes through the wall
            if (this.position.x > canvas.width - this.radius) { // right wall
                this.position.x = canvas.width - this.radius;
            }
            else if (this.position.x < this.radius) { // left wall
                this.position.x = this.radius;
            }
    
        }
    }
    
}