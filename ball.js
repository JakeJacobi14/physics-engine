import { gravity, circleDragCoefficient, dragK, gK, REST_THRESHOLD } from "./globals.js";
import { Vector2 } from "./vector2.js";
import { RigidBody } from "./rigidbody.js";

const REST_TIME = 2;

export class Ball extends RigidBody {
    
   constructor(position, radius, color, mass, bounciness, friction) {
        super(position, color, mass, bounciness, friction);
        this.type = "circle";
        this.radius = radius;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isAsleep ? "black" : this.color;
        ctx.fill();
        // draw shine for only bigger balls
        if (this.radius > 12) {
            // shine
            ctx.beginPath();
            ctx.arc(
                this.position.x - this.radius * 0.32,
                this.position.y - this.radius * 0.32,
                this.radius * 0.32,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.fill();
        }
        
    

    }


    // Return the bounding coordinates of the ball
    getBounds() {
        return {
            minX: this.position.x - this.radius,
            maxX: this.position.x + this.radius,
            minY: this.position.y - this.radius,
            maxY: this.position.y + this.radius,
        }; // as an object, not an array
    }

    // sleeping bodies
    updateBallSleep(dt) {

        // const dx = this.position.x - this.lastPosition.x;
        // const dy = this.position.y - this.lastPosition.y;
        // const movement = Math.sqrt(dx * dx + dy * dy);

        // if (this.isAsleep) {
        //     this.velocity.mult(0);
        //     this.acceleration.mult(0);
        //     return;
        // }

        // const xStill = Math.abs(this.velocity.x) < REST_THRESHOLD;
        // const yStill = Math.abs(this.velocity.y) < REST_THRESHOLD;

        // if (xStill && yStill && movement < 0.5) {
        //     this.asleepTimer += dt;
        //     if (this.asleepTimer >= REST_TIME) {
        //         this.isAsleep = true;
        //         this.velocity.mult(0);
        //         this.acceleration.mult(0);
        //     }
        // } else {
        //     this.wake();
        // }
    }

    handleDrag(airDensity) {
        const speed = this.velocity.magnitude();
        
        if (speed > 0) {
            const dragForce = this.velocity.clone().mult(
                0.5 * airDensity * circleDragCoefficient * Math.PI * (this.radius ** 2) * speed * dragK
            );
            this.force.add(dragForce);
        }
    }
}