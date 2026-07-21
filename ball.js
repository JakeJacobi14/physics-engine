import { gravity, circleDragCoefficient, dragK, gK, REST_THRESHOLD } from "./globals.js";
import { Vector2 } from "./vector2.js";

const REST_TIME = 2;

export class Ball {
    
    isAsleep = false;
    asleepTimer = 0;
    constructor(position, radius, color, mass, bounciness, friction) {
        this.type = "circle";
        this.force = new Vector2(0, 0);
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);
        this.position = position;
        this.lastPosition = position.clone();

        this.radius = radius;
        this.mass = mass
        this.bounciness = bounciness;
        this.friction = friction;

        this.color = color;


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

    update(dt, airDensity) {
        // console.log(this.velocity.magnitude());
        if (this.isAsleep) return;

        let speed = this.velocity.magnitude();
        // reset the forces to 0
        this.force.mult(0);

        // apply gravity force F=ma
        this.force.sub(gravity.clone().mult(this.mass * gK));

        // apply air resistence REWORK LATER
        if (speed > 0) {
            // Fd = (1/2)(p)(C)(PI)(r^2)(|v|)(v)
            // dragK is an arbitrary constant to keep airDensity being 1.225
            const dragForce = this.velocity.clone().mult(0.5 * airDensity * circleDragCoefficient * Math.PI * (this.radius ** 2) * speed * dragK);
            // larger objects experience more drag, and heavier ones experience less
            // let dragStrength = drag * this.radius * 0.2 * (1 / this.mass);

            // this.force.add(this.velocity.clone().mult(dragStrength));
            this.force.add(dragForce);
        }

        // convert force to acceleration a = F/ma
        this.acceleration = this.force.clone().mult(1 / this.mass);

        // convert force to velocity
        this.velocity.sub(this.acceleration.clone().mult(dt));

        // convert velocity into position
        this.position.add(this.velocity.clone().mult(dt));

    }

    // function to wake a sleeping ball up
    wake() {
        this.asleepTimer = 0;
        this.isAsleep = false;
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

    // check for clipping out of the screen
    checkBounds(canvas, dt) {
        const ySpeed = Math.abs(this.velocity.y);
        // check for ground + ceiling and bounce
        if (this.position.y > canvas.height - this.radius || this.position.y < this.radius) {
            // insignificant bounces zero out speed
            if (ySpeed > REST_THRESHOLD) {
                this.bounce(new Vector2(0, this.radius));
            } else {
                this.velocity.y = 0;
            }
            // snap to the bottom if the ball falls through the ground
            if (this.position.y > canvas.height - this.radius) { // ground
                this.position.y = canvas.height - this.radius;
            } else if (this.position.y < this.radius) { // ceiling
                this.position.y = this.radius;
            }

        }

        // ball-to-ground friction
        const isOnGround = this.position.y >= canvas.height - this.radius - 0.5;
        if (isOnGround && Math.abs(this.velocity.y) < REST_THRESHOLD) {
            const slow = this.friction;
            const drop = slow * dt;
            if (Math.abs(this.velocity.x) > drop) {
                this.velocity.x -= Math.sign(this.velocity.x) * drop;
            } else {
                this.velocity.x = 0;
            }
        }

        const xSpeed = Math.abs(this.velocity.x);
        // check for walls and bounce
        if (this.position.x > canvas.width - this.radius || this.position.x < this.radius) {
            // insignificant bounces zero out speed
            if (xSpeed > REST_THRESHOLD) {
                this.bounce(new Vector2(this.radius, 0));
            } else {
                this.velocity.x = 0;
            }
            // snap to the side if the ball goes through the wall
            if (this.position.x > canvas.width - this.radius) { // right wall
                this.position.x = canvas.width - this.radius;
            }
            else if (this.position.x < this.radius) { // left wall
                this.position.x = this.radius;
            }

        }
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

    updateLastPosition() {
        this.lastPosition.x = this.position.x;
        this.lastPosition.y = this.position.y;
    }

}