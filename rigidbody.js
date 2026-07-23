import { Vector2 } from "./vector2.js";
import { gravity, circleDragCoefficient, dragK, gK, REST_THRESHOLD } from "./globals.js";

export class RigidBody {
    isAsleep = false;
    asleepTimer = 0;
    isBeingDragged = false;

    constructor(position, color, mass, bounciness, friction) {
        this.force = new Vector2(0, 0);
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);
        this.position = position;
        this.lastPosition = position.clone();
        this.mass = mass;
        this.bounciness = bounciness;
        this.friction = friction;
        this.color = color;
    }

    update(dt, airDensity) {
        if (this.isAsleep) return;
        // reset the forces to 0
        this.force.mult(0);
        // apply gravity force F=ma
        this.force.sub(gravity.clone().mult(this.mass * gK));

        // air resistance
        this.handleDrag(airDensity);

        // convert force to acceleration a = F/ma
        this.acceleration = this.force.clone().mult(1 / this.mass);

        // convert force to velocity
        this.velocity.sub(this.acceleration.clone().mult(dt));
        
        // convert velocity into position
        this.position.add(this.velocity.clone().mult(dt));
    }

    checkBounds(canvas, dt) {
        const bounds = this.getBounds();

        const bottomOffset = bounds.maxY - this.position.y;
        const topOffset = bounds.minY - this.position.y;
        const leftOffset = bounds.minX - this.position.x;
        const rightOffset = bounds.maxX - this.position.x;

        // floor and ceiling
        if (this.position.y + bottomOffset > canvas.height || this.position.y + topOffset < 0) {
            const ySpeed = Math.abs(this.velocity.y);
            if (ySpeed > REST_THRESHOLD) {
                this.bounce(new Vector2(0, 1)); // direction doesn't matter
            } else {
                this.velocity.y = 0;
            }

            if (this.position.y + bottomOffset > canvas.height) {
                this.position.y = canvas.height - bottomOffset;
            } else if (this.position.y + topOffset < 0) {
                this.position.y = -topOffset;
            }
        }

        // object to ground friction
        const isOnGround = this.position.y + bottomOffset >= canvas.height - 0.5;
        const ySpeed = Math.abs(this.velocity.y);
        if (isOnGround && ySpeed < REST_THRESHOLD) { // if object is touching the ground and not moving up
            const xSpeed = Math.abs(this.velocity.x);
            const drop = this.friction * dt * (this.type === "polygon" ? 6 : 1); // temporary friction increase for polygons (until coloumb friction can be added)
            if (xSpeed > drop) {
                this.velocity.x -= Math.sign(this.velocity.x) * drop;
            } else {
                this.velocity.x = 0;
            }
        }
            

        // walls
        if (this.position.x + rightOffset > canvas.width || this.position.x + leftOffset < 0) {
            const xSpeed = Math.abs(this.velocity.x);
            if (xSpeed > REST_THRESHOLD) {
                this.bounce(new Vector2(1, 0)); // direction doesn't matter
            } else {
                this.velocity.x = 0;
            }
            
            if (this.position.x + rightOffset > canvas.width) {
                this.position.x = canvas.width - rightOffset;
            } else if (this.position.x + leftOffset < 0) {
                this.position.x = -leftOffset;
            }
        }
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

    wake() {
        this.asleepTimer = 0;
        this.isAsleep = false;
    }

    updateLastPosition() {
        this.lastPosition.x = this.position.x;
        this.lastPosition.y = this.position.y;
    }

    updateBallSleep(dt) {
    }
}